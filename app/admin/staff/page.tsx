"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import AdminProtected from "@/components/AdminProtected";
import { authFetch, loadAuth } from "@/lib/client-auth";
import AdminShell from "@/components/admin/AdminShell";
import { useToast } from "@/components/ToastProvider";
import { AlertTriangle, BriefcaseBusiness, Pencil, Search, Trash2, UserCheck, UserPlus, UserX, Users, X } from "lucide-react";

type Department = { _id: string; name: string; type?: "Academic" | "Service" };
type Faculty = {
  _id: string;
  name: string;
  email: string;
  role?: "staff";
  isActive?: boolean;
  isDemoUser?: boolean;
  department?: Department;
  academicDepartment?: Department;
  managedDepartments?: Department[];
  serviceDepartment?: Department;
  createdAt?: string;
};

type IssueLite = {
  _id: string;
  status: "Pending" | "In Progress" | "Resolved" | "Rejected";
  assignedStaff?: { _id?: string } | null;
};

const POLL_INTERVAL_MS = 10000;

export default function AdminStaffPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    academicDepartmentIds: [] as string[],
    serviceDepartmentId: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [academicFilter, setAcademicFilter] = useState("All");
  const [serviceFilter, setServiceFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeIssueMap, setActiveIssueMap] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<"joined_desc" | "joined_asc" | "status" | "department">("joined_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();

  const auth = loadAuth();

  useEffect(() => {
    document.title = "Staff | CampusTracker Admin";
  }, []);

  const loadData = (silent = false) => {
    if (!auth) return;
    if (!silent) {
      setLoading(true);
    }

    Promise.all([
      authFetch("/api/admin/departments", { method: "GET" }, auth.token),
      authFetch("/api/admin/staff", { method: "GET" }, auth.token),
      authFetch("/api/admin/issues", { method: "GET" }, auth.token),
    ])
      .then(([deptRes, staffRes, issueRes]) => {
        setDepartments(deptRes.departments || []);
        const allStaff = (staffRes.faculty || []) as Faculty[];
        setFaculty(
          process.env.NODE_ENV === "production"
            ? allStaff.filter((item) => !item.isDemoUser)
            : allStaff
        );

        const issues = (issueRes.issues || []) as IssueLite[];
        const nextMap: Record<string, number> = {};
        issues.forEach((issue) => {
          const staffId = String(issue.assignedStaff?._id || "");
          if (!staffId) return;
          if (issue.status === "Resolved" || issue.status === "Rejected") return;
          nextMap[staffId] = (nextMap[staffId] || 0) + 1;
        });
        setActiveIssueMap(nextMap);
      })
      .catch((err) =>
        showToast({
          title: "Load Failed",
          message: err instanceof Error ? err.message : "Failed to load data",
          variant: "error",
        })
      )
      .finally(() => {
        if (!silent) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auth) return;
    const intervalId = window.setInterval(() => {
      if (!saving && !deletingId && !showForm) {
        loadData(true);
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, saving, deletingId, showForm]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/") {
        const activeTag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
        if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key === "Escape" && showForm) {
        setShowForm(false);
        setEditingId(null);
        setForm({ name: "", email: "", academicDepartmentIds: [], serviceDepartmentId: "" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showForm]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    let successMessage = "";
    try {
      if (editingId) {
        if (form.academicDepartmentIds.length === 0 && !form.serviceDepartmentId) {
          showToast({
            title: "Validation Error",
            message: "Please select at least one department",
            variant: "error",
          });
          setSaving(false);
          return;
        }

        const updateResponse = await authFetch(
          `/api/admin/staff/${editingId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name: form.name,
              email: form.email,
              academicDepartmentIds: form.academicDepartmentIds,
              serviceDepartmentId: form.serviceDepartmentId,
            }),
          },
          auth.token
        );
        successMessage =
          typeof updateResponse?.message === "string" && updateResponse.message.trim().length > 0
            ? updateResponse.message
            : "Staff member updated successfully";
      } else {
        if (form.academicDepartmentIds.length === 0 && !form.serviceDepartmentId) {
          showToast({
            title: "Validation Error",
            message: "Please select at least one department",
            variant: "error",
          });
          setSaving(false);
          return;
        }

        const createResponse = await authFetch(
          "/api/admin/staff",
          {
            method: "POST",
            body: JSON.stringify({
              name: form.name,
              email: form.email,
              academicDepartmentIds: form.academicDepartmentIds,
              serviceDepartmentId: form.serviceDepartmentId,
            }),
          },
          auth.token
        );
        successMessage =
          typeof createResponse?.message === "string" && createResponse.message.trim().length > 0
            ? createResponse.message
            : "Staff member created. Password setup email sent.";
      }

      setForm({ name: "", email: "", academicDepartmentIds: [], serviceDepartmentId: "" });
      setShowForm(false);
      setEditingId(null);
      showToast({
        title: "Success",
        message: successMessage,
        variant: "success",
      });
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save staff";
      showToast({ title: "Save Failed", message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const filteredStaff = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = faculty.filter((staff) => {
      const staffAcademicDepartmentIds = [
        ...(Array.isArray(staff.managedDepartments) ? staff.managedDepartments.map((department) => department._id) : []),
        staff.academicDepartment?._id || (staff.department?.type === "Academic" ? staff.department._id : ""),
      ].filter(Boolean);
      const staffServiceDepartmentId =
        staff.serviceDepartment?._id || (staff.department?.type === "Service" ? staff.department._id : "");

      const academicMatch =
        academicFilter === "All" ||
        staffAcademicDepartmentIds.includes(academicFilter);
      const serviceMatch = serviceFilter === "All" || staffServiceDepartmentId === serviceFilter;
      const statusMatch =
        statusFilter === "All"
          ? true
          : statusFilter === "Active"
            ? staff.isActive !== false
            : staff.isActive === false;

      if (!academicMatch || !serviceMatch || !statusMatch) return false;

      if (!normalized) return true;

      const haystack = `${staff.name} ${staff.email}`.toLowerCase();
      return haystack.includes(normalized);
    });

    return filtered.slice().sort((a, b) => {
      if (sortBy === "joined_desc") {
        return (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0);
      }

      if (sortBy === "joined_asc") {
        return (new Date(a.createdAt || 0).getTime() || 0) - (new Date(b.createdAt || 0).getTime() || 0);
      }

      if (sortBy === "status") {
        const aActive = a.isActive === false ? 0 : 1;
        const bActive = b.isActive === false ? 0 : 1;
        return bActive - aActive;
      }

      const aDepartment = [
        ...(Array.isArray(a.managedDepartments) ? a.managedDepartments.map((department) => department.name) : []),
        a.academicDepartment?.name || (a.department?.type === "Academic" ? a.department.name : ""),
      ]
        .filter(Boolean)
        .join(", ");
      const bDepartment = [
        ...(Array.isArray(b.managedDepartments) ? b.managedDepartments.map((department) => department.name) : []),
        b.academicDepartment?.name || (b.department?.type === "Academic" ? b.department.name : ""),
      ]
        .filter(Boolean)
        .join(", ");
      return aDepartment.localeCompare(bDepartment);
    });
  }, [academicFilter, faculty, query, serviceFilter, sortBy, statusFilter]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: "query" | "academic" | "service" | "status"; label: string }> = [];
    if (query.trim()) chips.push({ key: "query", label: `Search: ${query.trim()}` });
    if (academicFilter !== "All") {
      const label = departments.find((department) => department._id === academicFilter)?.name || "Academic";
      chips.push({ key: "academic", label: `Academic: ${label}` });
    }
    if (serviceFilter !== "All") {
      const label = departments.find((department) => department._id === serviceFilter)?.name || "Service";
      chips.push({ key: "service", label: `Service: ${label}` });
    }
    if (statusFilter !== "All") chips.push({ key: "status", label: `Status: ${statusFilter}` });
    return chips;
  }, [academicFilter, departments, query, serviceFilter, statusFilter]);

  const clearFilterChip = (key: "query" | "academic" | "service" | "status") => {
    if (key === "query") setQuery("");
    if (key === "academic") setAcademicFilter("All");
    if (key === "service") setServiceFilter("All");
    if (key === "status") setStatusFilter("All");
    setCurrentPage(1);
  };

  const resetAllFilters = () => {
    setQuery("");
    setAcademicFilter("All");
    setServiceFilter("All");
    setStatusFilter("All");
    setSortBy("joined_desc");
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [query, academicFilter, serviceFilter, statusFilter, sortBy]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredStaff.length / pageSize)), [filteredStaff.length, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStaff.slice(start, start + pageSize);
  }, [filteredStaff, currentPage, pageSize]);

  const exportCsv = () => {
    const rows = [
      ["Name", "Email", "Status", "Academic Departments", "Service Department", "Active Issues", "Joined"],
      ...filteredStaff.map((staff) => [
        staff.name,
        staff.email,
        staff.isActive === false ? "Inactive" : "Active",
        [
          ...(Array.isArray(staff.managedDepartments) ? staff.managedDepartments.map((department) => department.name) : []),
          staff.academicDepartment?.name || (staff.department?.type === "Academic" ? staff.department.name : ""),
        ]
          .filter(Boolean)
          .filter((value, index, arr) => arr.indexOf(value) === index)
          .join(", "),
        staff.serviceDepartment?.name || (staff.department?.type === "Service" ? staff.department.name : ""),
        String(activeIssueMap[staff._id] || 0),
        formatDate(staff.createdAt),
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `staff-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const academicDepartments = useMemo(
    () => departments.filter((department) => department.type === "Academic"),
    [departments]
  );

  const serviceDepartments = useMemo(
    () => departments.filter((department) => department.type === "Service"),
    [departments]
  );

  const staffSummary = useMemo(() => {
    const nonDemoFilteredStaff = filteredStaff.filter((item) => !item.isDemoUser);
    const totalStaff = nonDemoFilteredStaff.length;
    const activeStaff = nonDemoFilteredStaff.filter((item) => item.isActive !== false).length;
    const inactiveStaff = totalStaff - activeStaff;

    const totalOpenIssues = nonDemoFilteredStaff.reduce((sum, item) => sum + (activeIssueMap[item._id] || 0), 0);
    const overloadedStaff = nonDemoFilteredStaff.filter((item) => (activeIssueMap[item._id] || 0) >= 5).length;
    const availableStaff = nonDemoFilteredStaff.filter((item) => (activeIssueMap[item._id] || 0) === 0 && item.isActive !== false).length;

    return {
      totalStaff,
      activeStaff,
      inactiveStaff,
      overloadedStaff,
      availableStaff,
      avgOpenIssues: totalStaff === 0 ? 0 : totalOpenIssues / totalStaff,
    };
  }, [filteredStaff, activeIssueMap]);

  const onEdit = (staff: Faculty) => {
    setEditingId(staff._id);
    setShowForm(true);
    const fallbackAcademicDepartmentId =
      !staff.academicDepartment?._id && staff.department?.type === "Academic"
        ? staff.department._id
        : "";
    const fallbackServiceDepartmentId =
      !staff.serviceDepartment?._id && staff.department?.type === "Service"
        ? staff.department._id
        : "";

    setForm({
      name: staff.name,
      email: staff.email,
      academicDepartmentIds: [
        ...(Array.isArray(staff.managedDepartments) ? staff.managedDepartments.map((department) => department._id) : []),
        staff.academicDepartment?._id || fallbackAcademicDepartmentId,
      ].filter(Boolean),
      serviceDepartmentId: staff.serviceDepartment?._id || fallbackServiceDepartmentId,
    });
  };

  const onDelete = async (staff: Faculty) => {
    if (!auth) return;
    const confirmed = window.confirm(`Delete staff member ${staff.name}?`);
    if (!confirmed) return;

    setDeletingId(staff._id);
    try {
      await authFetch(`/api/admin/staff/${staff._id}`, { method: "DELETE" }, auth.token);
      showToast({ title: "Success", message: "Staff member deleted successfully", variant: "success" });
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete staff";
      showToast({ title: "Delete Failed", message, variant: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const closeFormModal = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", email: "", academicDepartmentIds: [], serviceDepartmentId: "" });
  };

  const toggleAcademicDepartment = (departmentId: string) => {
    setForm((prev) => {
      const alreadySelected = prev.academicDepartmentIds.includes(departmentId);
      return {
        ...prev,
        academicDepartmentIds: alreadySelected
          ? prev.academicDepartmentIds.filter((id) => id !== departmentId)
          : [...prev.academicDepartmentIds, departmentId],
      };
    });
  };

  return (
    <AdminProtected allowedAdminRoles={["super_admin"]}>
      <AdminShell
        title="Staff Management"
        subtitle="Manage staff accounts and department assignments"
        headerActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => {
                if (showForm && !editingId) {
                  closeFormModal();
                  return;
                }
                setEditingId(null);
                setForm({ name: "", email: "", academicDepartmentIds: [], serviceDepartmentId: "" });
                setShowForm(true);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <UserPlus className="h-4 w-4" />
              Add Staff
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
              <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between px-5 pt-5">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">
                      {editingId ? "Edit Staff Member" : "Add New Staff Member"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Enter the details for the new staff member. A password setup link will be sent by email.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeFormModal}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form className="px-5 pb-5 pt-3 space-y-4" onSubmit={onSubmit} autoComplete="off">
                  <input type="text" name="fake-username" autoComplete="username" className="hidden" tabIndex={-1} />
                  <input type="password" name="fake-password" autoComplete="current-password" className="hidden" tabIndex={-1} />
                  <Input
                    label="Email *"
                    placeholder="staff@example.com"
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    autoComplete="off"
                    required
                  />

                  <Input
                    label="Full Name *"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    autoComplete="off"
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Academic Departments</label>
                    <p className="mt-1 text-xs text-slate-500">Select one or more academic departments.</p>
                    <div className="mt-2 max-h-36 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                      {academicDepartments.map((department) => (
                        <label key={department._id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={form.academicDepartmentIds.includes(department._id)}
                            onChange={() => toggleAcademicDepartment(department._id)}
                          />
                          <span>{department.name}</span>
                        </label>
                      ))}
                      {academicDepartments.length === 0 ? (
                        <p className="px-1 py-1 text-xs text-slate-500">No academic departments found.</p>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Service Department</label>
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      value={form.serviceDepartmentId}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          serviceDepartmentId: e.target.value,
                        })
                      }
                    >
                      <option value="">Select service department</option>
                      {serviceDepartments.map((department) => (
                        <option key={department._id} value={department._id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={closeFormModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="h-10 rounded-lg bg-teal-600 text-white px-4 text-sm font-semibold hover:bg-teal-700 disabled:opacity-60"
                      disabled={saving}
                    >
                      {saving ? "Saving..." : editingId ? "Update Staff Account" : "Create Staff Account"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Staff</p>
                <Users className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{staffSummary.totalStaff}</p>
              <p className="mt-1 text-xs text-slate-500">All registered staff accounts</p>
            </article>

            <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Active Staff</p>
                <UserCheck className="h-4 w-4 text-emerald-700" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{staffSummary.activeStaff}</p>
              <p className="mt-1 text-xs text-emerald-700">Currently available for assignments</p>
            </article>

            <article className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Inactive Staff</p>
                <UserX className="h-4 w-4 text-rose-700" />
              </div>
              <p className="mt-2 text-2xl font-bold text-rose-900">{staffSummary.inactiveStaff}</p>
              <p className="mt-1 text-xs text-rose-700">Accounts marked inactive</p>
            </article>

            <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Overloaded</p>
                <AlertTriangle className="h-4 w-4 text-amber-700" />
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-900">{staffSummary.overloadedStaff}</p>
              <p className="mt-1 text-xs text-amber-700">Staff with 5+ active issues</p>
            </article>

            <article className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Capacity</p>
                <BriefcaseBusiness className="h-4 w-4 text-sky-700" />
              </div>
              <p className="mt-2 text-2xl font-bold text-sky-900">{staffSummary.availableStaff}</p>
              <p className="mt-1 text-xs text-sky-700">Free staff | Avg open issues {staffSummary.avgOpenIssues.toFixed(1)}</p>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="overflow-x-auto">
              <div className="flex min-w-280 items-center gap-3">
                <div className="relative w-70 shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                  placeholder="Search staff by name or email..."
                />
              </div>

                <select
                  value={academicFilter}
                  onChange={(e) => setAcademicFilter(e.target.value)}
                  className="h-11 w-60 shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                >
                  <option value="All">All Academic Departments</option>
                  {academicDepartments.map((department) => (
                    <option key={department._id} value={department._id}>
                      {department.name}
                    </option>
                  ))}
                </select>

                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="h-11 w-60 shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                >
                  <option value="All">All Service Departments</option>
                  {serviceDepartments.map((department) => (
                    <option key={department._id} value={department._id}>
                      {department.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "All" | "Active" | "Inactive")}
                  className="h-11 w-45 shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                >
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as "joined_desc" | "joined_asc" | "status" | "department")}
                  className="h-11 w-45 shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                >
                  <option value="joined_desc">Sort: Newest Joined</option>
                  <option value="joined_asc">Sort: Oldest Joined</option>
                  <option value="status">Sort: Status</option>
                  <option value="department">Sort: Department</option>
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeFilterChips.length > 0 ? (
                <>
                  <span className="text-xs font-semibold text-slate-500">Filters applied:</span>
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => clearFilterChip(chip.key)}
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
                onClick={resetAllFilters}
                className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset All
              </button>
            </div>
          </section>

          {loading ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="skeleton-shimmer h-10 rounded bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Academic Department</Th>
                    <Th>Service Department</Th>
                    <Th>Active Issues</Th>
                    <Th>Workload</Th>
                    <Th>Status</Th>
                    <Th>Joined</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStaff.map((staff) => (
                    <tr key={staff._id} className="cursor-pointer border-b border-slate-200 transition hover:bg-gray-50 last:border-b-0">
                      <Td className="font-semibold text-slate-800">{staff.name}</Td>
                      <Td>{staff.email}</Td>
                      <Td>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {[
                            ...(Array.isArray(staff.managedDepartments) ? staff.managedDepartments.map((department) => department.name) : []),
                            staff.academicDepartment?.name || (staff.department?.type === "Academic" ? staff.department.name : ""),
                          ]
                            .filter(Boolean)
                            .filter((value, index, arr) => arr.indexOf(value) === index)
                            .join(", ") || "—"}
                        </span>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {staff.serviceDepartment?.name || (staff.department?.type === "Service" ? staff.department.name : "—")}
                        </span>
                      </Td>
                      <Td>
                        {(activeIssueMap[staff._id] || 0) > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            {activeIssueMap[staff._id] || 0}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">0</span>
                        )}
                      </Td>
                      <Td>
                        {(() => {
                          const max = 5;
                          const value = activeIssueMap[staff._id] || 0;
                          const ratio = Math.min(1, Math.max(0, value / max));
                          const percentage = ratio * 100;
                          const barTone = percentage >= 85 ? "bg-red-500" : percentage >= 60 ? "bg-amber-500" : "bg-green-500";
                          return (
                            <div className="flex flex-col gap-1">
                              <div className="h-2.5 w-24 rounded-full bg-slate-200" title={`Workload ${Math.round(percentage)}%`}> 
                                <div className={`h-2.5 rounded-full ${barTone}`} style={{ width: `${percentage}%` }} />
                              </div>
                              <span className="text-xs text-slate-400">{value}/{max} ({Math.round(percentage)}%)</span>
                            </div>
                          );
                        })()}
                      </Td>
                      <Td>
                        <span className="inline-flex items-center rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
                          {staff.isActive === false ? "Inactive" : "Active"}
                        </span>
                        {staff.isDemoUser && process.env.NODE_ENV !== "production" ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Test</span>
                        ) : null}
                      </Td>
                      <Td>{formatDate(staff.createdAt)}</Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/admin/issues?status=Assigned&staffId=${staff._id}`}
                            className="inline-flex h-8 min-w-24 items-center justify-center whitespace-nowrap rounded-md border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                            title="View assigned issues"
                          >
                            View Issues
                          </a>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                            onClick={() => onEdit(staff)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"
                            onClick={() => onDelete(staff)}
                            disabled={deletingId === staff._id}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                  {filteredStaff.length === 0 && (
                    <tr>
                      <Td className="py-10 text-center text-slate-500" colSpan={9}>
                        No data available
                      </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing {filteredStaff.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                -{Math.min(currentPage * pageSize, filteredStaff.length)} of {filteredStaff.length} filtered staff ({faculty.length} total)
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
          )}
        </div>
      </AdminShell>
    </AdminProtected>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
      />
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-sm font-semibold text-slate-600 ${className}`}>{children}</th>;
}

function Td({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`px-4 py-4 text-sm text-slate-500 ${className}`}>
      {children}
    </td>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}