"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarDays, Eye, MapPin, Search } from "lucide-react";
import { authFetch, loadAuth } from "@/lib/client-auth";
import { StaffIssue, useStaffIssues } from "@/components/staff/useStaffIssues";

const nextStatus: Record<StaffIssue["status"], StaffIssue["status"]> = {
  Pending: "In Progress",
  "In Progress": "Resolved",
  Resolved: "Resolved",
};

export default function StaffIssuesPage() {
  const searchParams = useSearchParams();
  const { issues, loading, error, setError, reload } = useStaffIssues();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | StaffIssue["status"]>("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | "Low" | "Medium" | "High" | "Urgent" | "No Priority">("All");

  useEffect(() => {
    const statusQuery = searchParams.get("status");
    if (!statusQuery) return;

    const normalized = decodeURIComponent(statusQuery).trim().toLowerCase();
    if (normalized === "pending") {
      setStatusFilter("Pending");
      return;
    }

    if (normalized === "in progress") {
      setStatusFilter("In Progress");
      return;
    }

    if (normalized === "resolved") {
      setStatusFilter("Resolved");
    }
  }, [searchParams]);

  const filteredIssues = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return issues.filter((issue) => {
      const statusMatch = statusFilter === "All" || issue.status === statusFilter;
      if (!statusMatch) return false;

      const priorityMatch =
        priorityFilter === "All"
          ? true
          : priorityFilter === "No Priority"
            ? !issue.priority
            : issue.priority === priorityFilter;

      if (!priorityMatch) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        issue.title,
        issue.description,
        issue.category,
        issue.location,
        issue.student?.name,
        issue.student?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [issues, searchQuery, statusFilter, priorityFilter]);

  const handleUpdate = async (issue: StaffIssue) => {
    const auth = loadAuth();
    if (!auth) return;

    setUpdatingId(issue._id);
    try {
      const status = nextStatus[issue.status];
      await authFetch(
        `/api/issues/${issue._id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
        auth.token
      );
      await reload(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <label className="relative block md:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search issues by title, category, location..."
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "All" | StaffIssue["status"])}
                className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(
                    event.target.value as "All" | "Low" | "Medium" | "High" | "Urgent" | "No Priority"
                  )
                }
                className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="All">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
                <option value="No Priority">No Priority</option>
              </select>
            </div>
          </section>

          {loading && issues.length === 0 ? <div className="text-sm text-slate-600">Loading issues...</div> : null}
          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          {!loading && !error && filteredIssues.length === 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              No issues found for the current filters.
            </section>
          ) : null}

          {!loading && !error && filteredIssues.length > 0 ? (
            <section className="space-y-3">
              {filteredIssues.map((issue) => (
                <article
                  key={issue._id}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900">{issue.title}</h3>
                      <p className="mt-1 truncate text-sm text-slate-500">{issue.description || issue.location || "No additional details"}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {issue.location || "—"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(issue.createdAt)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{issue.category}</span>
                        {issue.priority ? (
                          <span className="inline-flex items-center gap-1 text-rose-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {issue.priority}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <IssueStatusBadge status={issue.status} />
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/staff/issues/${issue._id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleUpdate(issue)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={updatingId === issue._id || issue.status === "Resolved"}
                        >
                          {updatingId === issue._id
                            ? "Updating..."
                            : issue.status === "Resolved"
                              ? "Resolved"
                              : "Advance Status"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
    </div>
  );
}

function IssueStatusBadge({ status }: { status: StaffIssue["status"] }) {
  const classes =
    status === "Resolved"
      ? "bg-green-100 text-green-700"
      : status === "In Progress"
        ? "bg-blue-100 text-blue-700"
        : "bg-amber-100 text-amber-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
