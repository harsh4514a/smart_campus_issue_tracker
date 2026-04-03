"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import AdminProtected from "@/components/AdminProtected";
import { authFetch, loadAuth } from "@/lib/client-auth";
import AdminShell from "@/components/admin/AdminShell";
import ConfirmDialog from "@/components/dept-admin/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import { Building2, CalendarDays, ChevronDown, Clock3, Download, Eye, FileText, Filter, MoreHorizontal, Search, X } from "lucide-react";

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
  updatedAt?: string;
  dueDate?: string;
  attachments?: string[];
  resolutionAttachments?: string[];
  student?: {
    _id?: string;
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
  recurring?: boolean;
};

type AuditEntry = {
  _id: string;
  action: string;
  timestamp?: string;
  performedBy?: {
    name?: string;
  };
};

type StatusFilter = "All" | "Pending" | "In Progress" | "Resolved" | "Assigned" | "Unassigned" | "Overdue";
type IssueTab = "active" | "rejected";
type PriorityFilter = "All" | "Low" | "Medium" | "High" | "Urgent";
const POLL_INTERVAL_MS = 20000;

export default function AdminIssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [staffFilterId, setStaffFilterId] = useState("");
  const [studentFilterId, setStudentFilterId] = useState("");
  const [issueTab, setIssueTab] = useState<IssueTab>("active");
  const [viewIssue, setViewIssue] = useState<Issue | null>(null);
  const [viewIssueAuditLogs, setViewIssueAuditLogs] = useState<AuditEntry[]>([]);
  const [viewIssueAuditLoading, setViewIssueAuditLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [triageIssue, setTriageIssue] = useState<Issue | null>(null);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [bulkWorkerId, setBulkWorkerId] = useState("");
  const [bulkStatus, setBulkStatus] = useState<Issue["status"]>("In Progress");
  const [openOverflowIssueId, setOpenOverflowIssueId] = useState<string | null>(null);
  const [pendingRejectIssueId, setPendingRejectIssueId] = useState<string | null>(null);
  const [pendingDeleteIssueId, setPendingDeleteIssueId] = useState<string | null>(null);
  const [pendingBulkAction, setPendingBulkAction] = useState<"reject" | "delete" | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "status" | "department" | "priority">("date_desc");
  const [pageSize, setPageSize] = useState(10);
  const [activePage, setActivePage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);
  const [triageForm, setTriageForm] = useState({
    academicDepartmentId: "",
    serviceDepartmentId: "",
    staffId: "",
    priority: "Medium",
  });
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const auth = useMemo(() => loadAuth(), []);
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  useEffect(() => {
    document.title = "Issue Triage | CampusTracker Admin";
  }, []);

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
      if (!savingId && !document.hidden) {
        load();
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, savingId]);

  useEffect(() => {
    const rawStatus = searchParams.get("status");
    const rawDepartment = searchParams.get("department");
    const rawStaffId = searchParams.get("staffId");
    const rawStudentId = searchParams.get("studentId");

    setDepartmentFilter(rawDepartment ? decodeURIComponent(rawDepartment) : "All");
    setStaffFilterId(rawStaffId || "");
    setStudentFilterId(rawStudentId || "");
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
  }, [searchParams]);

  useEffect(() => {
    const issueId = searchParams.get("issueId");
    if (!issueId) return;

    const matched = issues.find((issue) => issue._id === issueId);
    if (matched) {
      setViewIssue(matched);
    }
  }, [issues, searchParams]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/") {
        const activeTag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
        if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setIsExportMenuOpen(false);
        setOpenOverflowIssueId(null);
        if (lightboxImage) setLightboxImage(null);
        else if (triageIssue) setTriageIssue(null);
        else if (viewIssue) setViewIssue(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxImage, triageIssue, viewIssue]);

  useEffect(() => {
    if (!isExportMenuOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      if (!exportMenuRef.current) return;
      if (!exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [isExportMenuOpen]);

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

  const triageDepartmentOptions = useMemo(() => {
    const names = new Set<string>();
    academicDepartments.forEach((department) => {
      if (department.name?.trim()) names.add(department.name.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [academicDepartments]);

  const categoryOptions = useMemo(() => {
    const names = new Set<string>();
    issues.forEach((issue) => {
      if (issue.category?.trim()) names.add(issue.category.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [issues]);

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
    showToast({ title: "Success", message: "Issue triaged successfully", variant: "success" });
  };

  const onRejectIssue = async (issueId: string) => {
    if (!auth) return;

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
      showToast({ title: "Success", message: "Issue rejected", variant: "success" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reject issue";
      setError(message);
      showToast({ title: "Action Failed", message, variant: "error" });
    } finally {
      setSavingId(null);
    }
  };

  const onDeleteIssue = async (issueId: string) => {
    if (!auth) return;

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
      showToast({ title: "Deleted", message: "Issue deleted permanently", variant: "success" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete issue";
      setError(message);
      showToast({ title: "Delete Failed", message, variant: "error" });
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

    const filtered = activeIssues.filter((issue) => {
      const statusMatch =
        statusFilter === "All"
          ? true
          : statusFilter === "Assigned"
            ? issue.status === "Pending" && Boolean(issue.assignedStaff?._id)
            : statusFilter === "Unassigned"
              ? !issue.assignedStaff?._id
              : statusFilter === "Overdue"
                ? isOverdue(issue.dueDate, issue.status)
                : issue.status === statusFilter;
      if (!statusMatch) return false;

              const priorityMatch = priorityFilter === "All" ? true : (issue.priority || "Medium") === priorityFilter;
              if (!priorityMatch) return false;

              const categoryMatch = categoryFilter === "All" ? true : issue.category === categoryFilter;
              if (!categoryMatch) return false;

              const issueDepartment = issue.serviceDepartment?.name || issue.academicDepartment?.name || issue.department?.name || "Unassigned";
              const departmentMatch = departmentFilter === "All" ? true : issueDepartment === departmentFilter;
              if (!departmentMatch) return false;

              const staffMatch = staffFilterId ? String(issue.assignedStaff?._id || "") === staffFilterId : true;
              if (!staffMatch) return false;

              const studentMatch = studentFilterId ? String(issue.student?._id || "") === studentFilterId : true;
              if (!studentMatch) return false;

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

    return filtered.slice().sort((a, b) => {
      const aResolved = a.status === "Resolved";
      const bResolved = b.status === "Resolved";
      if (aResolved !== bResolved) {
        return aResolved ? 1 : -1;
      }

      if (sortBy === "date_desc") {
        return (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0);
      }

      if (sortBy === "date_asc") {
        return (new Date(a.createdAt || 0).getTime() || 0) - (new Date(b.createdAt || 0).getTime() || 0);
      }

      if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      }

      if (sortBy === "department") {
        const aDepartment = a.serviceDepartment?.name || a.academicDepartment?.name || a.department?.name || "Unassigned";
        const bDepartment = b.serviceDepartment?.name || b.academicDepartment?.name || b.department?.name || "Unassigned";
        return aDepartment.localeCompare(bDepartment);
      }

      const aPriority = a.priority || "Medium";
      const bPriority = b.priority || "Medium";
      const priorityRank: Record<string, number> = { Low: 1, Medium: 2, High: 3, Urgent: 4 };
      return (priorityRank[bPriority] || 0) - (priorityRank[aPriority] || 0);
    });
  }, [activeIssues, categoryFilter, departmentFilter, priorityFilter, searchQuery, sortBy, staffFilterId, statusFilter, studentFilterId]);

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

  useEffect(() => {
    setActivePage(1);
    setRejectedPage(1);
  }, [searchQuery, statusFilter, priorityFilter, categoryFilter, departmentFilter, staffFilterId, studentFilterId, sortBy, issueTab]);

  const activeTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredIssues.length / pageSize)), [filteredIssues.length, pageSize]);
  const rejectedTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredRejectedIssues.length / pageSize)), [filteredRejectedIssues.length, pageSize]);

  useEffect(() => {
    if (activePage > activeTotalPages) setActivePage(activeTotalPages);
  }, [activePage, activeTotalPages]);

  useEffect(() => {
    if (rejectedPage > rejectedTotalPages) setRejectedPage(rejectedTotalPages);
  }, [rejectedPage, rejectedTotalPages]);

  const paginatedActiveIssues = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return filteredIssues.slice(start, start + pageSize);
  }, [filteredIssues, activePage, pageSize]);

  const paginatedRejectedIssues = useMemo(() => {
    const start = (rejectedPage - 1) * pageSize;
    return filteredRejectedIssues.slice(start, start + pageSize);
  }, [filteredRejectedIssues, rejectedPage, pageSize]);

  const selectedVisibleIssueCount = useMemo(
    () => paginatedActiveIssues.filter((issue) => selectedIssueIds.includes(issue._id)).length,
    [paginatedActiveIssues, selectedIssueIds]
  );

  const toggleIssueSelection = (issueId: string, checked: boolean) => {
    setSelectedIssueIds((prev) => {
      if (checked) {
        return prev.includes(issueId) ? prev : [...prev, issueId];
      }
      return prev.filter((id) => id !== issueId);
    });
  };

  const toggleSelectAllActive = (checked: boolean) => {
    if (!checked) {
      setSelectedIssueIds([]);
      return;
    }
    setSelectedIssueIds(paginatedActiveIssues.map((issue) => issue._id));
  };

  const applyBulkStatus = async () => {
    if (!auth || selectedIssueIds.length === 0) return;

    setSavingId("bulk");
    try {
      await Promise.all(
        selectedIssueIds.map((issueId) =>
          authFetch(
            `/api/issues/${issueId}/status`,
            {
              method: "PATCH",
              body: JSON.stringify({ status: bulkStatus }),
            },
            auth.token
          )
        )
      );
      setSelectedIssueIds([]);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to apply bulk status";
      setError(message);
    } finally {
      setSavingId(null);
    }
  };

  const applyBulkAssign = async () => {
    if (!auth || selectedIssueIds.length === 0) return;
    if (!bulkWorkerId) {
      showToast({ title: "Select Worker", message: "Choose a worker for bulk assignment.", variant: "info" });
      return;
    }

    setSavingId("bulk");
    try {
      const selectedIssues = issues.filter((issue) => selectedIssueIds.includes(issue._id));

      const results = await Promise.allSettled(
        selectedIssues.map((issue) => {
          const academicDepartmentId = normalizeId(issue.academicDepartment?._id);
          const serviceDepartmentId = normalizeId(issue.serviceDepartment?._id);
          const departmentId = normalizeId(issue.department?._id);

          if (!academicDepartmentId && !serviceDepartmentId && !departmentId) {
            return Promise.reject(new Error("Missing department mapping for issue"));
          }

          return authFetch(
            `/api/issues/${issue._id}/assign`,
            {
              method: "PATCH",
              body: JSON.stringify({
                academicDepartmentId,
                serviceDepartmentId,
                departmentId,
                staffId: bulkWorkerId,
                priority: issue.priority || "Medium",
                status: "In Progress",
              }),
            },
            auth.token
          );
        })
      );

      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        showToast({
          title: "Bulk Assign Complete",
          message:
            `${successCount} issue${successCount === 1 ? "" : "s"} assigned.` +
            (failCount > 0 ? ` ${failCount} failed.` : ""),
          variant: failCount > 0 ? "info" : "success",
        });
      } else {
        showToast({ title: "Bulk Assign Failed", message: "No selected issues could be assigned.", variant: "error" });
      }

      setSelectedIssueIds([]);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to bulk assign";
      setError(message);
      showToast({ title: "Bulk Assign Failed", message, variant: "error" });
    } finally {
      setSavingId(null);
    }
  };

  const applyBulkReject = async () => {
    if (!auth || selectedIssueIds.length === 0) return;
    setSavingId("bulk");
    try {
      await Promise.all(
        selectedIssueIds.map((issueId) =>
          authFetch(
            `/api/issues/${issueId}/status`,
            {
              method: "PATCH",
              body: JSON.stringify({ status: "Rejected" }),
            },
            auth.token
          )
        )
      );
      setSelectedIssueIds([]);
      showToast({ title: "Success", message: "Selected issues rejected", variant: "success" });
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to bulk reject";
      setError(message);
      showToast({ title: "Bulk Action Failed", message, variant: "error" });
    } finally {
      setSavingId(null);
    }
  };

  const applyBulkDelete = async () => {
    if (!auth || selectedIssueIds.length === 0) return;
    setSavingId("bulk");
    try {
      await Promise.all(
        selectedIssueIds.map((issueId) => authFetch(`/api/issues/${issueId}`, { method: "DELETE" }, auth.token))
      );
      setSelectedIssueIds([]);
      showToast({ title: "Deleted", message: "Selected issues deleted", variant: "success" });
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to bulk delete";
      setError(message);
      showToast({ title: "Bulk Delete Failed", message, variant: "error" });
    } finally {
      setSavingId(null);
    }
  };

  const getExportSource = () => {
    const selected = issues.filter((issue) => selectedIssueIds.includes(issue._id));
    const source =
      selected.length > 0
        ? selected
        : issueTab === "rejected"
          ? filteredRejectedIssues
          : filteredIssues;

    const scope = selected.length > 0 ? "selected" : issueTab === "rejected" ? "rejected" : "filtered";
    return { source, scope };
  };

  const exportIssuesCsv = () => {
    const { source, scope } = getExportSource();

    if (source.length === 0) {
      showToast({ title: "No Data", message: "No issues available to export.", variant: "info" });
      return;
    }

    const rows = [
      ["Issue ID", "Title", "Status", "Priority", "Category", "Location", "Reported By", "Assigned Staff", "Created At"],
      ...source.map((issue) => [
        issue._id,
        issue.title,
        issue.status,
        issue.priority || "",
        issue.category,
        issue.location,
        issue.student?.name || "",
        issue.assignedStaff?.name || "",
        issue.createdAt ? new Date(issue.createdAt).toISOString() : "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `issues-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({
      title: "Export Ready",
      message: `${source.length} issue${source.length === 1 ? "" : "s"} exported to CSV.`,
      variant: "success",
    });
  };

  const exportIssuesPdf = () => {
    const { source, scope } = getExportSource();

    if (source.length === 0) {
      showToast({ title: "No Data", message: "No issues available to export.", variant: "info" });
      return;
    }

    const escapeHtml = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const getIssueIdentifier = (issue: Issue) => {
      const fallbackId = (issue as Issue & { id?: string }).id;
      return String(issue._id || fallbackId || "N/A");
    };

    const generatedAt = new Date();
    const rowsHtml = source
      .map((issue) => {
        const cells = [
          getIssueIdentifier(issue),
          issue.title,
          issue.status,
          issue.priority || "",
          issue.category,
          issue.location,
          issue.student?.name || "",
          issue.assignedStaff?.name || "",
          issue.createdAt ? new Date(issue.createdAt).toLocaleString() : "",
        ];

        return `<tr>${cells
          .map(
            (cell) =>
              `<td>${escapeHtml(String(cell || ""))}</td>`
          )
          .join("")}</tr>`;
      })
      .join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast({ title: "Export Failed", message: "Please allow popups to export PDF.", variant: "error" });
      return;
    }

    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Issues Export</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0 0 16px; color: #475569; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th { border: 1px solid #cbd5e1; background: #f8fafc; padding: 8px; text-align: left; font-size: 12px; }
      td { border: 1px solid #e2e8f0; padding: 8px; vertical-align: top; font-size: 12px; color: #0f172a; overflow-wrap: anywhere; }
      th:first-child, td:first-child { width: 18%; word-break: break-all; }
      @media print {
        body { padding: 0; }
      }
    </style>
  </head>
  <body>
    <h1>CampusTracker Issues Export</h1>
    <p>Scope: ${escapeHtml(scope)} | Generated: ${escapeHtml(generatedAt.toLocaleString())} | Total: ${source.length}</p>
    <table>
      <thead>
        <tr>
          <th>Issue ID</th>
          <th>Title</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Category</th>
          <th>Location</th>
          <th>Reported By</th>
          <th>Assigned Staff</th>
          <th>Created At</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
</html>`);
    printWindow.document.close();

    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        showToast({ title: "Export Failed", message: "Unable to open print dialog for PDF export.", variant: "error" });
      }
    };

    // Some browsers need the new document to fully paint before print works.
    printWindow.onload = () => {
      setTimeout(triggerPrint, 150);
    };

    printWindow.onafterprint = () => {
      printWindow.close();
    };

    showToast({
      title: "Export Ready",
      message: `${source.length} issue${source.length === 1 ? "" : "s"} opened for PDF print/save.`,
      variant: "success",
    });
  };

  const activeFilters = useMemo(() => {
    const chips: Array<{ key: "status" | "priority" | "category" | "department" | "staff" | "student" | "query"; label: string }> = [];
    if (statusFilter !== "All") chips.push({ key: "status", label: `Status: ${statusFilter}` });
    if (priorityFilter !== "All") chips.push({ key: "priority", label: `Priority: ${priorityFilter}` });
    if (categoryFilter !== "All") chips.push({ key: "category", label: `Category: ${categoryFilter}` });
    if (departmentFilter !== "All") chips.push({ key: "department", label: `Department: ${departmentFilter}` });
    if (staffFilterId) {
      const staffName = staffMembers.find((staff) => staff._id === staffFilterId)?.name || "Selected";
      chips.push({ key: "staff", label: `Staff: ${staffName}` });
    }
    if (studentFilterId) chips.push({ key: "student", label: "Student filter" });
    if (searchQuery.trim()) chips.push({ key: "query", label: `Search: ${searchQuery.trim()}` });
    return chips;
  }, [categoryFilter, departmentFilter, priorityFilter, searchQuery, staffFilterId, staffMembers, statusFilter, studentFilterId]);

  const clearSingleFilter = (key: "status" | "priority" | "category" | "department" | "staff" | "student" | "query") => {
    if (key === "status") setStatusFilter("All");
    if (key === "priority") setPriorityFilter("All");
    if (key === "category") setCategoryFilter("All");
    if (key === "department") setDepartmentFilter("All");
    if (key === "staff") setStaffFilterId("");
    if (key === "student") setStudentFilterId("");
    if (key === "query") setSearchQuery("");
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setPriorityFilter("All");
    setCategoryFilter("All");
    setDepartmentFilter("All");
    setStaffFilterId("");
    setStudentFilterId("");
    setSortBy("date_desc");
  };

  useEffect(() => {
    if (!viewIssue) {
      setViewIssueAuditLogs([]);
      setViewIssueAuditLoading(false);
      return;
    }

    if (!auth) return;

    setViewIssueAuditLoading(true);
    authFetch(`/api/issues/${viewIssue._id}/audit`, { method: "GET" }, auth.token)
      .then((data) => {
        setViewIssueAuditLogs((data.logs || []) as AuditEntry[]);
      })
      .catch(() => {
        setViewIssueAuditLogs([]);
      })
      .finally(() => {
        setViewIssueAuditLoading(false);
      });
  }, [auth, viewIssue]);

  return (
    <AdminProtected>
      <AdminShell
        title="Issue Triage"
        subtitle="Assign issues to departments and set priorities"
        headerActions={
          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              title={selectedIssueIds.length > 0 ? "Export selected issues" : "Export current issue list"}
            >
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4" />
            </button>
            {isExportMenuOpen ? (
              <div className="absolute right-0 z-20 mt-2 min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    exportIssuesCsv();
                    setIsExportMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportIssuesPdf();
                    setIsExportMenuOpen(false);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <FileText className="h-4 w-4" />
                  Export PDF
                </button>
              </div>
            ) : null}
          </div>
        }
      >
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search issues..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="relative">
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

              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                disabled={issueTab === "rejected"}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="All">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>

              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                disabled={issueTab === "rejected"}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="All">All Departments</option>
                {triageDepartmentOptions.map((departmentName) => (
                  <option key={departmentName} value={departmentName}>{departmentName}</option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                disabled={issueTab === "rejected"}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="All">All Categories</option>
                {categoryOptions.map((categoryName) => (
                  <option key={categoryName} value={categoryName}>{categoryName}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as "date_desc" | "date_asc" | "status" | "department" | "priority")}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="date_desc">Sort: Newest First</option>
                <option value="date_asc">Sort: Oldest First</option>
                <option value="status">Sort: Status</option>
                <option value="department">Sort: Department</option>
                <option value="priority">Sort: Priority</option>
              </select>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeFilters.length > 0 ? (
                <>
                  <span className="text-xs font-semibold text-slate-500">Filters applied:</span>
                  {activeFilters.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => clearSingleFilter(chip.key)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {chip.label}
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </>
              ) : (
                <span className="text-xs text-slate-500">No filters applied</span>
              )}
              <button
                type="button"
                className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={resetAllFilters}
              >
                Reset All
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIssueTab("active")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  issueTab === "active"
                    ? "bg-teal-600 text-white shadow-sm ring-2 ring-teal-200"
                    : "border border-transparent text-slate-700 hover:bg-slate-100"
                }`}
              >
                Main Issues
              </button>
              <button
                type="button"
                onClick={() => setIssueTab("rejected")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  issueTab === "rejected"
                    ? "bg-rose-600 text-white shadow-sm ring-2 ring-rose-200"
                    : "border border-transparent text-slate-700 hover:bg-slate-100"
                }`}
              >
                Rejected Issues
              </button>
            </div>
          </section>

          {issueTab === "active" && selectedIssueIds.length > 0 ? (
            <section className="sticky bottom-4 z-20 overflow-x-auto rounded-xl border border-emerald-200 bg-emerald-50/95 p-2.5 shadow-lg backdrop-blur">
              <div className="flex min-w-max items-center gap-2.5">
                <p className="text-lg font-bold text-emerald-900">{selectedIssueIds.length} selected</p>

                <select
                  value={bulkWorkerId}
                  onChange={(event) => setBulkWorkerId(event.target.value)}
                  className="h-9 min-w-64 rounded-xl border border-emerald-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500"
                >
                  <option value="">Select worker</option>
                  {staffMembers.map((worker) => (
                    <option key={worker._id} value={worker._id}>{worker.name}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={applyBulkAssign}
                  disabled={savingId === "bulk" || !bulkWorkerId}
                  className="h-9 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {savingId === "bulk" ? "Applying..." : "Bulk Assign"}
                </button>

                <select
                  value={bulkStatus}
                  onChange={(event) => setBulkStatus(event.target.value as Issue["status"])}
                  className="h-9 min-w-52 rounded-xl border border-emerald-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500"
                >
                  <option value="In Progress">Set In Progress</option>
                  <option value="Resolved">Set Resolved</option>
                </select>

                <button
                  type="button"
                  onClick={applyBulkStatus}
                  disabled={savingId === "bulk"}
                  className="h-9 rounded-xl border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60"
                >
                  {savingId === "bulk" ? "Applying..." : "Bulk Status"}
                </button>

                <button
                  type="button"
                  onClick={() => setPendingBulkAction("reject")}
                  disabled={savingId === "bulk"}
                  className="h-9 rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                >
                  Reject Selected
                </button>

                <button
                  type="button"
                  onClick={() => setPendingBulkAction("delete")}
                  disabled={savingId === "bulk"}
                  className="h-9 rounded-xl border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                >
                  Delete Selected
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedIssueIds([])}
                  disabled={savingId === "bulk"}
                  className="h-9 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
            </section>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="skeleton-shimmer h-28 rounded-xl border border-slate-200 bg-white" />
              ))}
            </div>
          ) : null}
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

          {!loading && !error && issueTab === "active" && filteredIssues.length > 0 ? (
            <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-2">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <label className="inline-flex items-center gap-3 text-base font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={paginatedActiveIssues.length > 0 && selectedVisibleIssueCount === paginatedActiveIssues.length}
                    onChange={(event) => toggleSelectAllActive(event.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-teal-600"
                  />
                  <span>Title</span>
                </label>
                <span className="text-xs font-semibold text-slate-500">
                  {selectedVisibleIssueCount} / {paginatedActiveIssues.length} selected on this page
                </span>
              </div>

              <div className="space-y-2">
              {paginatedActiveIssues.map((issue) => {
                const isSelected = selectedIssueIds.includes(issue._id);
                const isClosed = issue.status === "Resolved" || issue.status === "Rejected";
                return (
                  <article
                    key={issue._id}
                    className={`rounded-xl border bg-white p-5 transition hover:scale-[1.01] hover:shadow-md ${
                      isSelected ? "border-teal-300 ring-1 ring-teal-100" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => toggleIssueSelection(issue._id, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600"
                        aria-label={`Select issue ${issue.title}`}
                      />
                      <h3 className="text-2l font-semibold text-slate-900">{issue.title}</h3>
                      <StatusBadge status={issue.status} />
                      {isOverdue(issue.dueDate, issue.status) ? <OverdueBadge /> : null}
                      <SlaDueBadge dueDate={issue.dueDate} status={issue.status} />
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          issue.assignedStaff
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {issue.assignedStaff ? "Assigned" : "Unassigned"}
                      </span>
                      {issue.assignedStaff && issue.priority ? (
                        <PriorityBadge priority={issue.priority} />
                      ) : null}
                      {issue.recurring ? (
                        <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                          Recurring
                        </span>
                      ) : null}
                    </div>

                    <p className="truncate whitespace-nowrap overflow-hidden text-ellipsis text-sm text-slate-600" title={issue.description || issue.category}>
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
                      {issue.status === "Resolved" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                          <Clock3 className="h-3.5 w-3.5" />
                          Resolved On: {formatDateTime(getResolvedAt(issue))}
                        </span>
                      ) : null}
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
                      disabled={savingId === issue._id || isClosed}
                    >
                      {savingId === issue._id ? "Saving..." : "Triage"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                      onClick={() => setPendingRejectIssueId(issue._id)}
                      disabled={savingId === issue._id || isClosed}
                    >
                      {savingId === issue._id ? "Saving..." : "Reject"}
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        onClick={() => setOpenOverflowIssueId((prev) => (prev === issue._id ? null : issue._id))}
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openOverflowIssueId === issue._id ? (
                        <div className="absolute right-0 top-10 z-10 min-w-36 rounded-lg border border-slate-200 bg-white shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                            onClick={() => {
                              setOpenOverflowIssueId(null);
                              setPendingDeleteIssueId(issue._id);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                    </div>
                  </article>
                );
              })}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing {filteredIssues.length === 0 ? 0 : (activePage - 1) * pageSize + 1}
                  -{Math.min(activePage * pageSize, filteredIssues.length)} of {filteredIssues.length} active issues
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={String(pageSize)}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setActivePage(1);
                      setRejectedPage(1);
                    }}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
                  >
                    <option value="10">10 / page</option>
                    <option value="20">20 / page</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setActivePage((prev) => Math.max(1, prev - 1))}
                    disabled={activePage === 1}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">Page {activePage} of {activeTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setActivePage((prev) => Math.min(activeTotalPages, prev + 1))}
                    disabled={activePage >= activeTotalPages}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {!loading && !error && issueTab === "rejected" && filteredRejectedIssues.length > 0 ? (
            <div className="space-y-2.5">
              {paginatedRejectedIssues.map((issue) => {
                return (
                  <article key={issue._id} className="rounded-xl border border-slate-200 bg-white p-5 transition hover:scale-[1.01] hover:shadow-md">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-2l font-semibold text-slate-900">{issue.title}</h3>
                      <StatusBadge status={issue.status} />
                    </div>

                    <p className="truncate whitespace-nowrap overflow-hidden text-ellipsis text-sm text-slate-600" title={issue.description || issue.category}>{issue.description || issue.category}</p>

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
                      onClick={() => setPendingDeleteIssueId(issue._id)}
                      disabled={savingId === issue._id}
                    >
                      {savingId === issue._id ? "Saving..." : "Delete"}
                    </button>
                  </div>
                    </div>
                  </article>
                );
              })}

              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing {filteredRejectedIssues.length === 0 ? 0 : (rejectedPage - 1) * pageSize + 1}
                  -{Math.min(rejectedPage * pageSize, filteredRejectedIssues.length)} of {filteredRejectedIssues.length} rejected issues
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectedPage((prev) => Math.max(1, prev - 1))}
                    disabled={rejectedPage === 1}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">Page {rejectedPage} of {rejectedTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setRejectedPage((prev) => Math.min(rejectedTotalPages, prev + 1))}
                    disabled={rejectedPage >= rejectedTotalPages}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : null}

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
                  {isOverdue(viewIssue.dueDate, viewIssue.status) ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                      This issue is overdue by {formatOverdueForIssue(viewIssue.dueDate)}.
                    </div>
                  ) : null}

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
                    <p><span className="font-semibold text-slate-700">Current status:</span> {viewIssue.status}</p>
                    <p>
                      <span className="font-semibold text-slate-700">Resolved on:</span>{" "}
                      {viewIssue.status === "Resolved" ? formatDateTime(getResolvedAt(viewIssue)) : "Not resolved yet"}
                    </p>
                  </div>

                  {viewIssue.imageUrl ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Reported Photo</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {getIssueImageUrls(viewIssue).map((src) => (
                          <button
                            key={src}
                            type="button"
                            className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                            onClick={() => setLightboxImage(src)}
                          >
                            <Image
                              src={src}
                              alt="Issue attachment"
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
                      onClick={() => setPendingRejectIssueId(viewIssue._id)}
                      disabled={savingId === viewIssue._id || viewIssue.status === "Resolved"}
                    >
                      {savingId === viewIssue._id ? "Saving..." : "Reject"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="h-10 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    onClick={() => setPendingDeleteIssueId(viewIssue._id)}
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
                    disabled={viewIssue.status === "Rejected" || viewIssue.status === "Resolved"}
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

          <ConfirmDialog
            open={Boolean(pendingRejectIssueId)}
            title="Reject Issue"
            description="Are you sure? This action cannot be undone from active triage queue."
            confirmLabel="Reject"
            tone="warning"
            loading={Boolean(savingId)}
            onConfirm={async () => {
              if (!pendingRejectIssueId) return;
              await onRejectIssue(pendingRejectIssueId);
              setPendingRejectIssueId(null);
            }}
            onClose={() => {
              if (savingId) return;
              setPendingRejectIssueId(null);
            }}
          />

          <ConfirmDialog
            open={Boolean(pendingDeleteIssueId)}
            title="Delete Issue"
            description="Are you sure? This cannot be undone."
            confirmLabel="Delete"
            tone="danger"
            loading={Boolean(savingId)}
            onConfirm={async () => {
              if (!pendingDeleteIssueId) return;
              await onDeleteIssue(pendingDeleteIssueId);
              setPendingDeleteIssueId(null);
            }}
            onClose={() => {
              if (savingId) return;
              setPendingDeleteIssueId(null);
            }}
          />

          <ConfirmDialog
            open={pendingBulkAction !== null}
            title={pendingBulkAction === "delete" ? "Bulk Delete Issues" : "Bulk Reject Issues"}
            description={pendingBulkAction === "delete" ? "Delete all selected issues permanently?" : "Reject all selected issues?"}
            confirmLabel={pendingBulkAction === "delete" ? "Delete Selected" : "Reject Selected"}
            tone={pendingBulkAction === "delete" ? "danger" : "warning"}
            loading={savingId === "bulk"}
            onConfirm={async () => {
              if (pendingBulkAction === "delete") {
                await applyBulkDelete();
              } else if (pendingBulkAction === "reject") {
                await applyBulkReject();
              }
              setPendingBulkAction(null);
            }}
            onClose={() => {
              if (savingId === "bulk") return;
              setPendingBulkAction(null);
            }}
          />
        </div>
      </AdminShell>
    </AdminProtected>
  );
}

function StatusBadge({ status }: { status: Issue["status"] }) {
  if (status === "Rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
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
    return <span className="text-sm font-semibold text-red-600">— Urgent</span>;
  }

  if (priority === "High") {
    return <span className="text-sm font-semibold text-orange-600">— High</span>;
  }

  if (priority === "Medium") {
    return <span className="text-sm font-semibold text-amber-600">— Medium</span>;
  }

  return <span className="text-sm font-semibold text-slate-600">— Low</span>;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function getResolvedAt(issue: Issue) {
  if (issue.status !== "Resolved") return undefined;
  return issue.updatedAt || issue.createdAt;
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

function isOverdue(dueDate?: string, status?: Issue["status"]) {
  if (!dueDate) return false;
  if (status === "Resolved" || status === "Rejected") return false;

  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return false;

  return Date.now() > due;
}

function formatOverdueForIssue(dueDate?: string) {
  if (!dueDate) return "0 hours";

  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return "0 hours";

  const overdueMs = Math.max(Date.now() - due, 0);
  const dayMs = 24 * 60 * 60 * 1000;

  if (overdueMs >= dayMs) {
    const days = Math.floor(overdueMs / dayMs);
    return `${days} day${days > 1 ? "s" : ""}`;
  }

  const hours = Math.max(1, Math.floor(overdueMs / (60 * 60 * 1000)));
  return `${hours} hour${hours > 1 ? "s" : ""}`;
}

function OverdueBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
      Overdue
    </span>
  );
}

function SlaDueBadge({ dueDate, status }: { dueDate?: string; status?: Issue["status"] }) {
  if (!dueDate || status === "Resolved" || status === "Rejected") return null;

  const dueTs = new Date(dueDate).getTime();
  if (Number.isNaN(dueTs)) return null;

  const deltaMs = getDeltaToNowMs(dueTs);
  const dayMs = 24 * 60 * 60 * 1000;

  let label = "";
  let className = "";

  if (deltaMs < 0) {
    label = `Overdue ${formatOverdueForIssue(dueDate)}`;
    className = "border-red-200 bg-red-100 text-red-700";
  } else {
    const daysLeft = deltaMs / dayMs;
    if (daysLeft >= 3) {
      label = "Due in 3+ days";
      className = "border-green-200 bg-green-100 text-green-700";
    } else if (daysLeft >= 1) {
      label = "Due in 1-2 days";
      className = "border-amber-200 bg-amber-100 text-amber-700";
    } else {
      label = "Due in <1 day";
      className = "border-orange-200 bg-orange-100 text-orange-700";
    }
  }

  return (
    <span title={`SLA: ${label}`} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function getDeltaToNowMs(targetTs: number) {
  return targetTs - Date.now();
}

function getIssueImageUrls(issue: Issue) {
  return Array.from(
    new Set(
      [issue.imageUrl, ...(issue.attachments || []), ...(issue.resolutionAttachments || [])].filter(
        (value): value is string => typeof value === "string" && value.length > 0
      )
    )
  );
}