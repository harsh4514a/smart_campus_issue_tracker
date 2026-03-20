"use client";

import { useEffect, useState } from "react";
import AdminProtected from "@/components/AdminProtected";
import { authFetch, loadAuth } from "@/lib/client-auth";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  LoaderCircle,
  UserCheck,
  Users2,
} from "lucide-react";

type Stats = {
  students: number;
  faculty: number;
  staff: number;
  departments: number;
  issues: number;
  pending: number;
  inProgress: number;
  assigned: number;
  resolved: number;
  needsAttention?: {
    unassigned: number;
    overdue: number;
  };
  insights?: {
    topDepartment: { name: string; count: number } | null;
  };
};

const POLL_INTERVAL_MS = 10000;

export default function AdminDashboard() {
  const cacheKey = "scit_admin_stats";
  const cacheTtlMs = 2 * 60 * 1000;
  const cachedStats = readCachedStats(cacheKey, cacheTtlMs);
  const [stats, setStats] = useState<Stats | null>(() => cachedStats || null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !cachedStats);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth) return;
    authFetch("/api/admin/stats", { method: "GET" }, auth.token)
      .then((data) => {
        setStats(data);
        writeCachedStats(cacheKey, data);
      })
      .catch((err) => setError(err.message || "Failed to load stats"))
      .finally(() => setLoading(false));
  }, [cacheKey, cacheTtlMs]);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth) return;

    const intervalId = window.setInterval(() => {
      authFetch("/api/admin/stats", { method: "GET" }, auth.token)
        .then((data) => {
          setStats(data);
          writeCachedStats(cacheKey, data);
          setError(null);
        })
        .catch(() => {
          // keep last rendered data during polling failures
        });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [cacheKey]);

  return (
    <AdminProtected>
      <AdminShell
        title="Admin Dashboard"
        subtitle="Overview of campus issue tracking system"
      >
        <div className="space-y-5">

          {loading && <div className="text-sm text-gray-600">Loading...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}

          {stats && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Issues" value={stats.issues} tone="teal" Icon={FileText} />
              <StatCard
                label="Pending"
                value={stats.pending}
                tone="amber"
                Icon={Clock3}
              />
              <StatCard label="Assigned Issues" value={stats.assigned} tone="indigo" Icon={UserCheck} />
              <StatCard label="In Progress Issues" value={stats.inProgress} tone="purple" Icon={LoaderCircle} />
              <StatCard label="Resolved" value={stats.resolved} tone="green" Icon={CheckCircle2} />
            </div>
          )}

          {stats && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">
                Most reported department: {stats.insights?.topDepartment?.name || "—"}
              </p>
            </section>
          )}

          {stats && (
            <section className="rounded-xl border border-rose-100 bg-rose-50/60 p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <h2 className="text-base font-semibold text-rose-800">Needs Attention</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Link
                  href="/admin/issues?status=Unassigned"
                  className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-sm"
                >
                  <p className="text-sm font-medium text-slate-500">Unassigned Issues</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.needsAttention?.unassigned ?? 0}</p>
                </Link>
                <Link
                  href="/admin/issues?status=Overdue"
                  className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-sm"
                >
                  <p className="text-sm font-medium text-slate-500">Overdue Issues</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.needsAttention?.overdue ?? 0}</p>
                </Link>
              </div>
            </section>
          )}

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-4">
              <QuickAction href="/admin/issues" label="Triage Issues" Icon={ClipboardList} />
              <QuickAction href="/admin/issues?status=Pending" label="View Pending Issues" Icon={Clock3} />
              <QuickAction href="/admin/departments" label="Manage Departments" Icon={Building2} />
              <QuickAction href="/admin/staff" label="Manage Staff" Icon={Users2} />
            </div>
          </section>
        </div>
      </AdminShell>
    </AdminProtected>
  );
}

function StatCard({
  label,
  value,
  tone,
  Icon,
}: {
  label: string;
  value: number;
  tone: "teal" | "amber" | "green" | "blue" | "purple" | "orange" | "indigo";
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const toneClasses: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    orange: "bg-orange-50 text-orange-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between shadow-sm min-h-24">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-3xl leading-none font-semibold text-gray-900">{value}</p>
      </div>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${toneClasses[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function QuickAction({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white px-5 py-5 hover:bg-slate-50 flex flex-col items-center justify-center text-sm font-semibold text-gray-900 gap-2 min-h-24"
    >
      <Icon className="h-6 w-6 text-teal-600" />
      <span>{label}</span>
    </Link>
  );
}

function readCachedStats(key: string, ttlMs: number) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; stats: Stats };
    if (!parsed.timestamp || !parsed.stats) return null;
    if (Date.now() - parsed.timestamp > ttlMs) return null;
    return parsed.stats;
  } catch {
    return null;
  }
}

function writeCachedStats(key: string, stats: Stats) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), stats }));
  } catch {
    // ignore storage failures
  }
}