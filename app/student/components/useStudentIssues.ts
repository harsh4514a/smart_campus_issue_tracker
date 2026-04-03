"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch, loadAuth } from "@/lib/client-auth";

export type StudentIssue = {
  _id: string;
  title?: string;
  description?: string;
  category: string;
  status: "Pending" | "In Progress" | "Resolved" | "Rejected" | string;
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
  location?: string;
  imageUrl?: string | null;
};

type UseStudentIssuesOptions = {
  cacheKey?: string;
  cacheTtlMs?: number;
  pollIntervalMs?: number;
  enablePolling?: boolean;
};

export function useStudentIssues(options: UseStudentIssuesOptions = {}) {
  const cacheKey = options.cacheKey ?? "scit_student_issues";
  const cacheTtlMs = options.cacheTtlMs ?? 2 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 15 * 1000;
  const enablePolling = options.enablePolling ?? true;

  const cachedIssues = useMemo(() => readCachedIssues(cacheKey, cacheTtlMs), [cacheKey, cacheTtlMs]);
  const [issues, setIssues] = useState<StudentIssue[]>(() => cachedIssues || []);
  const [loading, setLoading] = useState(() => !cachedIssues);
  const [error, setError] = useState<string | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible"
  );

  const activeControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(
    (silent = false) => {
      const auth = loadAuth();
      if (!auth) {
        setIssues([]);
        setLoading(false);
        return Promise.resolve();
      }

      if (!silent) {
        setLoading(true);
      }

      activeControllerRef.current?.abort();
      const controller = new AbortController();
      activeControllerRef.current = controller;

      return authFetch("/api/issues/mine", { method: "GET", signal: controller.signal }, auth.token)
        .then((data: unknown) => {
          if (controller.signal.aborted) return;

          const payload = (data || {}) as { issues?: StudentIssue[] };
          const latest = Array.isArray(payload.issues) ? payload.issues : [];
          setIssues(latest);
          writeCachedIssues(cacheKey, latest);
          setError(null);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || isAbortError(err)) return;
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
    [cacheKey]
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      setIsTabVisible(visible);
      if (visible) {
        void load(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [load]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
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
      void load(true);
    }, pollIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [enablePolling, isTabVisible, load, pollIntervalMs]);

  return {
    issues,
    loading,
    error,
    setError,
    reload: load,
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function readCachedIssues(key: string, ttlMs: number) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { timestamp: number; issues: StudentIssue[] };
    if (!parsed.timestamp || !Array.isArray(parsed.issues)) return null;
    if (Date.now() - parsed.timestamp > ttlMs) return null;

    return parsed.issues;
  } catch {
    return null;
  }
}

function writeCachedIssues(key: string, issues: StudentIssue[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), issues }));
  } catch {
    // ignore storage failures
  }
}
