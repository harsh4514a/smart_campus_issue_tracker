"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AdminProtected from "@/components/AdminProtected";
import { authFetch, loadAuth } from "@/lib/client-auth";
import AdminShell from "@/components/admin/AdminShell";
import { Pencil, Plus, Trash2, X } from "lucide-react";

type DepartmentType = "Academic" | "Service";
type Department = { _id: string; name: string; type: DepartmentType; createdAt?: string };
type IssueLite = {
  _id: string;
  status: "Pending" | "In Progress" | "Resolved" | "Rejected";
  department?: { _id?: string } | null;
  academicDepartment?: { _id?: string } | null;
  serviceDepartment?: { _id?: string } | null;
};

type StaffLite = {
  _id: string;
  department?: { _id?: string } | null;
  academicDepartment?: { _id?: string } | null;
  serviceDepartment?: { _id?: string } | null;
  managedDepartments?: Array<{ _id?: string }>;
};
const POLL_INTERVAL_MS = 10000;

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<DepartmentType>("Academic");
  const [activeFilter, setActiveFilter] = useState<DepartmentType | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingType, setEditingType] = useState<DepartmentType>("Academic");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeIssueByDept, setActiveIssueByDept] = useState<Record<string, number>>({});
  const [staffByDept, setStaffByDept] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<"name" | "created_desc" | "created_asc" | "type">("name");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const auth = useMemo(() => loadAuth(), []);
  const isSuperAdmin = auth?.user.adminRole === "super_admin";

  useEffect(() => {
    document.title = "Departments | CampusTracker Admin";
  }, []);

  const load = (silent = false) => {
    if (!auth) return;
    if (!silent) {
      setLoading(true);
    }

    Promise.all([
      authFetch("/api/admin/departments", { method: "GET" }, auth.token),
      authFetch("/api/admin/issues", { method: "GET" }, auth.token),
      authFetch("/api/admin/staff", { method: "GET" }, auth.token),
    ])
      .then(([departmentRes, issueRes, staffRes]) => {
        const departmentRows = departmentRes.departments || [];
        setDepartments(departmentRows);

        const issueRows = (issueRes.issues || []) as IssueLite[];
        const issueMap: Record<string, number> = {};
        issueRows.forEach((issue) => {
          if (issue.status === "Resolved" || issue.status === "Rejected") return;
          const departmentId =
            String(issue.serviceDepartment?._id || "") ||
            String(issue.academicDepartment?._id || "") ||
            String(issue.department?._id || "");
          if (!departmentId) return;
          issueMap[departmentId] = (issueMap[departmentId] || 0) + 1;
        });
        setActiveIssueByDept(issueMap);

        const staffRows = (staffRes.faculty || []) as StaffLite[];
        const staffMap: Record<string, number> = {};
        staffRows.forEach((staff) => {
          const ids = new Set<string>([
            String(staff.department?._id || ""),
            String(staff.academicDepartment?._id || ""),
            String(staff.serviceDepartment?._id || ""),
            ...(Array.isArray(staff.managedDepartments) ? staff.managedDepartments.map((dept) => String(dept?._id || "")) : []),
          ].filter(Boolean));
          ids.forEach((id) => {
            staffMap[id] = (staffMap[id] || 0) + 1;
          });
        });
        setStaffByDept(staffMap);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load departments"))
      .finally(() => {
        if (!silent) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auth) return;
    const intervalId = window.setInterval(() => {
      if (!saving && !deletingId && !editingId && !showCreateForm) {
        load(true);
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, saving, deletingId, editingId, showCreateForm]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    setError(null);
    try {
      await authFetch(
        "/api/admin/departments",
        { method: "POST", body: JSON.stringify({ name, type }) },
        auth.token
      );
      setName("");
      setType("Academic");
      setShowCreateForm(false);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create department";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const onStartEdit = (department: Department) => {
    setEditingId(department._id);
    setEditingName(department.name);
    setEditingType(department.type);
    setError(null);
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingType("Academic");
  };

  const onSaveEdit = async (departmentId: string) => {
    if (!auth) return;
    setSaving(true);
    setError(null);
    try {
      await authFetch(
        `/api/admin/departments/${departmentId}`,
        { method: "PATCH", body: JSON.stringify({ name: editingName, type: editingType }) },
        auth.token
      );
      onCancelEdit();
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update department";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (departmentId: string) => {
    if (!auth) return;

    const confirmed = window.confirm("Are you sure you want to delete this department?");
    if (!confirmed) return;

    setDeletingId(departmentId);
    setError(null);
    try {
      await authFetch(
        `/api/admin/departments/${departmentId}`,
        { method: "DELETE" },
        auth.token
      );
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete department";
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const rows = useMemo(() => {
    const typeOrder: Record<DepartmentType, number> = {
      Academic: 0,
      Service: 1,
    };

    const scoped = activeFilter
      ? departments.filter((department) => department.type === activeFilter)
      : departments;

    return scoped
      .slice()
      .sort((a, b) => {
        if (sortBy === "name") {
          const orderDiff = typeOrder[a.type] - typeOrder[b.type];
          if (orderDiff !== 0) return orderDiff;
          return a.name.localeCompare(b.name);
        }

        if (sortBy === "created_desc") {
          return (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0);
        }

        if (sortBy === "created_asc") {
          return (new Date(a.createdAt || 0).getTime() || 0) - (new Date(b.createdAt || 0).getTime() || 0);
        }

        return a.type.localeCompare(b.type);
      });
  }, [departments, activeFilter, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, sortBy]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / pageSize)), [rows.length, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  const academicCount = useMemo(() => departments.filter((department) => department.type === "Academic").length, [departments]);
  const serviceCount = useMemo(() => departments.filter((department) => department.type === "Service").length, [departments]);

  return (
    <AdminProtected allowedAdminRoles={["super_admin"]}>
      <AdminShell
        title="Departments"
        subtitle="Manage campus departments"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveFilter((prev) => (prev === "Academic" ? null : "Academic"))}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  activeFilter === "Academic"
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Academic ({academicCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter((prev) => (prev === "Service" ? null : "Service"))}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  activeFilter === "Service"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Service ({serviceCount})
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as "name" | "created_desc" | "created_asc" | "type")}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
              >
                <option value="name">Sort: Name</option>
                <option value="created_desc">Sort: Newest Created</option>
                <option value="created_asc">Sort: Oldest Created</option>
                <option value="type">Sort: Type</option>
              </select>
              {(activeFilter !== null || sortBy !== "name") && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter(null);
                    setSortBy("name");
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset
                </button>
              )}
            </div>
            {isSuperAdmin ? (
              <button
                type="button"
                onClick={() => setShowCreateForm((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
              >
                <Plus className="h-4 w-4" />
                Add Department
              </button>
            ) : (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                Dept admin: read-only view
              </span>
            )}
          </div>

          {showCreateForm && isSuperAdmin && (
            <form className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-3xl" onSubmit={onSubmit}>
              <input
                className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                placeholder="Department name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <select
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                value={type}
                onChange={(e) => setType(e.target.value as DepartmentType)}
                required
              >
                <option value="Academic">Academic</option>
                <option value="Service">Service</option>
              </select>
              <div className="flex gap-2 sm:justify-end">
              <button
                type="submit"
                className="h-10 rounded-lg bg-teal-600 text-white px-4 text-sm font-semibold hover:bg-teal-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setShowCreateForm(false);
                  setName("");
                  setType("Academic");
                }}
              >
                Cancel
              </button>
              </div>
            </form>
          )}

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {activeFilter ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
                Filters applied: {activeFilter}
              </span>
            ) : (
              <span className="text-slate-500">No filters applied</span>
            )}
          </div>

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
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Active Issues</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Staff</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Created</th>
                    {isSuperAdmin ? (
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((department) => {
                    const isEditing = editingId === department._id;
                    return (
                      <tr key={department._id} className="cursor-pointer border-b border-slate-200 transition hover:bg-gray-50 last:border-b-0">
                        <td className="px-4 py-4 text-sm font-semibold text-slate-800 align-top">
                          {isEditing ? (
                            <input
                              className="h-9 w-full max-w-xs rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                            />
                          ) : (
                            department.name
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 align-top">
                          {isEditing ? (
                            <select
                              className="h-9 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                              value={editingType}
                              onChange={(e) => setEditingType(e.target.value as DepartmentType)}
                            >
                              <option value="Academic">Academic</option>
                              <option value="Service">Service</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                department.type === "Academic"
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {department.type}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 align-top">
                          {(activeIssueByDept[department._id] || 0) > 0 ? (
                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              {activeIssueByDept[department._id] || 0}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 align-top">
                          {(staffByDept[department._id] || 0) > 0 ? (
                            <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                              {staffByDept[department._id] || 0}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500 align-top">
                          {formatDate(department.createdAt)}
                        </td>
                        {isSuperAdmin ? (
                          <td className="px-4 py-4 align-top">
                            <div className="flex items-center justify-end gap-3">
                              <a
                                href={`/admin/issues?department=${encodeURIComponent(department.name)}`}
                                className="inline-flex h-8 items-center rounded-md border border-sky-200 px-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                              >
                                View Issues
                              </a>
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-teal-600 hover:bg-teal-50"
                                    onClick={() => onSaveEdit(department._id)}
                                    disabled={saving || !editingName.trim()}
                                    title="Save"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                                    onClick={onCancelEdit}
                                    title="Cancel"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                                    onClick={() => onStartEdit(department)}
                                    title="Edit"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"
                                    onClick={() => onDelete(department._id)}
                                    disabled={deletingId === department._id}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
                {rows.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-10 text-center text-sm text-slate-500">
                        No data available
                      </td>
                    </tr>
                  </tbody>
                ) : null}
              </table>
            </div>
          )}

          {!loading && (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing {rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                -{Math.min(currentPage * pageSize, rows.length)} of {rows.length} filtered departments ({departments.length} total)
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

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}