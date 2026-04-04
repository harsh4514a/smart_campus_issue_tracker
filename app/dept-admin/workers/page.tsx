"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCcw } from "lucide-react";
import DeptAdminShell from "@/components/dept-admin/DeptAdminShell";
import { authFetch, loadAuth } from "@/lib/client-auth";
import { useToast } from "@/components/ToastProvider";

type Department = { _id: string; name: string; type?: string };
const MAX_CAPACITY = 5;

type Worker = {
  _id: string;
  name: string;
  email: string;
  department?: { _id?: string; name?: string } | null;
  activeIssues: number;
  pendingIssues: number;
  resolvedCount: number;
  loadStatus: "Available" | "Moderate" | "Overloaded";
  lastActiveAt?: string | null;
};

export default function DeptAdminWorkersPage() {
  const auth = useMemo(() => loadAuth(), []);
  const { showToast } = useToast();

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("all");
  const [sort, setSort] = useState<"name" | "load_asc" | "load_desc">("load_asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  const getWorkloadMeta = (activeIssues: number) => {
    const ratio = Math.min(1, Math.max(0, activeIssues / MAX_CAPACITY));
    const percent = ratio * 100;
    const barColor = percent >= 85 ? "bg-red-500" : percent >= 60 ? "bg-amber-500" : "bg-green-500";

    if (activeIssues <= 0) {
      return { statusLabel: "Available", badgeClass: "bg-green-100 text-green-700", barColor, ratio };
    }
    if (activeIssues <= 3) {
      return { statusLabel: "Moderate", badgeClass: "bg-amber-100 text-amber-700", barColor, ratio };
    }
    if (activeIssues === 4) {
      return { statusLabel: "Busy", badgeClass: "bg-orange-100 text-orange-700", barColor, ratio };
    }

    return { statusLabel: "Overloaded", badgeClass: "bg-red-100 text-red-700", barColor, ratio };
  };

  const getLastActiveLabel = (value?: string | null) => {
    if (!value) return "No recent activity";
    const ts = new Date(value).getTime();
    if (Number.isNaN(ts)) return "No recent activity";
    const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (diffMin < 60) return `${diffMin}m ago`;
    const hours = Math.floor(diffMin / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const loadWorkers = async (notifySuccess = false) => {
    if (!auth) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (departmentId !== "all") params.set("departmentId", departmentId);
      params.set("sort", sort);

      const res = await authFetch(`/api/workers?${params.toString()}`, { method: "GET" }, auth.token);
      setWorkers((res.workers || []) as Worker[]);
      setDepartments((res.departments || []) as Department[]);
      if (notifySuccess) {
        showToast({ title: "Workers Updated", message: "Latest worker insights loaded.", variant: "success" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load workers";
      setError(message);
      showToast({ title: "Load Failed", message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, departmentId, sort]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, departmentId, sort]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(workers.length / pageSize)), [workers.length, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedWorkers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return workers.slice(start, start + pageSize);
  }, [workers, currentPage, pageSize]);

  return (
    <DeptAdminShell title="Workers" subtitle="View and monitor department workers">
      <div className="space-y-4">
        <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
          >
            <option value="all">All Departments</option>
            {departments.map((department) => (
              <option key={department._id} value={department._id}>
                {department.name}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as "name" | "load_asc" | "load_desc")}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
          >
            <option value="load_asc">Least Busy First</option>
            <option value="load_desc">Most Busy First</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </section>

        {loading ? <WorkersSkeleton /> : null}

        {!loading && error ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
            <p className="text-sm font-semibold text-rose-700">Failed to load workers</p>
            <p className="mt-1 text-sm text-rose-600">{error}</p>
            <button
              type="button"
              onClick={() => {
                void loadWorkers(true);
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              <RefreshCcw className="h-4 w-4" /> Retry
            </button>
          </section>
        ) : null}

        {!loading && !error && workers.length === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">No workers available in your department</p>
            <p className="mt-1 text-sm text-slate-500">Contact Super Admin to add workers</p>
          </section>
        ) : null}

        {!loading && !error && workers.length > 0 ? (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Department</th>
                    <th className="px-4 py-3 text-left">Workload</th>
                    <th className="px-4 py-3 text-left">Active Issues</th>
                    <th className="px-4 py-3 text-left">Pending Issues</th>
                    <th className="px-4 py-3 text-left">Resolved Issues</th>
                    <th className="px-4 py-3 text-left">Last Active</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedWorkers.map((worker) => {
                    const workload = getWorkloadMeta(worker.activeIssues);

                    return (
                    <tr key={worker._id} className="border-t border-slate-100 transition hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{worker.name}</td>
                      <td className="px-4 py-3 text-slate-600">{worker.email}</td>
                      <td className="px-4 py-3 text-slate-600">{worker.department?.name || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${workload.badgeClass}`}>
                            {workload.statusLabel}
                          </span>
                          <div className="h-1.5 w-16 rounded-full bg-gray-200">
                            <div className={`h-1.5 rounded-full ${workload.barColor}`} style={{ width: `${Math.max(0, workload.ratio * 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">
                            {worker.activeIssues}/{MAX_CAPACITY}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {worker.activeIssues > 0 ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">{worker.activeIssues}</span>
                        ) : (
                          <span className="text-sm text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {worker.pendingIssues > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{worker.pendingIssues}</span>
                        ) : (
                          <span className="text-sm text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{worker.resolvedCount}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{getLastActiveLabel(worker.lastActiveAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/dept-admin/issues?workerId=${worker._id}&status=Assigned`}
                            className="rounded-md border border-sky-200 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                          >
                            View Assigned Issues
                          </Link>
                          <Link
                            href={`/dept-admin/workers/${worker._id}`}
                            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            View Profile
                          </Link>
                          <Link
                            href={`/dept-admin/issues?unassignedOnly=1&workerId=${worker._id}`}
                            className="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            Assign Issue
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing {workers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                -{Math.min(currentPage * pageSize, workers.length)} of {workers.length} workers
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={String(pageSize)}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
                >
                  <option value="10">10 / page</option>
                  <option value="20">20 / page</option>
                  <option value="50">50 / page</option>
                </select>

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </DeptAdminShell>
  );
}

function WorkersSkeleton() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="skeleton-shimmer mb-3 h-8 w-44 rounded bg-slate-200" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="skeleton-shimmer h-10 rounded bg-slate-100" />
        ))}
      </div>
    </section>
  );
}
