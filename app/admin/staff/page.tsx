"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AdminProtected from "@/components/AdminProtected";
import { authFetch, loadAuth } from "@/lib/client-auth";
import AdminShell from "@/components/admin/AdminShell";
import { useToast } from "@/components/ToastProvider";
import { Pencil, Search, Trash2, UserPlus, X } from "lucide-react";

type Department = { _id: string; name: string; type?: "Academic" | "Service" };
type Faculty = {
  _id: string;
  name: string;
  email: string;
  department?: Department;
  academicDepartment?: Department;
  serviceDepartment?: Department;
  createdAt?: string;
};

const POLL_INTERVAL_MS = 10000;

export default function AdminStaffPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    academicDepartmentId: "",
    serviceDepartmentId: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [academicFilter, setAcademicFilter] = useState("All");
  const [serviceFilter, setServiceFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const auth = loadAuth();

  const loadData = (silent = false) => {
    if (!auth) return;
    if (!silent) {
      setLoading(true);
    }

    Promise.all([
      authFetch("/api/admin/departments", { method: "GET" }, auth.token),
      authFetch("/api/admin/staff", { method: "GET" }, auth.token),
    ])
      .then(([deptRes, staffRes]) => {
        setDepartments(deptRes.departments || []);
        setFaculty(staffRes.faculty || []);
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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    try {
      if (editingId) {
        if (!form.academicDepartmentId && !form.serviceDepartmentId) {
          showToast({
            title: "Validation Error",
            message: "Please select at least one department",
            variant: "error",
          });
          setSaving(false);
          return;
        }

        await authFetch(
          `/api/admin/staff/${editingId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name: form.name,
              email: form.email,
              academicDepartmentId: form.academicDepartmentId,
              serviceDepartmentId: form.serviceDepartmentId,
            }),
          },
          auth.token
        );
      } else {
        if (!form.academicDepartmentId && !form.serviceDepartmentId) {
          showToast({
            title: "Validation Error",
            message: "Please select at least one department",
            variant: "error",
          });
          setSaving(false);
          return;
        }

        await authFetch(
          "/api/admin/staff",
          {
            method: "POST",
            body: JSON.stringify({
              name: form.name,
              email: form.email,
              password: form.password,
              academicDepartmentId: form.academicDepartmentId,
              serviceDepartmentId: form.serviceDepartmentId,
            }),
          },
          auth.token
        );
      }

      setForm({ name: "", email: "", password: "", academicDepartmentId: "", serviceDepartmentId: "" });
      setShowForm(false);
      setEditingId(null);
      showToast({
        title: "Success",
        message: editingId ? "Staff member updated successfully" : "Staff member created successfully",
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
    return faculty.filter((staff) => {
      const staffAcademicDepartmentId =
        staff.academicDepartment?._id || (staff.department?.type === "Academic" ? staff.department._id : "");
      const staffServiceDepartmentId =
        staff.serviceDepartment?._id || (staff.department?.type === "Service" ? staff.department._id : "");

      const academicMatch = academicFilter === "All" || staffAcademicDepartmentId === academicFilter;
      const serviceMatch = serviceFilter === "All" || staffServiceDepartmentId === serviceFilter;

      if (!academicMatch || !serviceMatch) return false;

      if (!normalized) return true;

      const haystack = `${staff.name} ${staff.email}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [faculty, query, academicFilter, serviceFilter]);

  const academicDepartments = useMemo(
    () => departments.filter((department) => department.type === "Academic"),
    [departments]
  );

  const serviceDepartments = useMemo(
    () => departments.filter((department) => department.type === "Service"),
    [departments]
  );

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
      password: "",
      academicDepartmentId: staff.academicDepartment?._id || fallbackAcademicDepartmentId,
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
    setForm({ name: "", email: "", password: "", academicDepartmentId: "", serviceDepartmentId: "" });
  };

  return (
    <AdminProtected>
      <AdminShell
        title="Staff Management"
        subtitle="Manage staff accounts and department assignments"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                if (showForm && !editingId) {
                  closeFormModal();
                  return;
                }
                setEditingId(null);
                setForm({ name: "", email: "", password: "", academicDepartmentId: "", serviceDepartmentId: "" });
                setShowForm(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <UserPlus className="h-4 w-4" />
              Add Staff
            </button>
          </div>

          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
              <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between px-5 pt-5">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">
                      {editingId ? "Edit Staff Member" : "Add New Staff Member"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Enter the details for the new staff member. They will be able to log in with the credentials you provide.
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

                  {!editingId && (
                    <Input
                      label="Password *"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={form.password}
                      onChange={(v) => setForm({ ...form, password: v })}
                      autoComplete="new-password"
                      required
                    />
                  )}

                  <Input
                    label="Full Name *"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    autoComplete="off"
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Academic Department</label>
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      value={form.academicDepartmentId}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          academicDepartmentId: e.target.value,
                        })
                      }
                    >
                      <option value="">Select academic department</option>
                      {academicDepartments.map((department) => (
                        <option key={department._id} value={department._id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
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

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="relative md:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                  placeholder="Search staff by name or email..."
                />
              </div>

              <select
                value={academicFilter}
                onChange={(e) => setAcademicFilter(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
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
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
              >
                <option value="All">All Service Departments</option>
                {serviceDepartments.map((department) => (
                  <option key={department._id} value={department._id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {loading ? (
            <div className="text-sm text-slate-600">Loading...</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Academic Department</Th>
                    <Th>Service Department</Th>
                    <Th>Status</Th>
                    <Th>Joined</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((staff) => (
                    <tr key={staff._id} className="border-b border-slate-200 last:border-b-0">
                      <Td className="font-semibold text-slate-800">{staff.name}</Td>
                      <Td>{staff.email}</Td>
                      <Td>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {staff.academicDepartment?.name || (staff.department?.type === "Academic" ? staff.department.name : "—")}
                        </span>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {staff.serviceDepartment?.name || (staff.department?.type === "Service" ? staff.department.name : "—")}
                        </span>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
                          Active
                        </span>
                      </Td>
                      <Td>{formatDate(staff.createdAt)}</Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-2">
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
                </tbody>
              </table>
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

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-4 text-sm text-slate-500 ${className}`}>{children}</td>;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}