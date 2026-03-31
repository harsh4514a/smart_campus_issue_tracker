"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, MapPin, Paperclip, Sparkles, Tag, X } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { authFetch, loadAuth } from "@/lib/client-auth";
import { formatDateTime, getNextBestAction, getSlaMeta } from "@/components/staff/issue-utils";
import {
  SlaPill,
  StaffEmptyState,
  StaffListSkeleton,
  StaffPriorityBadge,
  StaffStatusBadge,
  TimeIndicator,
} from "@/components/staff/staff-ui";
import { StaffIssue } from "@/components/staff/useStaffIssues";

type Issue = {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  attachments?: string[];
  resolutionAttachments?: string[];
  category: string;
  status: "Pending" | "In Progress" | "Resolved" | "Rejected";
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
  location?: string;
  priority?: "Low" | "Medium" | "High" | "Urgent" | null;
  assignedStaff?: { _id?: string; name?: string; email?: string } | null;
  department?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
  serviceDepartment?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
  academicDepartment?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
};

type AuditLog = {
  _id: string;
  action: string;
  timestamp?: string;
  performedBy?: {
    name?: string;
    role?: string;
  };
};

const STATUS_OPTIONS: Array<"Pending" | "In Progress" | "Resolved"> = ["Pending", "In Progress", "Resolved"];

