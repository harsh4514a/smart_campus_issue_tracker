"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch, loadAuth } from "@/lib/client-auth";

export type StaffIssue = {
  _id: string;
  title: string;
  description?: string;
  category: string;
  status: "Pending" | "In Progress" | "Resolved";
  location?: string;
  createdAt?: string;
  priority?: "Low" | "Medium" | "High" | "Urgent" | null;
  student?: { name?: string; email?: string };
  assignedStaff?: { _id?: string; name?: string; email?: string } | null;
  department?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
  serviceDepartment?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
  academicDepartment?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
};

type UseStaffIssuesOptions = {
  cacheKey?: string;
  cacheTtlMs?: number;
  pollIntervalMs?: number;
};

export function useStaffIssues(options: UseStaffIssuesOptions = {}) {
  const cacheKey = options.cacheKey ?? "scit_staff_issues";
  const cacheTtlMs = options.cacheTtlMs ?? 2 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 10000;

  const cachedIssues = useMemo(() => readCachedIssues(cacheKey, cacheTtlMs), [cacheKey, cacheTtlMs]);

  const [issues, setIssues] = useState<StaffIssue[]>(() => cachedIssues || []);
  const [loading, setLoading] = useState(() => !cachedIssues);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (silent = false) => {
      const auth = loadAuth();
      if (!auth) return Promise.resolve();

      if (!silent) {
        setLoading(true);
      }

      return authFetch("/api/issues/department", { method: "GET" }, auth.token)
        .then((data) => {
          const latest = (data.issues || []) as StaffIssue[];
          setIssues(latest);
          writeCachedIssues(cacheKey, latest);
          setError(null);
        })
        .catch((err: unknown) => {
          if (!silent) {
            const message = err instanceof Error ? err.message : "Failed to load issues";
            setError(message);
          }
        })
        .finally(() => {
          if (!silent) {
            setLoading(false);
          }
        });
    },
    [cacheKey]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      load();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth) return;

    const intervalId = window.setInterval(() => {
      load(true);
    }, pollIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [pollIntervalMs, load]);

  return {
    issues,
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
    const parsed = JSON.parse(raw) as { timestamp: number; issues: StaffIssue[] };
    if (!parsed.timestamp || !Array.isArray(parsed.issues)) return null;
    if (Date.now() - parsed.timestamp > ttlMs) return null;
    return parsed.issues;
  } catch {
    return null;
  }
}

function writeCachedIssues(key: string, issues: StaffIssue[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), issues }));
  } catch {
    // ignore storage failures
  }
}
