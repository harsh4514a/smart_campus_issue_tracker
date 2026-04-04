"use client";

import Link from "next/link";
import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import DeptAdminShell from "@/components/dept-admin/DeptAdminShell";
import ConfirmDialog from "@/components/dept-admin/ConfirmDialog";
import { authFetch, loadAuth } from "@/lib/client-auth";
import { AlertTriangle, CheckCircle2, Loader2, MoreVertical, Search, X } from "lucide-react";

type Department = { _id: string; name: string; type?: string };
type Worker = {
  _id: string;
  name: string;
  email: string;
  activeIssues?: number;
  designation?: string | null;
  department?: Department | null;
  academicDepartment?: Department | null;
  serviceDepartment?: Department | null;
  managedDepartments?: Department[];
};
type Issue = {
  _id: string;
  title: string;
  category?: string;
  description?: string;
  location?: string;
  imageUrl?: string | null;
  attachments?: string[];
  tags?: string[];
  priority?: string;
  status: "Pending" | "In Progress" | "Resolved" | "Rejected";
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
  department?: Department | null;
  academicDepartment?: Department | null;
  serviceDepartment?: Department | null;
  student?: { name?: string };
  assignedStaff?: { _id: string; name: string } | null;
};

type IssueDetailPatch = {
  description?: string;
  location?: string;
  imageUrl?: string | null;
  attachments?: string[];
  dueDate?: string;
};

type IssuesResponse = {
  issues: Issue[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type DashboardSummaryResponse = {
  kpi?: {
    total?: number;
    pending?: number;
    inProgress?: number;
    resolved?: number;
  };
  alerts?: {
    unassigned?: number;
    overdue?: number;
    highPriorityPending?: number;
  };
};

type WorkersListResponse = {
  workers?: Worker[];
};

type ActionCounts = {
  unassigned: number;
  highPriority: number;
  overdue: number;
};

type SortMode = "latest" | "oldest" | "priority_high" | "priority_low";

type StatusFilter = "All" | "Pending" | "Assigned" | "In Progress" | "Resolved" | "Rejected";

type PriorityFilter = "All" | "Low" | "Medium" | "High" | "Urgent";

const CATEGORY_OPTIONS = [
  "All",
  "Electrical",
  "IT Support",
  "Network / Internet",
  "Cleaning",
  "Plumbing",
  "Furniture",
  "Maintenance",
];

const PRIORITY_STYLE: Record<string, string> = {
  Low: "bg-emerald-100 text-emerald-900 border border-emerald-300",
  Medium: "bg-amber-200 text-amber-900 border border-amber-300",
  High: "bg-orange-200 text-orange-900 border border-orange-300",
  Urgent: "bg-rose-200 text-rose-900 border border-rose-300",
};

const CATEGORY_STYLE: Record<string, string> = {
  electrical: "bg-amber-100 text-amber-800",
  "it/network": "bg-blue-100 text-blue-800",
  maintenance: "bg-slate-200 text-slate-700",
  cleaning: "bg-emerald-100 text-emerald-800",
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  electrical: ["electrical", "electric", "elec"],
  "it support": ["it", "network", "support"],
  "it/network": ["it", "network", "support"],
  maintenance: ["maintenance", "maint"],
  cleaning: ["clean", "housekeep", "janitor"],
};

const STATUS_OPTIONS: StatusFilter[] = ["All", "Pending", "Assigned", "In Progress", "Resolved", "Rejected"];

const PRIORITY_OPTIONS: PriorityFilter[] = ["All", "Low", "Medium", "High", "Urgent"];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "latest", label: "Latest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "priority_high", label: "Priority (High → Low)" },
  { value: "priority_low", label: "Priority (Low → High)" },
];

const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-200 text-amber-900 border border-amber-300",
  "In Progress": "bg-blue-200 text-blue-900 border border-blue-300",
  Resolved: "bg-emerald-200 text-emerald-900 border border-emerald-300",
  Rejected: "bg-rose-200 text-rose-900 border border-rose-300",
};

export default function DeptAdminIssuesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <DeptAdminIssuesPageContent />
    </Suspense>
  );
}

