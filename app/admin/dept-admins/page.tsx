"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronsUpDown,
  CircleX,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import AdminProtected from "@/components/AdminProtected";
import AdminShell from "@/components/admin/AdminShell";
import { authFetch, loadAuth } from "@/lib/client-auth";
import { useToast } from "@/components/ToastProvider";

type Department = {
  _id: string;
  name: string;
  type?: "Academic" | "Service";
};

type DeptAdminRow = {
  _id: string;
  name: string;
  email: string;
  designation?: string;
  isActive: boolean;
  createdAt?: string | null;
  departments: Department[];
};

type SortField = "name" | "email" | "designation" | "status" | "createdAt";
type SortOrder = "asc" | "desc";

const PAGE_SIZE = 10;

export default function DepartmentAdminsPage() {
  const auth = useMemo(() => loadAuth(), []);
  const { showToast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [admins, setAdmins] = useState<DeptAdminRow[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<DeptAdminRow | null>(null);
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    departments: "",
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    departmentIds: [] as string[],
    designation: "",
    isActive: true,
  });

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const debouncedSearch = useDebouncedValue(search, 350);

  const loadDepartments = async () => {
    if (!auth) return;
    try {
      const res = await authFetch("/api/admin/departments", { method: "GET" }, auth.token);
      setDepartments(Array.isArray(res?.departments) ? res.departments : []);
    } catch {
      // Keep department list empty if loading fails; main fetch state handles primary error surface.
    }
  };

  const loadAdmins = async (silent = false) => {
    if (!auth) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        department: departmentFilter === "all" ? "" : departmentFilter,
        status: statusFilter,
        page: String(page),
        limit: String(PAGE_SIZE),
        sortBy: sortField,
        sortOrder,
      });

      const res = await authFetch(`/api/dept-admins?${params.toString()}`, { method: "GET" }, auth.token);
      setAdmins(Array.isArray(res?.admins) ? res.admins : []);

      setStats({
        total: Number(res?.stats?.total || 0),
        active: Number(res?.stats?.active || 0),
        inactive: Number(res?.stats?.inactive || 0),
      });

      const apiPage = Number(res?.pagination?.page || 1);
      const apiTotalPages = Number(res?.pagination?.totalPages || 1);
      const apiTotal = Number(res?.pagination?.total || 0);

      setPage(apiPage);
      setTotalPages(Math.max(1, apiTotalPages));
      setTotalRecords(apiTotal);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load department admins";
      setError(message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, departmentFilter, statusFilter, sortField, sortOrder, page]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setShowDeptDropdown(false);
      }
    };

    if (showDeptDropdown) {
      document.addEventListener("mousedown", onClickOutside);
    }

    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showDeptDropdown]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, departmentFilter, statusFilter]);

  const academicDepartments = useMemo(
    () => departments.filter((department) => department.type === "Academic"),
    [departments]
  );

  const sortedAcademicDepartmentNames = useMemo(
    () => academicDepartments.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [academicDepartments]
  );

  const openCreateModal = () => {
    setEditingAdmin(null);
    setForm({
      name: "",
      email: "",
      departmentIds: [],
      designation: "",
      isActive: true,
    });
    setDepartmentSearch("");
    setErrors({ name: "", email: "", departments: "" });
    setEmailTaken(false);
    setShowDeptDropdown(false);
    setShowModal(true);
  };

  const openEditModal = (admin: DeptAdminRow) => {
    setEditingAdmin(admin);
    setForm({
      name: admin.name,
      email: admin.email,
      departmentIds: admin.departments.map((department) => department._id),
      designation: admin.designation || "",
      isActive: admin.isActive,
    });
    setDepartmentSearch("");
    setErrors({ name: "", email: "", departments: "" });
    setEmailTaken(false);
    setShowDeptDropdown(false);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditingAdmin(null);
    setDepartmentSearch("");
    setErrors({ name: "", email: "", departments: "" });
    setEmailTaken(false);
    setShowDeptDropdown(false);
  };

  const toggleDepartment = (departmentId: string) => {
    setForm((prev) => {
      if (prev.departmentIds.includes(departmentId)) {
        return { ...prev, departmentIds: prev.departmentIds.filter((id) => id !== departmentId) };
      }
      return { ...prev, departmentIds: [...prev.departmentIds, departmentId] };
    });

    setErrors((prev) => ({ ...prev, departments: "" }));
  };

  const validateForm = () => {
    const nextErrors = {
      name: form.name.trim() ? "" : "Name is required",
      email: "",
      departments: form.departmentIds.length > 0 ? "" : "Please select at least one department",
    };

    if (!form.email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim().toLowerCase())) {
      nextErrors.email = "Please enter a valid email address";
    } else if (emailTaken) {
      nextErrors.email = "Email is already registered";
    }

    setErrors(nextErrors);
    return !nextErrors.name && !nextErrors.email && !nextErrors.departments;
  };

  const checkEmailUniqueness = async (email: string) => {
    if (!auth) return;
    const normalized = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setEmailTaken(false);
      return false;
    }

    setCheckingEmail(true);
    try {
      const params = new URLSearchParams({ email: normalized });
      if (editingAdmin?._id) {
        params.set("excludeId", editingAdmin._id);
      }

      const res = await authFetch(`/api/dept-admins/check-email?${params.toString()}`, { method: "GET" }, auth.token);
      const taken = Boolean(res?.exists);
      setEmailTaken(taken);
      if (taken) {
        setErrors((prev) => ({ ...prev, email: "Email is already registered" }));
      } else {
        setErrors((prev) => ({ ...prev, email: "" }));
      }
      return taken;
    } catch {
      setEmailTaken(false);
      return false;
    } finally {
      setCheckingEmail(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth) return;

    const isTaken = await checkEmailUniqueness(form.email);
    if (isTaken) {
      showToast({ title: "Validation Error", message: "Email is already registered.", variant: "error" });
      return;
    }

    const isValid = validateForm();
    if (!isValid) {
      showToast({ title: "Validation Error", message: "Please fix highlighted fields.", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        departmentIds: form.departmentIds,
        designation: form.designation.trim(),
        isActive: form.isActive,
      };

      if (editingAdmin) {
        const response = await authFetch(
          `/api/dept-admins/${editingAdmin._id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
          auth.token
        );
        showToast({
          title: "Success",
          message: response?.message || "Department admin updated.",
          variant: "success",
        });
      } else {
        await authFetch(
          "/api/dept-admins",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          auth.token
        );
        showToast({
          title: "Success",
          message: "Department Admin created successfully. Email sent for password setup.",
          variant: "success",
        });
      }

      closeModal();
      await loadAdmins();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save department admin";
      showToast({ title: "Save Failed", message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const onToggleStatus = async (admin: DeptAdminRow) => {
    if (!auth) return;
    setTogglingId(admin._id);

    try {
      await authFetch(
        `/api/dept-admins/${admin._id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: admin.name,
            email: admin.email,
            designation: admin.designation || "",
            departmentIds: admin.departments.map((department) => department._id),
            isActive: !admin.isActive,
          }),
        },
        auth.token
      );

      showToast({
        title: "Success",
        message: !admin.isActive ? "Admin activated." : "Admin deactivated.",
        variant: "success",
      });
      await loadAdmins(true);
      await loadAdmins();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      showToast({ title: "Update Failed", message, variant: "error" });
    } finally {
      setTogglingId(null);
    }
  };

  const onDelete = async (admin: DeptAdminRow) => {
    if (!auth) return;
    const confirmed = window.confirm(`Delete ${admin.name}? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(admin._id);
    try {
      await authFetch(`/api/dept-admins/${admin._id}`, { method: "DELETE" }, auth.token);
      showToast({ title: "Success", message: "Department admin deleted.", variant: "success" });
      if (admins.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        await loadAdmins();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete department admin";
      showToast({ title: "Delete Failed", message, variant: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const onSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortOrder("asc");
  };

  const selectedDepartmentObjects = form.departmentIds
    .map((id) => academicDepartments.find((department) => department._id === id))
    .filter(Boolean) as Department[];

  const filteredAcademicDepartments = useMemo(() => {
    const normalized = departmentSearch.trim().toLowerCase();
    if (!normalized) return sortedAcademicDepartmentNames;
    return sortedAcademicDepartmentNames.filter((department) =>
      department.name.toLowerCase().includes(normalized)
    );
  }, [departmentSearch, sortedAcademicDepartmentNames]);

  const isFormValid =
    form.name.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim().toLowerCase()) &&
    form.departmentIds.length > 0 &&
    !emailTaken;

  const from = totalRecords === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(totalRecords, page * PAGE_SIZE);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: "search" | "department" | "status"; label: string }> = [];
    if (search.trim()) chips.push({ key: "search", label: `Search: ${search.trim()}` });
    if (departmentFilter !== "all") {
      const departmentName = sortedAcademicDepartmentNames.find((department) => department._id === departmentFilter)?.name || "Department";
      chips.push({ key: "department", label: `Department: ${departmentName}` });
    }
    if (statusFilter !== "all") {
      chips.push({ key: "status", label: `Status: ${statusFilter}` });
    }
    return chips;
  }, [search, departmentFilter, sortedAcademicDepartmentNames, statusFilter]);

  const clearFilterChip = (key: "search" | "department" | "status") => {
    if (key === "search") setSearch("");
    if (key === "department") setDepartmentFilter("all");
    if (key === "status") setStatusFilter("all");
    setPage(1);
  };

  const clearAllFilters = () => {
    setSearch("");
    setDepartmentFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  return (
    <AdminProtected allowedAdminRoles={["super_admin"]}>
      <AdminShell
        title="Department Admin Management"
        subtitle="Manage department-level administrators"
        headerActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              Create Dept Admin
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <p className="text-sm text-slate-500">Create, update, and control department admin access.</p>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard title="Total Dept Admins" value={stats.total} icon={<Users className="h-5 w-5" />} accent="slate" />
            <StatCard title="Active Admins" value={stats.active} icon={<UserCheck className="h-5 w-5" />} accent="green" />
            <StatCard title="Inactive Admins" value={stats.inactive} icon={<UserX className="h-5 w-5" />} accent="red" />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                  placeholder="Search by name or email"
                />
              </div>

              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
              >
                <option value="all">All Departments</option>
                {sortedAcademicDepartmentNames.map((department) => (
                  <option key={department._id} value={department._id}>
                    {department.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
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
                onClick={clearAllFilters}
                className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset All
              </button>
            </div>
          </section>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
              <p className="font-semibold">Failed to load department admins</p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={() => loadAdmins()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 font-semibold text-rose-700 hover:bg-rose-100"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : loading ? (
            <LoadingState />
          ) : admins.length === 0 ? (
            <EmptyState onCreate={openCreateModal} />
          ) : (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="max-h-[60vh] overflow-auto">
                <table className="min-w-full text-left">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
                    <tr>
                      <SortableTh field="name" currentField={sortField} currentOrder={sortOrder} onSort={onSort}>Name</SortableTh>
                      <SortableTh field="email" currentField={sortField} currentOrder={sortOrder} onSort={onSort}>Email</SortableTh>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-600">Departments</th>
                      <SortableTh field="designation" currentField={sortField} currentOrder={sortOrder} onSort={onSort}>
                        Designation
                      </SortableTh>
                      <SortableTh field="status" currentField={sortField} currentOrder={sortOrder} onSort={onSort}>Status</SortableTh>
                      <SortableTh field="createdAt" currentField={sortField} currentOrder={sortOrder} onSort={onSort}>
                        Created Date
                      </SortableTh>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => (
                      <tr key={admin._id} className="border-b border-slate-200 transition hover:bg-slate-50/70 last:border-b-0">
                        <Td className="font-semibold text-slate-800">{admin.name}</Td>
                        <Td>{admin.email}</Td>
                        <Td>
                          <div className="flex flex-wrap gap-1.5">
                            {admin.departments.map((department) => (
                              <span
                                key={department._id}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                              >
                                {department.name}
                              </span>
                            ))}
                          </div>
                        </Td>
                        <Td>{admin.designation || "—"}</Td>
                        <Td>
                          <StatusBadge active={admin.isActive} />
                        </Td>
                        <Td>{formatDate(admin.createdAt)}</Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(admin)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleStatus(admin)}
                              disabled={togglingId === admin._id}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${
                                admin.isActive
                                  ? "text-amber-600 hover:bg-amber-50"
                                  : "text-emerald-600 hover:bg-emerald-50"
                              } disabled:opacity-60`}
                              title={admin.isActive ? "Deactivate" : "Activate"}
                            >
                              {admin.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(admin)}
                              disabled={deletingId === admin._id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50 disabled:opacity-60"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
                <div>
                  Showing {from} to {to} of {totalRecords}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        {showModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
            <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between px-5 pt-5">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {editingAdmin ? "Edit Dept Admin" : "Create Dept Admin"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {editingAdmin
                      ? "Update department admin profile, scope, and status."
                      : "Create a new department admin and assign one or more departments."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form className="space-y-4 px-5 pb-5 pt-3" onSubmit={onSubmit} autoComplete="off">
                <LabeledInput
                  label="Name *"
                  placeholder="Jane Doe"
                  value={form.name}
                  onChange={(value) => {
                    setForm((prev) => ({ ...prev, name: value }));
                    setErrors((prev) => ({ ...prev, name: value.trim() ? "" : prev.name }));
                  }}
                  icon={<User className="h-4 w-4" />}
                  required
                  error={errors.name}
                />

                <LabeledInput
                  label="Email *"
                  placeholder="jane.deptadmin@example.com"
                  value={form.email}
                  onChange={(value) => {
                    setForm((prev) => ({ ...prev, email: value }));
                    setEmailTaken(false);
                    setErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  onBlur={(value) => {
                    void checkEmailUniqueness(value);
                  }}
                  icon={<Mail className="h-4 w-4" />}
                  required
                  error={errors.email || (checkingEmail ? "Checking email..." : "")}
                  helperText="This admin will receive an email to set their password securely"
                />

                <div>
                  <label className="block text-sm font-medium text-slate-700">Academic Departments *</label>
                  <div className="relative mt-1" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowDeptDropdown((prev) => !prev)}
                      className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none hover:bg-slate-50 focus:border-teal-500"
                    >
                      <span className="truncate text-left inline-flex items-center gap-2">
                        <Search className="h-4 w-4 text-slate-400" />
                        {form.departmentIds.length > 0
                          ? `${form.departmentIds.length} department${form.departmentIds.length > 1 ? "s" : ""} selected`
                            : "Select academic departments"}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </button>

                    {showDeptDropdown ? (
                      <div className="absolute left-0 right-0 z-20 mt-2 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                        <div className="px-2 pb-2">
                          <input
                            type="text"
                            value={departmentSearch}
                            onChange={(event) => setDepartmentSearch(event.target.value)}
                            placeholder="Search department"
                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                          />
                        </div>
                        {filteredAcademicDepartments.length === 0 ? (
                          <div className="px-2 py-2 text-sm text-slate-500">No departments available.</div>
                        ) : (
                          filteredAcademicDepartments.map((department) => {
                            const selected = form.departmentIds.includes(department._id);
                            return (
                              <label
                                key={department._id}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                  checked={selected}
                                  onChange={() => toggleDepartment(department._id)}
                                />
                                <span className="flex-1">{department.name}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                  Academic
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedDepartmentObjects.map((department) => (
                      <span
                        key={department._id}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                      >
                        {department.name}
                        <button
                          type="button"
                          onClick={() => toggleDepartment(department._id)}
                          className="rounded-full text-slate-500 hover:text-slate-700"
                          aria-label={`Remove ${department.name}`}
                        >
                          <CircleX className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  {errors.departments ? <p className="mt-1 text-xs text-rose-600">{errors.departments}</p> : null}
                </div>

                <LabeledInput
                  label="Designation"
                  placeholder="Assistant Registrar"
                  value={form.designation}
                  onChange={(value) => setForm((prev) => ({ ...prev, designation: value }))}
                />

                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Status</p>
                    <p className="text-xs text-slate-500">Inactive admins cannot log in</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                    className="inline-flex items-center gap-2"
                    aria-label="Toggle status"
                  >
                    <span
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        form.isActive ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                          form.isActive ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </span>
                    <span className={`text-sm font-semibold ${form.isActive ? "text-emerald-700" : "text-slate-600"}`}>
                      {form.isActive ? "Active" : "Inactive"}
                    </span>
                  </button>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                    disabled={saving || !isFormValid || checkingEmail}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </AdminShell>
    </AdminProtected>
  );
}

function StatCard({
  title,
  value,
  icon,
  accent,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  accent: "slate" | "green" | "red";
}) {
  const tone =
    accent === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : accent === "red"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${tone}`}>{icon}</span>
      </div>
    </div>
  );
}

function SortableTh({
  children,
  field,
  currentField,
  currentOrder,
  onSort,
}: {
  children: ReactNode;
  field: SortField;
  currentField: SortField;
  currentOrder: SortOrder;
  onSort: (field: SortField) => void;
}) {
  const active = currentField === field;

  return (
    <th className="px-4 py-3 text-sm font-semibold text-slate-600">
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1.5 hover:text-slate-800"
      >
        {children}
        <ChevronsUpDown
          className={`h-3.5 w-3.5 ${active ? "text-slate-800" : "text-slate-400"}`}
          aria-hidden="true"
        />
        {active ? <span className="text-xs uppercase text-slate-500">{currentOrder}</span> : null}
      </button>
    </th>
  );
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-4 text-sm text-slate-600 ${className}`}>{children}</td>;
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
      Inactive
    </span>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  onBlur,
  required,
  type = "text",
  placeholder,
  icon,
  helperText,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  icon?: ReactNode;
  helperText?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative mt-1">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        ) : null}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onBlur?.(event.target.value)}
          className={`h-10 w-full rounded-lg border bg-white text-sm outline-none focus:border-teal-500 ${
            icon ? "pl-10 pr-3" : "px-3"
          } ${error ? "border-rose-300" : "border-slate-200"}`}
          placeholder={placeholder}
          required={required}
        />
      </div>
      {helperText ? <p className="mt-1 text-xs text-slate-500">{helperText}</p> : null}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-800">No Department Admins found</h3>
      <p className="mt-2 text-sm text-slate-500">Create the first department admin to get started.</p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
      >
        <Plus className="h-4 w-4" />
        Create Dept Admin
      </button>
    </section>
  );
}

function LoadingState() {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="h-10 rounded-lg bg-slate-100" />
          <div className="h-10 rounded-lg bg-slate-100" />
          <div className="h-10 rounded-lg bg-slate-100" />
        </div>

        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-12 rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </section>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debounced;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
