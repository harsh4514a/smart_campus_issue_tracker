"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AdminProtected from "@/components/AdminProtected";
import { authFetch, loadAuth } from "@/lib/client-auth";
import AdminShell from "@/components/admin/AdminShell";
import { Pencil, Plus, Trash2, X } from "lucide-react";

type DepartmentType = "Academic" | "Service";
type Department = { _id: string; name: string; type: DepartmentType; createdAt?: string };
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

  const auth = loadAuth();

  const load = (silent = false) => {
    if (!auth) return;
    if (!silent) {
      setLoading(true);
    }

    authFetch("/api/admin/departments", { method: "GET" }, auth.token)
      .then((data) => setDepartments(data.departments || []))
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
    if (!activeFilter) return departments;
    return departments.filter((department) => department.type === activeFilter);
  }, [departments, activeFilter]);

  return (
    <AdminProtected>
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
                Academic
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
                Service
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              Add Department
            </button>
          </div>

          {showCreateForm && (
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

          {loading ? (
            <div className="text-sm text-slate-600">Loading...</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Created</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((department) => {
                    const isEditing = editingId === department._id;
                    return (
                      <tr key={department._id} className="border-b border-slate-200 last:border-b-0">
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
                        <td className="px-4 py-4 text-sm text-slate-500 align-top">
                          {formatDate(department.createdAt)}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center justify-end gap-3">
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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