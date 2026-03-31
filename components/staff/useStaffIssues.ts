"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch, loadAuth } from "@/lib/client-auth";

export type StaffIssue = {
  _id: string;
  title: string;
  description?: string;
  category: string;
  status: "Pending" | "In Progress" | "Resolved" | "Rejected";
  location?: string;
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
  priority?: "Low" | "Medium" | "High" | "Urgent" | null;
  student?: { name?: string; email?: string };
  assignedStaff?: { _id?: string; name?: string; email?: string } | null;
  department?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
  serviceDepartment?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
  academicDepartment?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
};

export type StaffIssueSortBy = "created_desc" | "created_asc" | "priority_desc" | "sla_deadline";

export type StaffIssueQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "All" | "Pending" | "In Progress" | "Resolved" | "Rejected";
  priority?: "All" | "Low" | "Medium" | "High" | "Urgent" | "No Priority";
  sortBy?: StaffIssueSortBy;
};

export type StaffIssuesMeta = {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  limit: number;
};

type UseStaffIssuesOptions = {
  cacheKey?: string;
  cacheTtlMs?: number;
  pollIntervalMs?: number;
  query?: StaffIssueQuery;
  enablePolling?: boolean;
};

export function useStaffIssues(options: UseStaffIssuesOptions = {}) {
  const cacheKey = options.cacheKey ?? "scit_staff_issues";
  const cacheTtlMs = options.cacheTtlMs ?? 2 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 15000;
  const enablePolling = options.enablePolling ?? true;

  const queryString = useMemo(() => buildQueryString(options.query), [options.query]);
  const scopedCacheKey = useMemo(() => `${cacheKey}:${queryString || "base"}`, [cacheKey, queryString]);

  const cachedPayload = useMemo(() => readCachedIssues(scopedCacheKey, cacheTtlMs), [scopedCacheKey, cacheTtlMs]);

  const [issues, setIssues] = useState<StaffIssue[]>(() => cachedPayload?.issues || []);
  const [meta, setMeta] = useState<StaffIssuesMeta>(() =>
    cachedPayload
      ? {
          totalItems: cachedPayload.totalItems,
          totalPages: cachedPayload.totalPages,
          currentPage: cachedPayload.currentPage,
          limit: cachedPayload.limit,
        }
      : {
          totalItems: 0,
          totalPages: 1,
          currentPage: 1,
          limit: 10,
        }
  );
  const [loading, setLoading] = useState(() => !cachedPayload);
  const [error, setError] = useState<string | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible"
  );
  const activeControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(
    (silent = false) => {
      const auth = loadAuth();
      if (!auth) return Promise.resolve();

      if (!silent) {
        setLoading(true);
      }

      const endpoint = queryString ? `/api/issues/department?${queryString}` : "/api/issues/department";
      activeControllerRef.current?.abort();
      const controller = new AbortController();
      activeControllerRef.current = controller;

      return authFetch(endpoint, { method: "GET", signal: controller.signal }, auth.token)
        .then((data: unknown) => {
          if (controller.signal.aborted) return;

          const payload = normalizePayload(data);
          const latest = payload.issues;

          setIssues(latest);
          setMeta({
            totalItems: payload.totalItems,
            totalPages: payload.totalPages,
            currentPage: payload.currentPage,
            limit: payload.limit,
          });
          writeCachedIssues(scopedCacheKey, payload);
          setError(null);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || isAbortError(err)) {
            return;
          }

          if (!silent) {
            const message = err instanceof Error ? err.message : "Failed to load issues";
            setError(message);
          }
        })
        .finally(() => {
          if (activeControllerRef.current === controller) {
            activeControllerRef.current = null;
          }

          if (!silent) {
            setLoading(false);
          }
        });
    },
    [queryString, scopedCacheKey]
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      setIsTabVisible(visible);
      if (visible) {
        void load(true);
      }
    };

    window.addEventListener("visibilitychange", onVisibilityChange);
    return () => window.removeEventListener("visibilitychange", onVisibilityChange);
  }, [load]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      load();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      activeControllerRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth || !enablePolling || pollIntervalMs <= 0 || !isTabVisible) return;

    const intervalId = window.setInterval(() => {
      load(true);
    }, pollIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [enablePolling, pollIntervalMs, load, isTabVisible]);

  return {
    issues,
    meta,
    loading,
    error,
    setError,
    reload: load,
  };
}

function readCachedIssues(key: string, ttlMs: number) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; payload: StaffIssuesPayload };
    if (!parsed.timestamp || !parsed.payload || !Array.isArray(parsed.payload.issues)) return null;
    if (Date.now() - parsed.timestamp > ttlMs) return null;
    return normalizePayload(parsed.payload);
  } catch {
    return null;
  }
}

function writeCachedIssues(key: string, payload: StaffIssuesPayload) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), payload }));
  } catch {
    // ignore storage failures
  }
}

type StaffIssuesPayload = {
  issues: StaffIssue[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  limit: number;
};

function normalizePayload(data: unknown): StaffIssuesPayload {
  const payload = (data || {}) as Partial<StaffIssuesPayload>;
  const issues = Array.isArray(payload.issues) ? payload.issues : [];
  const limit = toPositiveInt(payload.limit, issues.length || 10);
  const totalItems = toPositiveInt(payload.totalItems, issues.length);
  const totalPages = toPositiveInt(payload.totalPages, Math.max(1, Math.ceil(totalItems / Math.max(limit, 1))));
  const currentPage = toPositiveInt(payload.currentPage, 1);

  return {
    issues,
    totalItems,
    totalPages,
    currentPage,
    limit,
  };
}

function toPositiveInt(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function buildQueryString(query?: StaffIssueQuery) {
  if (!query) return "";

  const params = new URLSearchParams();

  if (query.page && query.page > 0) {
    params.set("page", String(Math.floor(query.page)));
  }

  if (query.limit && query.limit > 0) {
    params.set("limit", String(Math.floor(query.limit)));
  }

  if (query.search && query.search.trim()) {
    params.set("search", query.search.trim());
  }

  if (query.status && query.status !== "All") {
    params.set("status", query.status);
  }

  if (query.priority && query.priority !== "All") {
    params.set("priority", query.priority);
  }

  if (query.sortBy) {
    params.set("sortBy", query.sortBy);
  }

  return params.toString();
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
