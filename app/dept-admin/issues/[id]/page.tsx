"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import ConfirmDialog from "@/components/dept-admin/ConfirmDialog";
import DeptAdminShell from "@/components/dept-admin/DeptAdminShell";
import { authFetch, loadAuth } from "@/lib/client-auth";
import { ArrowLeft } from "lucide-react";

type DepartmentLite = { _id?: string; name?: string; type?: "Academic" | "Service" };

type Worker = {
  _id: string;
  name: string;
  email?: string;
  designation?: string | null;
  department?: DepartmentLite | null;
  academicDepartment?: DepartmentLite | null;
  serviceDepartment?: DepartmentLite | null;
  managedDepartments?: DepartmentLite[];
};

type IssueDetails = {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  category?: string;
  location?: string;
  imageUrl?: string | null;
  attachments?: string[];
  resolutionAttachments?: string[];
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
  assignedStaff?: { _id: string; name: string; email?: string } | null;
  student?: { name?: string; email?: string } | null;
  department?: DepartmentLite | null;
  academicDepartment?: DepartmentLite | null;
  serviceDepartment?: DepartmentLite | null;
};

type AuditLog = {
  _id: string;
  action: string;
  timestamp?: string;
  performedBy?: { name?: string };
  newValue?: Record<string, unknown>;
};

type IssuePriority = "Low" | "Medium" | "High" | "Urgent";

const PRIORITY_OPTIONS: IssuePriority[] = ["Low", "Medium", "High", "Urgent"];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  electrical: ["electrical", "electric", "elec"],
  "it support": ["it", "network", "support"],
  "network / internet": ["it", "network", "internet", "wifi"],
  cleaning: ["clean", "housekeep", "janitor"],
  plumbing: ["plumb", "water", "tap"],
  furniture: ["furniture", "carpenter", "desk", "chair"],
};