function DeptAdminIssuesPageContent() {
  const auth = useMemo(() => loadAuth(), []);
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigningIssueId, setAssigningIssueId] = useState<string | null>(null);
  const [assignedSuccessIssueId, setAssignedSuccessIssueId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState<"assign" | "status" | "delete" | null>(null);

  const [search, setSearch] = useState(params.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(params.get("search") || "");
  const [status, setStatus] = useState<StatusFilter>((params.get("status") as StatusFilter) || "All");
  const [priority, setPriority] = useState<PriorityFilter>((params.get("priority") as PriorityFilter) || "All");
  const [category, setCategory] = useState(params.get("category") || "All");
  const workerId = params.get("workerId") || "All";
  const [sort, setSort] = useState<SortMode>(((params.get("sort") as SortMode) || "latest"));
  const [focusMode, setFocusMode] = useState(params.get("focusMode") === "1");
  const [unassignedOnly, setUnassignedOnly] = useState(params.get("unassignedOnly") === "1");
  const [overdueOnly, setOverdueOnly] = useState(params.get("overdueOnly") === "1");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalIssues, setTotalIssues] = useState(0);

  const [kpi, setKpi] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0 });
  const [actionCounts, setActionCounts] = useState<ActionCounts>({ unassigned: 0, highPriority: 0, overdue: 0 });

  const [inlineAssign, setInlineAssign] = useState<Record<string, string>>({});
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [bulkWorkerId, setBulkWorkerId] = useState("");
  const [bulkStatus, setBulkStatus] = useState<"In Progress" | "Resolved" | "Rejected">("In Progress");
  const [issueDetailsMap, setIssueDetailsMap] = useState<Record<string, IssueDetailPatch>>({});
  const [loadingDetailIssueId, setLoadingDetailIssueId] = useState<string | null>(null);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [openActionMenuIssueId, setOpenActionMenuIssueId] = useState<string | null>(null);
  const [pendingCloseIssueId, setPendingCloseIssueId] = useState<string | null>(null);
  const [pendingResolveIssueId, setPendingResolveIssueId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  const loadSummaryData = useCallback(async (signal?: AbortSignal) => {
    if (!auth) return;

    try {
      const [summaryResponse, workersResponse] = await Promise.all([
        authFetch("/api/dept-admin/dashboard?view=summary", { method: "GET", signal }, auth.token),
        authFetch("/api/dept-admin/workers?view=issues", { method: "GET", signal }, auth.token),
      ]);

      if (signal?.aborted) return;

      const summary = summaryResponse as DashboardSummaryResponse;
      const workersPayload = workersResponse as WorkersListResponse;
      const stats = summary?.kpi;
      const alerts = summary?.alerts;

      setWorkers(Array.isArray(workersPayload?.workers) ? workersPayload.workers : []);

      if (stats) {
        setKpi({
          total: Number(stats.total || 0),
          pending: Number(stats.pending || 0),
          inProgress: Number(stats.inProgress || 0),
          resolved: Number(stats.resolved || 0),
        });
      }

      setActionCounts({
        unassigned: Number(alerts?.unassigned || 0),
        highPriority: Number(alerts?.highPriorityPending || 0),
        overdue: Number(alerts?.overdue || 0),
      });
    } catch (err) {
      if (signal?.aborted) return;
      showToast({
        title: "Load Failed",
        message: err instanceof Error ? err.message : "Failed to load summary data",
        variant: "error",
      });
    }
  }, [auth, showToast]);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!auth) return;
    setLoading(true);

    try {
      const query = new URLSearchParams({
        search: debouncedSearch,
        status,
        priority,
        category,
        sort,
        page: String(page),
        limit: String(limit),
      });

      if (workerId !== "All") query.set("workerId", workerId);
      if (unassignedOnly) query.set("unassignedOnly", "1");
      if (overdueOnly) query.set("overdueOnly", "1");
      if (focusMode) query.set("focusMode", "1");

      const issuesRes = await authFetch(
        `/api/dept-admin/issues?${query.toString()}`,
        { method: "GET", signal },
        auth.token
      );

      if (signal?.aborted) return;

      const parsed = issuesRes as IssuesResponse;
      setTotalIssues(parsed.pagination?.total || 0);
      setIssues(parsed.issues || []);

    } catch (err) {
      if (signal?.aborted) return;
      showToast({
        title: "Load Failed",
        message: err instanceof Error ? err.message : "Failed to load issues",
        variant: "error",
      });
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [auth, category, debouncedSearch, focusMode, limit, overdueOnly, page, priority, sort, status, workerId, unassignedOnly, showToast]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, priority, category, workerId, sort, unassignedOnly, overdueOnly, focusMode]);

  useEffect(() => {
    if (!auth) return;
    const controller = new AbortController();
    void loadSummaryData(controller.signal);
    return () => controller.abort();
  }, [auth, loadSummaryData]);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  useEffect(() => {
    setSelectedIssueIds([]);
  }, [page, debouncedSearch, status, priority, category, workerId, sort, unassignedOnly, overdueOnly, focusMode]);

  const quickFilter = (chip: "all" | "unassigned" | "overdue") => {
    if (chip === "all") {
      setUnassignedOnly(false);
      setOverdueOnly(false);
      setPriority("All");
      setCategory("All");
      setStatus("All");
      setFocusMode(false);
      return;
    }

    if (chip === "unassigned") {
      setUnassignedOnly(true);
      setOverdueOnly(false);
      setFocusMode(false);
      return;
    }

    if (chip === "overdue") {
      setOverdueOnly(true);
      setUnassignedOnly(false);
      setFocusMode(false);
      return;
    }
  };

  const activeFilters = [
    status !== "All" ? { key: "status", label: `Status: ${status}`, clear: () => setStatus("All") } : null,
    priority !== "All" ? { key: "priority", label: `Priority: ${priority}`, clear: () => setPriority("All") } : null,
    category !== "All" ? { key: "category", label: `Category: ${category}`, clear: () => setCategory("All") } : null,
    unassignedOnly ? { key: "unassigned", label: "Unassigned", clear: () => setUnassignedOnly(false) } : null,
    overdueOnly ? { key: "overdue", label: "Overdue", clear: () => setOverdueOnly(false) } : null,
    focusMode ? { key: "focus", label: "Focus Mode", clear: () => setFocusMode(false) } : null,
    sort !== "latest"
      ? {
          key: "sort",
          label: `Sort: ${SORT_OPTIONS.find((option) => option.value === sort)?.label || "Custom"}`,
          clear: () => setSort("latest"),
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  useEffect(() => {
    if (!assignedSuccessIssueId) return;
    const timer = window.setTimeout(() => setAssignedSuccessIssueId(null), 2200);
    return () => window.clearTimeout(timer);
  }, [assignedSuccessIssueId]);

  const assignSingle = async (issueId: string, selectedStaffId?: string) => {
    const staffId = selectedStaffId || inlineAssign[issueId];
    if (!auth || !staffId) return;

    setAssigningIssueId(issueId);
    setSaving(true);
    try {
      await authFetch(
        `/api/dept-admin/issues/${issueId}/assign`,
        { method: "PATCH", body: JSON.stringify({ staffId }) },
        auth.token
      );
      showToast({ title: "Success", message: "Issue assigned", variant: "success" });
      setAssignedSuccessIssueId(issueId);
      await Promise.all([loadData(), loadSummaryData()]);
    } catch (err) {
      showToast({ title: "Assign Failed", message: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally {
      setAssigningIssueId((prev) => (prev === issueId ? null : prev));
      setSaving(false);
    }
  };

  const runBulk = async (
    mode: "assign" | "status" | "delete",
    buildRequest: (issueId: string) => Promise<unknown>
  ) => {
    if (!auth || selectedIssueIds.length === 0) return;

    setBulkSaving(mode);
    try {
      const results = await Promise.allSettled(selectedIssueIds.map((issueId) => buildRequest(issueId)));
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - successCount;

      if (successCount > 0) {
        showToast({
          title: "Bulk Update Complete",
          message: `${successCount} issue${successCount === 1 ? "" : "s"} updated successfully.${failedCount > 0 ? ` ${failedCount} failed.` : ""}`,
          variant: failedCount > 0 ? "info" : "success",
        });
      } else {
        showToast({ title: "Bulk Action Failed", message: "No issues were updated.", variant: "error" });
      }

      setSelectedIssueIds([]);
      await Promise.all([loadData(), loadSummaryData()]);
    } catch (err) {
      showToast({ title: "Bulk Action Failed", message: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally {
      setBulkSaving(null);
    }
  };

  const applyBulkAssign = async () => {
    if (!bulkWorkerId) {
      showToast({ title: "Worker Required", message: "Select a worker for bulk assignment.", variant: "info" });
      return;
    }

    await runBulk("assign", (issueId) =>
      authFetch(
        `/api/dept-admin/issues/${issueId}/assign`,
        { method: "PATCH", body: JSON.stringify({ staffId: bulkWorkerId }) },
        auth?.token || ""
      )
    );
  };

  const applyBulkStatus = async () => {
    await runBulk("status", (issueId) =>
      authFetch(
        `/api/dept-admin/issues/${issueId}/status`,
        { method: "PATCH", body: JSON.stringify({ status: bulkStatus }) },
        auth?.token || ""
      )
    );
  };

  const applyBulkDelete = async () => {
    await runBulk("delete", (issueId) =>
      authFetch(`/api/dept-admin/issues/${issueId}`, { method: "DELETE" }, auth?.token || "")
    );
  };

  const applyStatus = async (issueId: string, nextStatus: "In Progress" | "Resolved" | "Rejected") => {
    if (!auth) return;

    setSaving(true);
    try {
      await authFetch(
        `/api/dept-admin/issues/${issueId}/status`,
        { method: "PATCH", body: JSON.stringify({ status: nextStatus }) },
        auth.token
      );
      showToast({ title: "Success", message: "Status updated", variant: "success" });
      setOpenActionMenuIssueId(null);
      await Promise.all([loadData(), loadSummaryData()]);
    } catch (err) {
      showToast({ title: "Status Failed", message: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const updatePriority = async (issueId: string, nextPriority: "Low" | "Medium" | "High" | "Urgent") => {
    if (!auth) return;

    setSaving(true);
    try {
      await authFetch(
        `/api/dept-admin/issues/${issueId}`,
        { method: "PATCH", body: JSON.stringify({ priority: nextPriority }) },
        auth.token
      );
      showToast({ title: "Success", message: `Priority updated to ${nextPriority}`, variant: "success" });
      await Promise.all([loadData(), loadSummaryData()]);
    } catch (err) {
      showToast({ title: "Priority Failed", message: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const loadIssueDetails = async (issueId: string) => {
    if (!auth || issueDetailsMap[issueId]) return;

    setLoadingDetailIssueId(issueId);
    try {
      const response = await authFetch(`/api/dept-admin/issues/${issueId}`, { method: "GET" }, auth.token);
      const issue = response?.issue as IssueDetailPatch | undefined;
      if (!issue) return;

      setIssueDetailsMap((prev) => ({
        ...prev,
        [issueId]: {
          description: issue.description,
          location: issue.location,
          imageUrl: issue.imageUrl ?? null,
          attachments: Array.isArray(issue.attachments) ? issue.attachments : [],
          dueDate: issue.dueDate,
        },
      }));
    } catch {
      // Keep the list responsive even if optional detail fetch fails.
    } finally {
      setLoadingDetailIssueId((prev) => (prev === issueId ? null : prev));
    }
  };

  const toggleExpand = (issueId: string) => {
    setExpandedIssueId((prev) => {
      const isExpanding = prev !== issueId;
      if (isExpanding) {
        void loadIssueDetails(issueId);
      }
      return isExpanding ? issueId : null;
    });
  };

  const getAgeLabel = (createdAt?: string) => {
    if (!createdAt) return "";
    const created = new Date(createdAt).getTime();
    const diffMs = Date.now() - created;
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getCompactDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const getDueBadge = (dueDate?: string, closed = false) => {
    if (!dueDate || closed) return null;

    const dueTs = new Date(dueDate).getTime();
    if (Number.isNaN(dueTs)) return null;

    const nowTs = Date.now();
    const diffMin = Math.round((dueTs - nowTs) / 60000);
    const daysLeft = Math.floor((dueTs - nowTs) / 86400000);

    if (daysLeft < 0 || diffMin < 0) {
      const overdueMinutes = Math.abs(diffMin);
      return {
        label: `Overdue by ${getCompactDuration(overdueMinutes)}`,
        className: "bg-red-100 text-red-700",
      };
    }

    if (daysLeft >= 3) {
      return {
        label: `Due in ${getCompactDuration(diffMin)}`,
        className: "bg-green-100 text-green-700",
      };
    }

    if (daysLeft >= 1) {
      return {
        label: `Due in ${getCompactDuration(diffMin)}`,
        className: "bg-amber-100 text-amber-700",
      };
    }

    return {
      label: `Due in ${getCompactDuration(diffMin)}`,
      className: "bg-orange-100 text-orange-700",
    };
  };

  const getWorkersForIssue = (issue: Issue) => {
    const rawCategory = String(issue.category || "").trim().toLowerCase();
    const categoryKeywords =
      CATEGORY_KEYWORDS[rawCategory] ||
      (rawCategory.includes("it") || rawCategory.includes("network")
        ? CATEGORY_KEYWORDS["it/network"]
        : rawCategory
          ? [rawCategory]
          : []);

    const serviceDepartmentId = String(issue.serviceDepartment?._id || "").trim();
    const academicDepartmentId = String(issue.academicDepartment?._id || "").trim();
    const issueDepartmentId = String(issue.department?._id || "").trim();

    const scopedWorkers = workers.filter((worker) => {
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

      const matchesAcademic = academicDepartmentId ? workerAcademicIds.includes(academicDepartmentId) : true;
      const matchesService = serviceDepartmentId ? workerServiceIds.includes(serviceDepartmentId) : true;

      if (academicDepartmentId && serviceDepartmentId) {
        // When issue is tied to both contexts, worker must satisfy both.
        return matchesAcademic && matchesService;
      }

      if (academicDepartmentId) {
        return matchesAcademic;
      }

      if (serviceDepartmentId) {
        return matchesService;
      }

      if (!issueDepartmentId) {
        return true;
      }

      const workerScopeIds = Array.from(new Set([...workerAcademicIds, ...workerServiceIds]));
      return workerScopeIds.includes(issueDepartmentId);
    });

    if (categoryKeywords.length === 0) return [];

    const categoryMatchedWorkers = scopedWorkers.filter((worker) => {
      const haystack = [
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

      return categoryKeywords.some((keyword) => haystack.includes(keyword));
    });

    // Strict rule: show only workers matching BOTH department scope and issue category.
    return categoryMatchedWorkers;
  };

  const displayedIssues = useMemo(() => {
    return issues.slice().sort((a, b) => {
      const aResolved = a.status === "Resolved";
      const bResolved = b.status === "Resolved";
      if (aResolved === bResolved) return 0;
      return aResolved ? 1 : -1;
    });
  }, [issues]);
  const totalPages = Math.max(1, Math.ceil(totalIssues / limit));

  return (
    <DeptAdminShell title="Issue Management" subtitle="Assign quickly and complete issues through a strict workflow">
      <div className="space-y-4">
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-amber-900">
              ⚠️ {actionCounts.unassigned} Unassigned | 🔥 {actionCounts.highPriority} High Priority | ⏰ {actionCounts.overdue} Overdue
            </p>
            <button
              type="button"
              onClick={() => quickFilter("unassigned")}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Focus Unassigned
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiButton label="Total" value={kpi.total} active={status === "All"} onClick={() => setStatus("All")} />
          <KpiButton label="Pending" value={kpi.pending} active={status === "Pending"} onClick={() => setStatus("Pending")} />
          <KpiButton label="In Progress" value={kpi.inProgress} active={status === "In Progress"} onClick={() => setStatus("In Progress")} />
          <KpiButton label="Resolved" value={kpi.resolved} active={status === "Resolved"} onClick={() => setStatus("Resolved")} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <QuickChip label="All" active={!unassignedOnly && !overdueOnly && priority === "All" && status === "All"} onClick={() => quickFilter("all")} />
            <QuickChip label="Unassigned" active={unassignedOnly} onClick={() => quickFilter("unassigned")} />
            <QuickChip label="Overdue" active={overdueOnly} onClick={() => quickFilter("overdue")} />
          </div>
        </section>

        <section className="sticky top-16 z-20 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur supports-backdrop-filter:bg-white/80">
          <div className="grid gap-3 xl:grid-cols-12">
            <div className="relative xl:col-span-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search issues"
                className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 xl:col-span-2">
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option === "All" ? "All Statuses" : option}</option>
              ))}
            </select>

            <select value={priority} onChange={(event) => setPriority(event.target.value as PriorityFilter)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 xl:col-span-2">
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option === "All" ? "All Priorities" : option}</option>
              ))}
            </select>

            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 xl:col-span-2">
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option === "All" ? "All Categories" : option}</option>
              ))}
            </select>

            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 xl:col-span-2">
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

          </div>

          {activeFilters.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={filter.clear}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                >
                  {filter.label}
                  <X className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {loading ? (
          <IssuesSkeleton />
        ) : issues.length === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white px-8 py-12 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="text-base font-semibold text-slate-800">No issues found for selected filters</p>
            <p className="mt-1 text-sm text-slate-500">Try changing filters, search terms, or date range.</p>
          </section>
        ) : (
          <section className="space-y-1.5">
            {selectedIssueIds.length > 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-900">{selectedIssueIds.length} selected</span>
                  <select
                    value={bulkWorkerId}
                    onChange={(event) => setBulkWorkerId(event.target.value)}
                    className="h-9 min-w-52 rounded-lg border border-emerald-200 bg-white px-2 text-sm"
                  >
                    <option value="">Select worker</option>
                    {workers.map((worker) => (
                      <option key={worker._id} value={worker._id}>{worker.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void applyBulkAssign()}
                    disabled={bulkSaving !== null || !bulkWorkerId}
                    className="inline-flex h-9 items-center rounded-lg border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    {bulkSaving === "assign" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Bulk Assign
                  </button>
                  <select
                    value={bulkStatus}
                    onChange={(event) => setBulkStatus(event.target.value as "In Progress" | "Resolved" | "Rejected")}
                    className="h-9 rounded-lg border border-emerald-200 bg-white px-2 text-sm"
                  >
                    <option value="In Progress">Set In Progress</option>
                    <option value="Resolved">Set Resolved</option>
                    <option value="Rejected">Set Rejected</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void applyBulkStatus()}
                    disabled={bulkSaving !== null}
                    className="inline-flex h-9 items-center rounded-lg border border-blue-300 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60"
                  >
                    {bulkSaving === "status" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Bulk Status
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyBulkDelete()}
                    disabled={bulkSaving !== null}
                    className="inline-flex h-9 items-center rounded-lg border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                  >
                    {bulkSaving === "delete" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Delete Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIssueIds([])}
                    disabled={bulkSaving !== null}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="max-h-[68vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5 text-left">
                      <input
                        type="checkbox"
                        checked={displayedIssues.length > 0 && selectedIssueIds.length === displayedIssues.length}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedIssueIds(displayedIssues.map((issue) => issue._id));
                          } else {
                            setSelectedIssueIds([]);
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label="Select all visible issues"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left">Title</th>
                    <th className="px-3 py-2.5 text-left">Priority</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                    <th className="px-3 py-2.5 text-left">Assigned Worker</th>
                    <th className="px-3 py-2.5 text-left">Created / SLA</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedIssues.map((issue) => {
                    const issueDetail = issueDetailsMap[issue._id];
                    const isDone = issue.status === "Resolved";
                    const isRejected = issue.status === "Rejected";
                    const isPending = issue.status === "Pending";
                    const isInProgress = issue.status === "In Progress";
                    const isClosed = isDone || isRejected;
                    const isUnassigned = !issue.assignedStaff?._id;
                    const departmentName = issue.academicDepartment?.name || issue.serviceDepartment?.name || issue.department?.name || "Dept";
                    const ageLabel = getAgeLabel(issue.createdAt);
                    const isOverdue = Boolean(issue.dueDate && new Date(issue.dueDate) < new Date() && !isClosed);
                    const dueBadge = getDueBadge(issue.dueDate, isClosed);
                    const matchingWorkers = getWorkersForIssue(issue);
                    const currentAssigneeId = inlineAssign[issue._id] ?? issue.assignedStaff?._id ?? "";
                    const normalizedCategory = String(issue.category || "").trim().toLowerCase();
                    const categoryClass =
                      CATEGORY_STYLE[normalizedCategory] ||
                      (normalizedCategory.includes("it") || normalizedCategory.includes("network")
                        ? CATEGORY_STYLE["it/network"]
                        : "bg-slate-100 text-slate-700");
                    const canEditPriority = issue.status === "Pending" || issue.status === "In Progress";
                    const isHighPriorityPending = (issue.priority === "High" || issue.priority === "Urgent") && issue.status === "Pending";

                    return (
                      <Fragment key={issue._id}>
                        <tr
                          className={`cursor-pointer border-t border-slate-100 transition hover:bg-emerald-50/70 ${
                            isHighPriorityPending
                              ? "border-l-4 border-l-rose-400 bg-rose-50/30"
                              : isUnassigned
                                ? "border-l-4 border-l-amber-300 bg-amber-50/40"
                                : ""
                          }`}
                          onClick={() => {
                            setOpenActionMenuIssueId(null);
                            router.push(`/dept-admin/issues/${issue._id}`);
                          }}
                        >
                          <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIssueIds.includes(issue._id)}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setSelectedIssueIds((prev) =>
                                  checked ? Array.from(new Set([...prev, issue._id])) : prev.filter((id) => id !== issue._id)
                                );
                              }}
                              className="h-4 w-4 rounded border-slate-300"
                              aria-label={`Select ${issue.title}`}
                            />
                          </td>
                          <td className="group relative px-3 py-2.5">
                            <p className="font-medium text-slate-800">{issue.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>{issue.student?.name || "Student"}</span>
                              <span>•</span>
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">{departmentName}</span>
                              {issue.category ? (
                                <>
                                  <span>•</span>
                                  <span className={`rounded-full px-2 py-0.5 font-semibold ${categoryClass}`}>[{issue.category}]</span>
                                </>
                              ) : null}
                              {issue.tags?.includes("auto_assigned") ? (
                                <>
                                  <span>•</span>
                                  <span className="rounded-full bg-cyan-100 px-2 py-0.5 font-semibold text-cyan-800">Auto-assigned</span>
                                </>
                              ) : null}
                            </div>

                            <div className="pointer-events-none absolute left-3 top-[calc(100%-2px)] z-30 hidden w-80 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg group-hover:block">
                              <p className="line-clamp-3 text-slate-700">{issue.description?.trim() || "No description provided."}</p>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                                <span>Location: {issue.location || "-"}</span>
                                <span>Due: {issue.dueDate ? new Date(issue.dueDate).toLocaleString() : "-"}</span>
                              </div>
                            </div>
                          </td>
                          <td
                            className="px-3 py-2.5"
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                          >
                            <select
                              value={issue.priority || "Medium"}
                              onClick={(event) => event.stopPropagation()}
                              onMouseDown={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                const nextPriority = event.target.value as "Low" | "Medium" | "High" | "Urgent";
                                void updatePriority(issue._id, nextPriority);
                              }}
                              disabled={!canEditPriority || saving}
                              className={`h-8 rounded border px-2 text-xs font-semibold ${
                                PRIORITY_STYLE[issue.priority || "Medium"] || PRIORITY_STYLE.Medium
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                              <option value="Urgent">Urgent</option>
                            </select>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[issue.status] || "bg-slate-100 text-slate-700"}`}>
                              {issue.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={currentAssigneeId}
                              onChange={(event) => {
                                const nextWorkerId = event.target.value;
                                setInlineAssign((prev) => ({ ...prev, [issue._id]: nextWorkerId }));
                                if (nextWorkerId && !isClosed) {
                                  void assignSingle(issue._id, nextWorkerId);
                                }
                              }}
                              disabled={isClosed || matchingWorkers.length === 0 || assigningIssueId === issue._id}
                              className="h-9 min-w-52 rounded border border-slate-200 px-2 text-sm"
                            >
                              <option value="">{isClosed ? "Closed issue" : "Select worker"}</option>
                              {matchingWorkers.map((worker) => (
                                <option key={worker._id} value={worker._id}>{worker.name}</option>
                              ))}
                            </select>
                            {assigningIssueId === issue._id ? (
                              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Assigning...
                              </p>
                            ) : null}
                            {assignedSuccessIssueId === issue._id ? (
                              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Assigned
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">
                            <div>{issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : "-"}</div>
                            {ageLabel ? <div className="mt-1 text-[11px] text-slate-500">{ageLabel}</div> : null}
                            {issue.status === "Resolved" ? (
                              <div className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                Resolved: {formatResolvedAt(issue)}
                              </div>
                            ) : null}
                            {isOverdue ? <div className="mt-1 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Overdue</div> : null}
                            {dueBadge ? (
                              <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${dueBadge.className}`}>
                                {dueBadge.label}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="relative inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setOpenActionMenuIssueId((prev) => (prev === issue._id ? null : issue._id))}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                aria-label="Open actions menu"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>

                              {openActionMenuIssueId === issue._id ? (
                                <div className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                                  <Link href={`/dept-admin/issues/${issue._id}`} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">View details</Link>
                                  {isPending ? (
                                    <button type="button" onClick={() => void applyStatus(issue._id, "In Progress")} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">Move to In Progress</button>
                                  ) : null}
                                  {isInProgress ? (
                                    <button type="button" onClick={() => setPendingResolveIssueId(issue._id)} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">Mark as Resolved</button>
                                  ) : null}
                                  {isPending ? (
                                    <button type="button" onClick={() => setPendingCloseIssueId(issue._id)} className="block w-full px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50">Reject and Close</button>
                                  ) : null}
                                  {!isPending && !isInProgress ? (
                                    <div className="px-3 py-2 text-xs text-slate-500">No actions available</div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <div>
                Showing {totalIssues === 0 ? 0 : (page - 1) * limit + 1}
                -{Math.min(page * limit, totalIssues)} of {totalIssues} issues
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingCloseIssueId)}
        title="Close Issue"
        description="This will close the issue as Rejected (archived for audit), without deleting data."
        confirmLabel="Close Issue"
        tone="warning"
        loading={saving}
        onConfirm={async () => {
          if (!pendingCloseIssueId) return;
          await applyStatus(pendingCloseIssueId, "Rejected");
          setPendingCloseIssueId(null);
        }}
        onClose={() => {
          if (saving) return;
          setPendingCloseIssueId(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingResolveIssueId)}
        title="Mark Issue Resolved"
        description="This will move the issue to Resolved. Confirm before continuing."
        confirmLabel="Resolve Issue"
        tone="neutral"
        loading={saving}
        onConfirm={async () => {
          if (!pendingResolveIssueId) return;
          await applyStatus(pendingResolveIssueId, "Resolved");
          setPendingResolveIssueId(null);
        }}
        onClose={() => {
          if (saving) return;
          setPendingResolveIssueId(null);
        }}
      />
    </DeptAdminShell>
  );
}

function formatResolvedAt(issue: Issue) {
  if (issue.status !== "Resolved") return "-";
  const value = issue.updatedAt || issue.createdAt;
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function IssuesSkeleton() {
  return (
    <div className="space-y-3">
      <div className="skeleton-shimmer h-16 rounded-xl border border-slate-200 bg-white" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="skeleton-shimmer h-20 rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="skeleton-shimmer h-12 rounded-xl border border-slate-200 bg-white" />
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="skeleton-shimmer h-10 rounded bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left shadow-sm transition ${
        active
          ? "border-emerald-300 bg-emerald-50"
          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
      }`}
    >
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </button>
  );
}

function QuickChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-emerald-600 text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50"
      }`}
    >
      {label}
    </button>
  );
}