export default function StaffIssueDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const issueId = params?.id;
  const { showToast } = useToast();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [statusDraft, setStatusDraft] = useState<Issue["status"]>("Pending");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const issueAsStaffIssue = useMemo<StaffIssue | null>(() => {
    if (!issue) return null;
    return {
      _id: issue._id,
      title: issue.title,
      description: issue.description,
      category: issue.category,
      status: issue.status,
      location: issue.location,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      dueDate: issue.dueDate,
      priority: issue.priority,
      student: issue.assignedStaff ? undefined : undefined,
      assignedStaff: issue.assignedStaff,
      department: issue.department,
      serviceDepartment: issue.serviceDepartment,
      academicDepartment: issue.academicDepartment,
    };
  }, [issue]);

  const slaMeta = useMemo(() => (issueAsStaffIssue ? getSlaMeta(issueAsStaffIssue) : null), [issueAsStaffIssue]);
  const nextBestAction = useMemo(() => (issueAsStaffIssue ? getNextBestAction(issueAsStaffIssue) : ""), [issueAsStaffIssue]);

  const reportedAttachmentUrls = useMemo(() => {
    if (!issue) return [];
    return Array.from(
      new Set(
        [issue.imageUrl, ...(issue.attachments || [])].filter(
          (value): value is string => typeof value === "string" && value.length > 0
        )
      )
    );
  }, [issue]);

  const resolutionAttachmentUrls = useMemo(() => {
    if (!issue) return [];
    return Array.from(
      new Set(
        (issue.resolutionAttachments || []).filter(
          (value): value is string => typeof value === "string" && value.length > 0
        )
      )
    );
  }, [issue]);

  useEffect(() => {
    if (!issueId) return;
    const auth = loadAuth();
    if (!auth) return;

    setLoading(true);
    authFetch(`/api/issues/department/${issueId}`, { method: "GET" }, auth.token)
      .then(async (data) => {
        const fetchedIssue = data.issue as Issue;
        setIssue(fetchedIssue);
        setStatusDraft(fetchedIssue.status);
        try {
          const audit = await authFetch(`/api/issues/${issueId}/audit`, { method: "GET" }, auth.token);
          setAuditLogs((audit.logs || []) as AuditLog[]);
        } catch {
          setAuditLogs([]);
        }
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
    if (!issue?.dueDate) return "—";
    const due = new Date(issue.dueDate);
    if (Number.isNaN(due.getTime())) return "—";
    return due.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }, [issue?.dueDate]);

  const timelineItems = useMemo(() => {
    if (!issue) return [];

    if (auditLogs.length > 0) {
      return auditLogs.slice(0, 8).map((log) => ({
        title: log.action,
        meta: `${log.performedBy?.name || "System"} • ${formatDateTime(log.timestamp || "")}`,
        tone: getTimelineTone(log.action),
      }));
    }

    const items: Array<{ title: string; meta: string; tone: "default" | "success" | "warning" }> = [];

    items.push({
      title: "Issue reported",
      meta: issue.createdAt ? formatDateTime(issue.createdAt) : "Unknown date",
      tone: "default",
    });

    items.push({
      title: `Current status: ${issue.status}`,
      meta: issue.updatedAt ? `Updated ${timeAgo(issue.updatedAt)}` : "No recent update",
      tone: issue.status === "Resolved" ? "success" : "warning",
    });

    if (issue.priority) {
      items.push({
        title: `Priority set to ${issue.priority}`,
        meta: issue.updatedAt ? formatDateTime(issue.updatedAt) : "Latest record",
        tone: issue.priority === "High" || issue.priority === "Urgent" ? "warning" : "default",
      });
    }

    return items;
  }, [auditLogs, issue]);

  const handleStatusUpdate = async (targetStatus?: Issue["status"]) => {
    if (!issue) return;
    const auth = loadAuth();
    if (!auth) return;

    const nextStatus = targetStatus || statusDraft;

    setSaving(true);
    try {
      await authFetch(
        `/api/issues/${issue._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        },
        auth.token
      );

      const updatedIssue = { ...issue, status: nextStatus, updatedAt: new Date().toISOString() };
      setIssue(updatedIssue);
      setStatusDraft(nextStatus);
      showToast({ title: "Status updated", message: `Issue moved to ${nextStatus}.`, variant: "success" });
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      setError(message);
      showToast({ title: "Update failed", message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {loading ? <StaffListSkeleton rows={4} /> : null}
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
              <StaffStatusBadge status={issue.status} />
              <StaffPriorityBadge priority={issue.priority} />
              {slaMeta ? <SlaPill meta={slaMeta} /> : null}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-2">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">Deadline Status</h3>
                  </div>
                  {issueAsStaffIssue && slaMeta ? <TimeIndicator issue={issueAsStaffIssue} meta={slaMeta} /> : null}
                </section>

                <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-700" />
                    <h3 className="text-lg font-semibold text-emerald-900">Next Best Action</h3>
                  </div>
                  <p className="text-sm text-emerald-900">{nextBestAction}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate("In Progress")}
                      disabled={saving || issue.status !== "Pending"}
                      className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Start Work
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate("Resolved")}
                      disabled={saving || issue.status === "Resolved" || issue.status === "Rejected"}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Resolve
                    </button>
                    <Link
                      href="/staff/issues"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Back to Queue
                    </Link>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Description</h3>
                  <p className="mt-3 text-slate-700">{issue.description || "No description provided."}</p>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-slate-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Attachments</h3>
                  </div>

                  {reportedAttachmentUrls.length === 0 && resolutionAttachmentUrls.length === 0 ? (
                    <StaffEmptyState
                      title="No attachments"
                      description="No reported or resolution attachments are available for this issue."
                    />
                  ) : (
                    <div className="space-y-4">
                      {reportedAttachmentUrls.length > 0 ? (
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Reported Attachments</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {reportedAttachmentUrls.map((src) => (
                              <button
                                key={src}
                                type="button"
                                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                                onClick={() => setLightboxImage(src)}
                              >
                                <Image
                                  src={src}
                                  alt="Reported attachment"
                                  width={600}
                                  height={360}
                                  unoptimized
                                  className="h-28 w-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {resolutionAttachmentUrls.length > 0 ? (
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Resolution Attachments</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {resolutionAttachmentUrls.map((src) => (
                              <button
                                key={src}
                                type="button"
                                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                                onClick={() => setLightboxImage(src)}
                              >
                                <Image
                                  src={src}
                                  alt="Resolution attachment"
                                  width={600}
                                  height={360}
                                  unoptimized
                                  className="h-28 w-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Update Issue</h3>

                  {issue.status === "Rejected" ? (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      This issue is rejected. Only admins can change rejected issues.
                    </p>
                  ) : (
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
                        onClick={() => handleStatusUpdate()}
                        disabled={saving || statusDraft === issue.status}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? "Updating..." : "Update Status"}
                      </button>
                    </div>
                  )}
                </section>
              </div>

              <div className="space-y-4 xl:col-span-1">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Information</h3>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <InfoItem icon={<MapPin className="h-4 w-4" />} label="Location" value={issue.location || "—"} />
                    <InfoItem icon={<Tag className="h-4 w-4" />} label="Category" value={issue.category} />
                    <InfoItem
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Created"
                      value={issue.createdAt ? formatDateTime(issue.createdAt) : "—"}
                    />
                    <InfoItem icon={<Clock3 className="h-4 w-4" />} label="Due Date" value={dueDate} />
                    <InfoItem icon={<Clock3 className="h-4 w-4" />} label="Department" value={departmentName} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Timeline</h3>
                  <div className="mt-4">
                    {timelineItems.length === 0 ? (
                      <p className="text-sm text-slate-500">No timeline entries available yet.</p>
                    ) : (
                      <div className="space-y-0">
                        {timelineItems.map((item, index) => (
                          <div key={`${item.title}-${index}`} className="relative pl-6">
                            {index < timelineItems.length - 1 ? (
                              <span className="absolute left-1.75 top-4 h-[calc(100%-10px)] w-px bg-slate-200" />
                            ) : null}
                            <span
                              className={`absolute left-0 top-2.5 h-3.5 w-3.5 rounded-full border-2 bg-white ${
                                item.tone === "success"
                                  ? "border-emerald-500"
                                  : item.tone === "warning"
                                    ? "border-amber-500"
                                    : "border-slate-400"
                              }`}
                            />
                            <div className="pb-4">
                              <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                              <p className="text-xs text-slate-500">{item.meta}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
      ) : null}

      {lightboxImage ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 px-4" onClick={() => setLightboxImage(null)}>
          <div className="max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-end border-b border-slate-200 px-3 py-2">
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                aria-label="Close image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-slate-50 p-3">
              <Image
                src={lightboxImage}
                alt="Issue attachment preview"
                width={1600}
                height={1000}
                unoptimized
                className="max-h-[75vh] w-full object-contain"
              />
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

function getTimelineTone(action: string): "default" | "success" | "warning" {
  const normalized = action.trim().toLowerCase();
  if (normalized.includes("resolved") || normalized.includes("closed")) return "success";
  if (normalized.includes("priority") || normalized.includes("overdue") || normalized.includes("rejected")) return "warning";
  return "default";
}