export default function DeptAdminIssueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const issueId = params?.id;
  const auth = useMemo(() => loadAuth(), []);
  const { showToast } = useToast();

  const [issue, setIssue] = useState<IssueDetails | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [nextStatus, setNextStatus] = useState("In Progress");
  const [nextPriority, setNextPriority] = useState<IssuePriority>("Medium");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  const isClosed = issue?.status === "Resolved" || issue?.status === "Rejected";
  const uploadedImageSources = useMemo(() => getIssueImageSources(issue), [issue]);

  const relatedWorkers = useMemo(() => {
    if (!issue) return [] as Worker[];

    const issueAcademicDepartmentId = String(issue.academicDepartment?._id || "").trim();
    const issueServiceDepartmentId = String(issue.serviceDepartment?._id || "").trim();
    const issueDepartmentId = String(issue.department?._id || "").trim();
    const normalizedCategory = String(issue.category || "").trim().toLowerCase();
    const categoryKeywords = CATEGORY_KEYWORDS[normalizedCategory] || (normalizedCategory ? [normalizedCategory] : []);

    const scoped = workers.filter((worker) => {
      const primaryDepartmentType = String(worker.department?.type || "");
      const primaryDepartmentId = String(worker.department?._id || "");

      const workerAcademicIds = [
        String(worker.academicDepartment?._id || ""),
        primaryDepartmentType === "Academic" ? primaryDepartmentId : "",
        ...(Array.isArray(worker.managedDepartments)
          ? worker.managedDepartments.map((department) => String(department?._id || ""))
          : []),
      ].filter(Boolean);

      const workerServiceIds = [
        String(worker.serviceDepartment?._id || ""),
        primaryDepartmentType === "Service" ? primaryDepartmentId : "",
      ].filter(Boolean);

      const matchesAcademic = issueAcademicDepartmentId ? workerAcademicIds.includes(issueAcademicDepartmentId) : true;
      const matchesService = issueServiceDepartmentId ? workerServiceIds.includes(issueServiceDepartmentId) : true;

      if (issueAcademicDepartmentId && issueServiceDepartmentId) {
        return matchesAcademic && matchesService;
      }

      if (issueAcademicDepartmentId) {
        return matchesAcademic;
      }

      if (issueServiceDepartmentId) {
        return matchesService;
      }

      if (!issueDepartmentId) {
        return true;
      }

      const workerScopeIds = Array.from(new Set([...workerAcademicIds, ...workerServiceIds]));
      return workerScopeIds.includes(issueDepartmentId);
    });

    if (categoryKeywords.length === 0) return scoped;

    return scoped.filter((worker) => {
      const categoryText = [
        String(worker.designation || ""),
        String(worker.department?.name || ""),
        String(worker.academicDepartment?.name || ""),
        String(worker.serviceDepartment?.name || ""),
        ...(Array.isArray(worker.managedDepartments)
          ? worker.managedDepartments.map((department) => String(department?.name || ""))
          : []),
      ]
        .join(" ")
        .toLowerCase();

      return categoryKeywords.some((keyword) => categoryText.includes(keyword));
    });
  }, [issue, workers]);

  const load = async () => {
    if (!auth || !issueId) return;
    setLoading(true);
    try {
      const [issueRes, workersRes] = await Promise.all([
        authFetch(`/api/dept-admin/issues/${issueId}`, { method: "GET" }, auth.token),
        authFetch("/api/dept-admin/workers", { method: "GET" }, auth.token),
      ]);

      setIssue(issueRes.issue || null);
      setLogs(issueRes.logs || []);
      setWorkers(workersRes.workers || []);
      setWorkerId(issueRes.issue?.assignedStaff?._id || "");
      setNextPriority(normalizePriority(issueRes.issue?.priority));
    } catch (err) {
      showToast({ title: "Load Failed", message: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  const assignWorker = async () => {
    if (!auth || !issueId || !workerId) return;
    setSaving(true);
    try {
      const res = await authFetch(
        `/api/dept-admin/issues/${issueId}/assign`,
        { method: "PATCH", body: JSON.stringify({ staffId: workerId }) },
        auth.token
      );
      showToast({ title: "Success", message: res.message || "Assigned", variant: "success" });
      await load();
    } catch (err) {
      showToast({ title: "Assign Failed", message: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async () => {
    if (!auth || !issueId) return;
    if (nextStatus === "Rejected") {
      setShowRejectConfirm(true);
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(
        `/api/dept-admin/issues/${issueId}/status`,
        { method: "PATCH", body: JSON.stringify({ status: nextStatus }) },
        auth.token
      );
      showToast({ title: "Success", message: res.message || "Updated", variant: "success" });
      await load();
    } catch (err) {
      showToast({ title: "Status Failed", message: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const updatePriority = async () => {
    if (!auth || !issueId) return;

    setSaving(true);
    try {
      const res = await authFetch(
        `/api/dept-admin/issues/${issueId}`,
        { method: "PATCH", body: JSON.stringify({ priority: nextPriority }) },
        auth.token
      );
      showToast({ title: "Success", message: res.message || `Priority updated to ${nextPriority}`, variant: "success" });
      await load();
    } catch (err) {
      showToast({ title: "Priority Failed", message: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const confirmReject = async () => {
    if (!auth || !issueId) return;
    setSaving(true);
    try {
      const res = await authFetch(
        `/api/dept-admin/issues/${issueId}/status`,
        { method: "PATCH", body: JSON.stringify({ status: nextStatus }) },
        auth.token
      );
      showToast({ title: "Success", message: res.message || "Updated", variant: "success" });
      setShowRejectConfirm(false);
      await load();
    } catch (err) {
      showToast({ title: "Status Failed", message: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DeptAdminShell title="Issue Details" subtitle="Assign workers, update status, and review timeline">
      <div className="mb-3">
        <button
          type="button"
          onClick={() => router.push("/dept-admin/issues")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="h-6 w-2/3 rounded bg-slate-200" />
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-4 w-4/5 rounded bg-slate-100" />
          <div className="h-24 rounded bg-slate-100" />
        </div>
      ) : !issue ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Issue not found.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{issue.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{issue.description || "No description provided."}</p>
            </div>

            {uploadedImageSources.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-sm font-semibold text-slate-700">Uploaded Images</h3>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {uploadedImageSources.map((src, idx) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${src}-${idx}`}
                        src={toDisplayImageSrc(src)}
                        alt={`Issue attachment ${idx + 1}`}
                        className="h-48 w-full rounded-lg border border-slate-200 object-cover"
                      />
                    ))}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Meta label="Status" value={issue.status} />
              <Meta label="Priority" value={issue.priority || "-"} />
              <Meta label="Department" value={issue.academicDepartment?.name || issue.department?.name || "-"} />
              <Meta label="Student" value={issue.student?.name || "-"} />
              <Meta label="Created" value={issue.createdAt ? new Date(issue.createdAt).toLocaleString() : "-"} />
              <Meta label="Resolved On" value={issue.status === "Resolved" ? formatResolvedAt(issue) : "Not resolved yet"} />
              <Meta label="Assigned To" value={issue.assignedStaff?.name || "Unassigned"} />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-700">Assign / Reassign Worker</h3>
              {relatedWorkers.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No related workers found for this issue. Assignment disabled.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <select value={workerId} onChange={(event) => setWorkerId(event.target.value)} className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500">
                    <option value="">Select worker</option>
                    {relatedWorkers.map((worker) => (
                      <option key={worker._id} value={worker._id}>{worker.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={assignWorker} disabled={!workerId || saving || isClosed || relatedWorkers.length === 0} className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                    Assign
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-700">Update Status</h3>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500">
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <button type="button" onClick={updateStatus} disabled={saving || isClosed} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                  Save Status
                </button>
              </div>
              {isClosed ? <p className="mt-2 text-xs text-slate-500">This issue is closed and can no longer be changed.</p> : null}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-700">Update Priority</h3>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={nextPriority}
                  onChange={(event) => setNextPriority(event.target.value as IssuePriority)}
                  disabled={saving || isClosed}
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-amber-500 disabled:opacity-60"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={updatePriority}
                  disabled={saving || isClosed}
                  className="h-10 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Save Priority
                </button>
              </div>
              {isClosed ? <p className="mt-2 text-xs text-slate-500">Priority can be changed only for open issues.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-700">Activity Timeline</h3>
            <div className="mt-3 space-y-2">
              {logs.length === 0 ? (
                <p className="text-sm text-slate-500">No activity yet.</p>
              ) : (
                logs.map((log) => (
                  <div key={log._id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-700">{log.action}</p>
                    <p className="text-xs text-slate-500">
                      {log.performedBy?.name || "System"} • {log.timestamp ? new Date(log.timestamp).toLocaleString() : "-"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={showRejectConfirm}
        title="Confirm Rejection"
        description="Reject this issue? This will move it to a closed workflow state."
        confirmLabel="Reject"
        tone="warning"
        loading={saving}
        onConfirm={confirmReject}
        onClose={() => {
          if (saving) return;
          setShowRejectConfirm(false);
        }}
      />
    </DeptAdminShell>
  );
}

function formatResolvedAt(issue: IssueDetails) {
  const value = issue.updatedAt || issue.createdAt;
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function normalizePriority(value?: string): IssuePriority {
  if (value === "Low" || value === "Medium" || value === "High" || value === "Urgent") {
    return value;
  }

  return "Medium";
}

function getIssueImageSources(issue: IssueDetails | null) {
  if (!issue) return [] as string[];

  const candidates = [
    issue.imageUrl,
    ...(Array.isArray(issue.attachments) ? issue.attachments : []),
    ...(Array.isArray(issue.resolutionAttachments) ? issue.resolutionAttachments : []),
  ];

  return candidates
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

function toDisplayImageSrc(src: string) {
  if (/^(https?:|data:|blob:)/i.test(src)) {
    return src;
  }

  if (src.startsWith("/")) {
    return src;
  }

  return `/${src.replace(/^\.\//, "")}`;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value}</p>
    </div>
  );
}
