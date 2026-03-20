"use client";

import { useMemo, useEffect, useState } from "react";
import Image from "next/image";
import AdminProtected from "@/components/AdminProtected";
import { authFetch, loadAuth } from "@/lib/client-auth";
import AdminShell from "@/components/admin/AdminShell";
import { Building2, CalendarDays, Clock3, Eye, Filter, Search, X } from "lucide-react";

type Department = { _id: string; name: string; type?: "Academic" | "Service" };
type DepartmentRef = string | { _id?: unknown; name?: string };
type StaffMember = {
  _id: string;
  name: string;
  email: string;
  department?: { _id: string; name?: string };
  academicDepartment?: { _id: string; name?: string };
  serviceDepartment?: { _id: string; name?: string };
};
type Issue = {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  category: string;
  status: "Pending" | "In Progress" | "Resolved" | "Rejected";
  location: string;
  createdAt?: string;
  student?: {
    name: string;
    email: string;
    department?: DepartmentRef;
    academicDepartment?: DepartmentRef;
    course?: string | null;
  };
  department?: Department;
  academicDepartment?: Department;
  serviceDepartment?: Department;
  assignedStaff?: { _id: string; name: string; email: string };
  priority?: "Low" | "Medium" | "High" | "Urgent" | null;
};

type StatusFilter = "All" | "Pending" | "In Progress" | "Resolved" | "Assigned" | "Unassigned" | "Overdue";
type IssueTab = "active" | "rejected";
const POLL_INTERVAL_MS = 10000;
const OVERDUE_DAYS = 7;

