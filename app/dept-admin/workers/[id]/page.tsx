"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import DeptAdminShell from "@/components/dept-admin/DeptAdminShell";
import { authFetch, loadAuth } from "@/lib/client-auth";

type IssueItem = {
  _id: string;
  title: string;
  status: string;
  priority?: string;
  location?: string;
  student?: { name?: string };
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
};

type WorkerDetailResponse = {
  worker: {
    _id: string;
    name: string;
    email: string;
    department?: { _id?: string; name?: string } | null;
    academicDepartment?: { _id?: string; name?: string } | null;
    serviceDepartment?: { _id?: string; name?: string } | null;
  };
  activeIssues: IssueItem[];
  recentlyResolvedIssues: IssueItem[];
  stats: {
    totalAssigned: number;
    totalResolved: number;
    resolutionRate: number | null;
  };
};

export default function DeptAdminWorkerProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <DeptAdminWorkerProfilePageContent />
    </Suspense>
  );
}

function DeptAdminWorkerProfilePageContent() {
  const auth = useMemo(() => loadAuth(), []);
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const workerId = params?.id;
  const preferredTab = searchParams.get("tab") === "issues" ? "issues" : "overview";

  const [data, setData] = useState<WorkerDetailResponse | null>(null);
  const [tab, setTab] = useState<"overview" | "issues">(preferredTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!auth || !workerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/workers/${workerId}`, { method: "GET" }, auth.token);
      setData(res as WorkerDetailResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load worker profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTab(preferredTab);
  }, [preferredTab]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId]);

  const departmentName =
    data?.worker?.academicDepartment?.name ||
    data?.worker?.department?.name ||
    data?.worker?.serviceDepartment?.name ||
    "-";

  return (
    <DeptAdminShell title="Worker Profile" subtitle="Monitor worker workload and resolution performance">
      <div className="space-y-4">
        <Link
          href="/dept-admin/workers"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Workers
        </Link>

        {loading ? <ProfileSkeleton /> : null}

        {!loading && error ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
            <p className="text-sm font-semibold text-rose-700">Failed to load worker profile</p>
            <p className="mt-1 text-sm text-rose-600">{error}</p>
            <button
              type="button"
              onClick={() => {
                void load();
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              <RefreshCcw className="h-4 w-4" /> Retry
            </button>
          </section>
        ) : null}

        {!loading && !error && data ? (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-slate-900">{data.worker.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{data.worker.email}</p>
              <p className="mt-1 text-sm text-slate-500">Serves Department: {departmentName}</p>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard label="Total Assigned" value={data.stats.totalAssigned} />
              <StatCard label="Total Resolved" value={data.stats.totalResolved} />
              <StatCard
                label="Resolution Rate"
                value={
                  data.stats.totalAssigned > 0 && data.stats.resolutionRate !== null
                    ? `${data.stats.resolutionRate}%`
                    : "N/A"
                }
              />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab("overview")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    tab === "overview"
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setTab("issues")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    tab === "issues"
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Assigned Issues
                </button>
              </div>

              {tab === "overview" ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <IssueListCard
                    title="Active Issues"
                    issues={data.activeIssues}
                    emptyMessage="No active issues for this worker."
                  />
                  <IssueListCard
                    title="Recently Resolved Issues"
                    issues={data.recentlyResolvedIssues}
                    emptyMessage="No recently resolved issues."
                  />
                </div>
              ) : (
                <IssueListCard
                  title="Assigned Active Issues"
                  issues={data.activeIssues}
                  emptyMessage="No active assigned issues."
                />
              )}
            </section>
          </>
        ) : null}
      </div>
    </DeptAdminShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </article>
  );
}

function IssueListCard({ title, issues, emptyMessage }: { title: string; issues: IssueItem[]; emptyMessage: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-3 space-y-2">
        {issues.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          issues.map((issue) => (
            <div key={issue._id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <p className="font-medium text-slate-800">{issue.title}</p>
              <p className="mt-1 text-xs text-slate-600">
                ID: #{issue._id.slice(-6)} • {issue.student?.name || issue.location || "No student/location"}
              </p>
              <p className="text-xs text-slate-500">
                {issue.status} • {issue.priority || "-"} • {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : "-"}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <div className="skeleton-shimmer h-6 w-2/3 rounded bg-slate-200" />
      <div className="skeleton-shimmer h-4 w-1/2 rounded bg-slate-100" />
      <div className="skeleton-shimmer h-4 w-1/3 rounded bg-slate-100" />
      <div className="skeleton-shimmer h-36 rounded bg-slate-100" />
    </section>
  );
}
