"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, MapPin, Tag } from "lucide-react";
import { authFetch, loadAuth } from "@/lib/client-auth";

type Issue = {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  category: string;
  status: "Pending" | "In Progress" | "Resolved";
  createdAt?: string;
  updatedAt?: string;
  location?: string;
  priority?: "Low" | "Medium" | "High" | "Urgent" | null;
  assignedStaff?: { _id?: string; name?: string; email?: string } | null;
  department?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
  serviceDepartment?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
  academicDepartment?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
};

const STATUS_OPTIONS: Issue["status"][] = ["Pending", "In Progress", "Resolved"];

export default function StaffIssueDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const issueId = params?.id;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [statusDraft, setStatusDraft] = useState<Issue["status"]>("Pending");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!issueId) return;
    const auth = loadAuth();
    if (!auth) return;

    setLoading(true);
    authFetch(`/api/issues/department/${issueId}`, { method: "GET" }, auth.token)
      .then((data) => {
        const fetchedIssue = data.issue as Issue;
        setIssue(fetchedIssue);
        setStatusDraft(fetchedIssue.status);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load issue details");
      })
      .finally(() => setLoading(false));
  }, [issueId]);

  const departmentName = useMemo(() => {
    if (!issue) return "—";
    return issue.serviceDepartment?.name || issue.academicDepartment?.name || issue.department?.name || "—";
  }, [issue]);

  const dueDate = useMemo(() => {
    if (!issue?.createdAt) return "—";
    const created = new Date(issue.createdAt);
    if (Number.isNaN(created.getTime())) return "—";
    const due = new Date(created.getTime() + 8 * 24 * 60 * 60 * 1000);
    return due.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }, [issue?.createdAt]);

  const timelineItems = useMemo(() => {
    if (!issue) return [];
    const items: Array<{ title: string; meta: string }> = [];

    items.push({
      title: "Issue reported",
      meta: issue.createdAt ? formatDateTime(issue.createdAt) : "Unknown date",
    });

    items.push({
      title: `Current status: ${issue.status}`,
      meta: issue.updatedAt ? `Updated ${timeAgo(issue.updatedAt)}` : "No recent update",
    });

    if (issue.priority) {
      items.push({
        title: `Priority set to ${issue.priority}`,
        meta: issue.updatedAt ? formatDateTime(issue.updatedAt) : "Latest record",
      });
    }

    return items;
  }, [issue]);

  const handleStatusUpdate = async () => {
    if (!issue) return;
    const auth = loadAuth();
    if (!auth) return;

    setSaving(true);
    try {
      await authFetch(
        `/api/issues/${issue._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: statusDraft }),
        },
        auth.token
      );

      const updatedIssue = { ...issue, status: statusDraft, updatedAt: new Date().toISOString() };
      setIssue(updatedIssue);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {loading ? <div className="text-sm text-slate-600">Loading issue details...</div> : null}
      {error ? <div className="mb-4 text-sm text-rose-600">{error}</div> : null}

        {!loading && issue ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <h2 className="text-2xl font-semibold text-slate-900">{issue.title}</h2>
              <IssueStatusBadge status={issue.status} />
              {issue.priority ? <PriorityBadge priority={issue.priority} /> : null}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-2">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Description</h3>
                  <p className="mt-3 text-slate-700">{issue.description || "No description provided."}</p>
                </section>

                {issue.imageUrl ? (
                  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">Reported Photo</h3>
                    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <Image
                        src={issue.imageUrl}
                        alt="Issue attachment"
                        width={1200}
                        height={800}
                        unoptimized
                        className="max-h-105 w-full object-contain"
                      />
                    </div>
                  </section>
                ) : null}

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Update Issue</h3>
                  <div className="mt-4 max-w-sm space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                      <select
                        value={statusDraft}
                        onChange={(event) => setStatusDraft(event.target.value as Issue["status"])}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={handleStatusUpdate}
                      disabled={saving || statusDraft === issue.status}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Updating..." : "Update Status"}
                    </button>
                  </div>
                </section>
              </div>

              <div className="space-y-4 xl:col-span-1">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Information</h3>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <InfoItem icon={<MapPin className="h-4 w-4" />} label="Location" value={issue.location || "—"} />
                    <InfoItem icon={<Tag className="h-4 w-4" />} label="Category" value={issue.category} />
                    <InfoItem icon={<CalendarDays className="h-4 w-4" />} label="Created" value={formatDateTime(issue.createdAt)} />
                    <InfoItem icon={<Clock3 className="h-4 w-4" />} label="Due Date" value={dueDate} />
                    <InfoItem icon={<Clock3 className="h-4 w-4" />} label="Department" value={departmentName} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Timeline</h3>
                  <div className="mt-4 space-y-3">
                    {timelineItems.map((item, index) => (
                      <div key={`${item.title}-${index}`} className="flex gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{item.title}</p>
                          <p className="text-xs text-slate-500">{item.meta}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
      ) : null}
    </>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <div className="mt-0.5 text-slate-500">{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function IssueStatusBadge({ status }: { status: Issue["status"] }) {
  const classes =
    status === "Resolved"
      ? "bg-green-100 text-green-700"
      : status === "In Progress"
        ? "bg-blue-100 text-blue-700"
        : "bg-amber-100 text-amber-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: NonNullable<Issue["priority"]> }) {
  const classes =
    priority === "Urgent" || priority === "High"
      ? "bg-rose-100 text-rose-700"
      : priority === "Medium"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-slate-100 text-slate-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{priority}</span>;
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "recently";

  const diffMs = Date.now() - time;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) return `${Math.max(diffMinutes, 1)} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}