export default function AdminIssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [issueTab, setIssueTab] = useState<IssueTab>("active");
  const [viewIssue, setViewIssue] = useState<Issue | null>(null);
  const [triageIssue, setTriageIssue] = useState<Issue | null>(null);
  const [triageForm, setTriageForm] = useState({
    academicDepartmentId: "",
    serviceDepartmentId: "",
    staffId: "",
    priority: "Medium",
  });

  const auth = loadAuth();

  const load = () => {
    if (!auth) return;
    Promise.all([
      authFetch("/api/admin/issues", { method: "GET" }, auth.token),
      authFetch("/api/admin/departments", { method: "GET" }, auth.token),
      authFetch("/api/admin/staff", { method: "GET" }, auth.token),
    ])
      .then(([issuesRes, deptRes, staffRes]) => {
        setIssues(issuesRes.issues || []);
        setDepartments(deptRes.departments || []);
        setStaffMembers(staffRes.faculty || []);
      })
    .catch((err) => setError(err instanceof Error ? err.message : "Failed to load issues"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auth) return;
    const intervalId = window.setInterval(() => {
      if (!savingId) {
        load();
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, savingId]);

  useEffect(() => {
    const applyStatusFromQuery = () => {
      const rawStatus = new URLSearchParams(window.location.search).get("status");
      if (!rawStatus) return;

      const normalizedStatus = decodeURIComponent(rawStatus).trim().toLowerCase();

      if (normalizedStatus === "pending") {
        setIssueTab("active");
        setStatusFilter("Pending");
        return;
      }

      if (normalizedStatus === "assigned") {
        setIssueTab("active");
        setStatusFilter("Assigned");
        return;
      }

      if (normalizedStatus === "in progress") {
        setIssueTab("active");
        setStatusFilter("In Progress");
        return;
      }

      if (normalizedStatus === "resolved") {
        setIssueTab("active");
        setStatusFilter("Resolved");
        return;
      }

      if (normalizedStatus === "rejected") {
        setIssueTab("rejected");
        setStatusFilter("All");
        return;
      }

      if (normalizedStatus === "unassigned") {
        setIssueTab("active");
        setStatusFilter("Unassigned");
        return;
      }

      if (normalizedStatus === "overdue") {
        setIssueTab("active");
        setStatusFilter("Overdue");
      }
    };

    applyStatusFromQuery();
    window.addEventListener("popstate", applyStatusFromQuery);

    return () => {
      window.removeEventListener("popstate", applyStatusFromQuery);
    };
  }, []);

  const onAssign = async (
    issueId: string,
    payload: {
      academicDepartmentId?: string;
      serviceDepartmentId?: string;
      staffId?: string;
      priority?: string;
    },
    status?: Issue["status"]
  ) => {
    if (!auth) return;
    setSavingId(issueId);
    try {
      await authFetch(
        `/api/issues/${issueId}/assign`,
        {
          method: "PATCH",
          body: JSON.stringify({
            academicDepartmentId: payload.academicDepartmentId || "",
            serviceDepartmentId: payload.serviceDepartmentId || "",
            staffId: payload.staffId || "",
            priority: payload.priority || "",
            status,
          }),
        },
        auth.token
      );
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to assign";
      setError(message);
    } finally {
      setSavingId(null);
    }
  };

  const onOpenTriage = (issue: Issue) => {
    const reporterAcademicDepartmentId = resolveReporterAcademicDepartmentId(issue, departments);
    const fallbackAcademicDepartmentId = normalizeId(academicDepartments[0]?._id);
    const defaultAcademicDepartmentId =
      normalizeId(issue.academicDepartment?._id) ||
      reporterAcademicDepartmentId ||
      (issue.department?.type === "Academic" ? normalizeId(issue.department._id) : "") ||
      fallbackAcademicDepartmentId;
    const defaultServiceDepartmentId =
      normalizeId(issue.serviceDepartment?._id) ||
      (issue.department?.type === "Service" ? normalizeId(issue.department._id) : "");
    const defaultStaffId =
      normalizeId(issue.assignedStaff?._id) ||
      findDefaultStaffId(staffMembers, defaultAcademicDepartmentId, defaultServiceDepartmentId);

    setTriageIssue(issue);
    setTriageForm({
      academicDepartmentId: defaultAcademicDepartmentId,
      serviceDepartmentId: defaultServiceDepartmentId,
      staffId: defaultStaffId,
      priority: issue.priority || "Medium",
    });
  };

  const onProceedToTriageFromView = () => {
    if (!viewIssue) return;
    const selectedIssue = viewIssue;
    setViewIssue(null);
    onOpenTriage(selectedIssue);
  };

  const academicDepartments = useMemo(
    () => departments.filter((department) => department.type === "Academic"),
    [departments]
  );

  const triageAcademicDepartments = useMemo(() => {
    if (!triageForm.academicDepartmentId) return academicDepartments;

    const selectedId = normalizeId(triageForm.academicDepartmentId);
    const isAlreadyAcademicOption = academicDepartments.some(
      (department) => normalizeId(department._id) === selectedId
    );

    if (isAlreadyAcademicOption) return academicDepartments;

    const selectedDepartment = departments.find(
      (department) => normalizeId(department._id) === selectedId
    );

    return selectedDepartment ? [selectedDepartment, ...academicDepartments] : academicDepartments;
  }, [departments, academicDepartments, triageForm.academicDepartmentId]);

  const serviceDepartments = useMemo(
    () => departments.filter((department) => department.type === "Service"),
    [departments]
  );

  const selectedTriageDepartmentIds = [triageForm.academicDepartmentId, triageForm.serviceDepartmentId].filter(
    Boolean
  );

  const filteredStaffMembers = useMemo(() => {
    if (selectedTriageDepartmentIds.length === 0) return [];

    return staffMembers.filter((staff) => {
      const staffAcademicDepartmentIds = [
        staff.academicDepartment?._id,
        staff.department?._id,
      ].map(normalizeId).filter(Boolean);

      const staffServiceDepartmentIds = [
        staff.serviceDepartment?._id,
        staff.department?._id,
      ].map(normalizeId).filter(Boolean);

      const academicMatch =
        !triageForm.academicDepartmentId ||
        staffAcademicDepartmentIds.includes(triageForm.academicDepartmentId);

      const serviceMatch =
        !triageForm.serviceDepartmentId ||
        staffServiceDepartmentIds.includes(triageForm.serviceDepartmentId);

      return academicMatch && serviceMatch;
    });
  }, [staffMembers, selectedTriageDepartmentIds, triageForm.academicDepartmentId, triageForm.serviceDepartmentId]);

  const onSaveTriage = async () => {
    if (!triageIssue || (!triageForm.academicDepartmentId && !triageForm.serviceDepartmentId)) {
      setError("Please select either Academic Department or Service Department.");
      return;
    }

    if (!triageForm.staffId) {
      setError("Please assign a staff member.");
      return;
    }

    await onAssign(
      triageIssue._id,
      {
        academicDepartmentId: triageForm.academicDepartmentId,
        serviceDepartmentId: triageForm.serviceDepartmentId,
        staffId: triageForm.staffId,
        priority: triageForm.priority,
      },
      triageIssue.status
    );
    setTriageIssue(null);
  };

  const onRejectIssue = async (issueId: string) => {
    if (!auth) return;

    const confirmed = window.confirm("Reject this issue?");
    if (!confirmed) return;

    setSavingId(issueId);
    try {
      await authFetch(
        `/api/issues/${issueId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "Rejected" }),
        },
        auth.token
      );

      if (viewIssue?._id === issueId) {
        setViewIssue((prev) => (prev ? { ...prev, status: "Rejected" } : prev));
      }

      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reject issue";
      setError(message);
    } finally {
      setSavingId(null);
    }
  };

  const onDeleteIssue = async (issueId: string) => {
    if (!auth) return;

    const confirmed = window.confirm("Delete this issue permanently?");
    if (!confirmed) return;

    setSavingId(issueId);
    try {
      await authFetch(
        `/api/issues/${issueId}`,
        {
          method: "DELETE",
        },
        auth.token
      );

      if (viewIssue?._id === issueId) {
        setViewIssue(null);
      }

      if (triageIssue?._id === issueId) {
        setTriageIssue(null);
      }

      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete issue";
      setError(message);
    } finally {
      setSavingId(null);
    }
  };

  const onRestoreIssue = async (issueId: string) => {
    if (!auth) return;

    const confirmed = window.confirm("Restore this rejected issue to pending?");
    if (!confirmed) return;

    setSavingId(issueId);
    try {
      await authFetch(
        `/api/issues/${issueId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "Pending" }),
        },
        auth.token
      );

      if (viewIssue?._id === issueId) {
        setViewIssue((prev) => (prev ? { ...prev, status: "Pending" } : prev));
      }

      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to restore issue";
      setError(message);
    } finally {
      setSavingId(null);
    }
  };

  const activeIssues = useMemo(() => issues.filter((issue) => issue.status !== "Rejected"), [issues]);
  const rejectedIssues = useMemo(() => issues.filter((issue) => issue.status === "Rejected"), [issues]);

  const filteredIssues = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const overdueThresholdMs = OVERDUE_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();

    return activeIssues.filter((issue) => {
      const statusMatch =
        statusFilter === "All"
          ? true
          : statusFilter === "Assigned"
            ? issue.status === "Pending" && Boolean(issue.assignedStaff?._id)
            : statusFilter === "Unassigned"
              ? !issue.assignedStaff?._id
              : statusFilter === "Overdue"
                ? (() => {
                    if (issue.status === "Resolved" || issue.status === "Rejected") return false;
                    if (!issue.createdAt) return false;
                    const createdAt = new Date(issue.createdAt).getTime();
                    if (Number.isNaN(createdAt)) return false;
                    return now - createdAt > overdueThresholdMs;
                  })()
                : issue.status === statusFilter;
      if (!statusMatch) return false;

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
  }, [activeIssues, searchQuery, statusFilter]);

  const filteredRejectedIssues = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return rejectedIssues;

    return rejectedIssues.filter((issue) => {
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
  }, [rejectedIssues, searchQuery]);

  return (
    <AdminProtected>
      <AdminShell
        title="Issue Triage"
        subtitle="Assign issues to departments and set priorities"
      >
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search issues..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="relative sm:w-40">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  disabled={issueTab === "rejected"}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm text-slate-700 outline-none focus:border-emerald-500"
                >
                  <option value="All">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Unassigned">Unassigned</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIssueTab("active")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  issueTab === "active" ? "bg-teal-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Main Issues
              </button>
              <button
                type="button"
                onClick={() => setIssueTab("rejected")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  issueTab === "rejected" ? "bg-rose-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Rejected Issues
              </button>
            </div>
          </section>

          {loading && <div className="text-sm text-slate-600">Loading...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}

          {!loading && !error && issueTab === "active" && filteredIssues.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No issues found.
            </div>
          )}

          {!loading && !error && issueTab === "rejected" && filteredRejectedIssues.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No rejected issues found.
            </div>
          )}

          {!loading && !error && issueTab === "active" && filteredIssues.map((issue) => {
            return (
              <article key={issue._id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-2l font-semibold text-slate-900">{issue.title}</h3>
                      <StatusBadge status={issue.status} />
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          issue.assignedStaff
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {issue.assignedStaff ? "Assigned" : "Non Assigned"}
                      </span>
                      {issue.assignedStaff && issue.priority ? (
                        <PriorityBadge priority={issue.priority} />
                      ) : null}
                    </div>

                    <p className="text-sm text-slate-600 line-clamp-1">
                      {issue.description || issue.category}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        Staff: {issue.assignedStaff?.name || "Unassigned"}
                        {issue.assignedStaff?.email ? ` (${issue.assignedStaff.email})` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        Reported by: {issue.student?.name || "Unknown user"}
                        {issue.student?.email ? ` (${issue.student.email})` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {issue.location}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(issue.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                      onClick={() => setViewIssue(issue)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                      onClick={() => onOpenTriage(issue)}
                      disabled={savingId === issue._id}
                    >
                      {savingId === issue._id ? "Saving..." : "Triage"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                      onClick={() => onRejectIssue(issue._id)}
                      disabled={savingId === issue._id || issue.status === "Resolved" || issue.status === "Rejected"}
                    >
                      {savingId === issue._id ? "Saving..." : "Reject"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      onClick={() => onDeleteIssue(issue._id)}
                      disabled={savingId === issue._id}
                    >
                      {savingId === issue._id ? "Saving..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {!loading && !error && issueTab === "rejected" && filteredRejectedIssues.map((issue) => {
            return (
              <article key={issue._id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-2l font-semibold text-slate-900">{issue.title}</h3>
                      <StatusBadge status={issue.status} />
                    </div>

                    <p className="text-sm text-slate-600 line-clamp-1">{issue.description || issue.category}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        Reported by: {issue.student?.name || "Unknown user"}
                        {issue.student?.email ? ` (${issue.student.email})` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {issue.location}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(issue.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                      onClick={() => setViewIssue(issue)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                      onClick={() => onRestoreIssue(issue._id)}
                      disabled={savingId === issue._id}
                    >
                      {savingId === issue._id ? "Saving..." : "Restore"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      onClick={() => onDeleteIssue(issue._id)}
                      disabled={savingId === issue._id}
                    >
                      {savingId === issue._id ? "Saving..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {viewIssue && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
              <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <h3 className="text-2xl font-semibold text-slate-900">Issue Details</h3>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                    onClick={() => setViewIssue(null)}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="rounded-xl bg-slate-100 p-4">
                    <p className="text-base font-semibold text-slate-800">{viewIssue.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{viewIssue.category}</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-700">Description</p>
                    <p className="mt-1 text-sm text-slate-600">{viewIssue.description || "No description provided."}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <p><span className="font-semibold text-slate-700">Location:</span> {viewIssue.location || "—"}</p>
                    <p><span className="font-semibold text-slate-700">Reported:</span> {formatDate(viewIssue.createdAt)}</p>
                    <p><span className="font-semibold text-slate-700">Reported by:</span> {viewIssue.student?.name || "Unknown user"}</p>
                    <p><span className="font-semibold text-slate-700">Email:</span> {viewIssue.student?.email || "—"}</p>
                  </div>

                  {viewIssue.imageUrl ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Reported Photo</p>
                      <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        <Image
                          src={viewIssue.imageUrl}
                          alt="Issue attachment"
                          width={1200}
                          height={800}
                          unoptimized
                          className="max-h-96 w-full object-contain"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end gap-2 px-5 pb-5">
                  {viewIssue.status === "Rejected" ? (
                    <button
                      type="button"
                      className="h-10 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                      onClick={() => onRestoreIssue(viewIssue._id)}
                      disabled={savingId === viewIssue._id}
                    >
                      {savingId === viewIssue._id ? "Saving..." : "Restore"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="h-10 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                      onClick={() => onRejectIssue(viewIssue._id)}
                      disabled={savingId === viewIssue._id || viewIssue.status === "Resolved"}
                    >
                      {savingId === viewIssue._id ? "Saving..." : "Reject"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="h-10 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    onClick={() => onDeleteIssue(viewIssue._id)}
                    disabled={savingId === viewIssue._id}
                  >
                    {savingId === viewIssue._id ? "Saving..." : "Delete"}
                  </button>
                  <button
                    type="button"
                    className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setViewIssue(null)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="h-10 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
                    onClick={onProceedToTriageFromView}
                    disabled={viewIssue.status === "Rejected"}
                  >
                    Proceed to Triage
                  </button>
                </div>
              </div>
            </div>
          )}

          {triageIssue && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
              <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <h3 className="text-2xl font-semibold text-slate-900">Triage Issue</h3>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                    onClick={() => setTriageIssue(null)}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="rounded-xl bg-slate-100 p-4">
                    <p className="text-base font-semibold text-slate-800">{triageIssue.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{triageIssue.category}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Academic Department</label>
                    <select
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      value={triageForm.academicDepartmentId}
                      onChange={(e) => {
                        const nextAcademicDepartmentId = e.target.value;
                        setTriageForm((prev) => {
                          const nextServiceDepartmentId = prev.serviceDepartmentId;
                          const nextStaffId = findDefaultStaffId(
                            staffMembers,
                            nextAcademicDepartmentId,
                            nextServiceDepartmentId
                          );

                          return {
                            ...prev,
                            academicDepartmentId: nextAcademicDepartmentId,
                            staffId: nextStaffId,
                          };
                        });
                      }}
                    >
                      <option value="">Select academic department</option>
                      {triageAcademicDepartments.map((department) => (
                        <option key={normalizeId(department._id)} value={normalizeId(department._id)}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Service Department</label>
                    <select
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      value={triageForm.serviceDepartmentId}
                      onChange={(e) => {
                        const nextServiceDepartmentId = e.target.value;
                        setTriageForm((prev) => {
                          const nextAcademicDepartmentId = prev.academicDepartmentId;
                          const nextStaffId = findDefaultStaffId(
                            staffMembers,
                            nextAcademicDepartmentId,
                            nextServiceDepartmentId
                          );

                          return {
                            ...prev,
                            serviceDepartmentId: nextServiceDepartmentId,
                            staffId: nextStaffId,
                          };
                        });
                      }}
                    >
                      <option value="">Select service department</option>
                      {serviceDepartments.map((department) => (
                        <option key={normalizeId(department._id)} value={normalizeId(department._id)}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Assign to Staff *</label>
                    <select
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      value={triageForm.staffId}
                      onChange={(e) => setTriageForm((prev) => ({ ...prev, staffId: e.target.value }))}
                      disabled={selectedTriageDepartmentIds.length === 0}
                    >
                      <option value="">
                        {selectedTriageDepartmentIds.length > 0 ? "Select staff member" : "Select department first"}
                      </option>
                      {filteredStaffMembers.map((staff) => (
                        <option key={staff._id} value={staff._id}>
                          {staff.name} ({staff.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Priority</label>
                    <select
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      value={triageForm.priority}
                      onChange={(e) => setTriageForm((prev) => ({ ...prev, priority: e.target.value }))}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                </div>

                <div className="flex justify-end gap-2 px-5 pb-5">
                  <button
                    type="button"
                    className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setTriageIssue(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="h-10 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                    onClick={onSaveTriage}
                    disabled={
                      savingId === triageIssue._id ||
                      (!triageForm.academicDepartmentId && !triageForm.serviceDepartmentId) ||
                      !triageForm.staffId
                    }
                  >
                    {savingId === triageIssue._id ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminShell>
    </AdminProtected>
  );
}

function StatusBadge({ status }: { status: Issue["status"] }) {
  if (status === "Rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
        <Clock3 className="h-3.5 w-3.5" />
        Rejected
      </span>
    );
  }

  if (status === "Resolved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
        <Clock3 className="h-3.5 w-3.5" />
        Resolved
      </span>
    );
  }

  if (status === "In Progress") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
        <Clock3 className="h-3.5 w-3.5" />
        In Progress
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
      <Clock3 className="h-3.5 w-3.5" />
      Pending
    </span>
  );
}

function PriorityBadge({ priority }: { priority: "Low" | "Medium" | "High" | "Urgent" }) {
  if (priority === "Urgent") {
    return <span className="text-sm font-semibold text-rose-600">— Urgent</span>;
  }

  if (priority === "High") {
    return <span className="text-sm font-semibold text-orange-600">— High</span>;
  }

  if (priority === "Medium") {
    return <span className="text-sm font-semibold text-amber-500">— Medium</span>;
  }

  return <span className="text-sm font-semibold text-emerald-600">— Low</span>;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDepartmentRefId(value?: DepartmentRef) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return normalizeId(value._id);
}

function resolveReporterAcademicDepartmentId(issue: Issue, departments: Department[]) {
  const academicOnly = departments.filter((department) => department.type === "Academic");

  const explicitAcademic = getDepartmentRefId(issue.student?.academicDepartment);
  if (explicitAcademic && academicOnly.some((department) => normalizeId(department._id) === explicitAcademic)) {
    return explicitAcademic;
  }

  const reporterDepartmentId = getDepartmentRefId(issue.student?.department);
  if (reporterDepartmentId) {
    const matched = departments.find((department) => normalizeId(department._id) === reporterDepartmentId);
    if (matched?.type === "Academic") {
      return normalizeId(matched._id);
    }
  }

  const course = issue.student?.course?.trim().toLowerCase();
  if (course) {
    const matchedByCourse = academicOnly.find((department) => {
      const departmentName = department.name.trim().toLowerCase();
      return departmentName === course || departmentName.includes(course) || course.includes(departmentName);
    });

    if (matchedByCourse) {
      return normalizeId(matchedByCourse._id);
    }
  }

  return "";
}

function findDefaultStaffId(
  staffMembers: StaffMember[],
  academicDepartmentId: string,
  serviceDepartmentId: string
) {
  const hasAnyDepartment = Boolean(academicDepartmentId || serviceDepartmentId);
  if (!hasAnyDepartment) return "";

  const matched = staffMembers.find((staff) => {
    const staffAcademicDepartmentIds = [staff.academicDepartment?._id, staff.department?._id]
      .map(normalizeId)
      .filter(Boolean);

    const staffServiceDepartmentIds = [staff.serviceDepartment?._id, staff.department?._id]
      .map(normalizeId)
      .filter(Boolean);

    const academicMatch =
      !academicDepartmentId || staffAcademicDepartmentIds.includes(academicDepartmentId);
    const serviceMatch =
      !serviceDepartmentId || staffServiceDepartmentIds.includes(serviceDepartmentId);

    return academicMatch && serviceMatch;
  });

  return normalizeId(matched?._id);
}

function normalizeId(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "$oid" in value) {
    const oid = (value as { $oid?: unknown }).$oid;
    return typeof oid === "string" ? oid : "";
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null && "toString" in value) {
    const asString = (value as { toString: () => string }).toString();
    return asString === "[object Object]" ? "" : asString;
  }
  return "";
}