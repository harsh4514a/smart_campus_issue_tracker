"use client";

import { FormEvent, useEffect, useState } from "react";
import Protected from "@/components/Protected";
import { authFetch, loadAuth } from "@/lib/client-auth";

type Department = { _id: string; name: string };
type Faculty = { _id: string; name: string; email: string; department?: Department };

export default function AdminStaffPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", departmentId: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const auth = loadAuth();

  const loadData = () => {
    if (!auth) return;
    Promise.all([
      authFetch("/api/admin/departments", { method: "GET" }, auth.token),
      authFetch("/api/admin/staff", { method: "GET" }, auth.token),
    ])
      .then(([deptRes, staffRes]) => {
        setDepartments(deptRes.departments || []);
        setFaculty(staffRes.faculty || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    setError(null);
    try {
      await authFetch(
        "/api/admin/staff",
        { method: "POST", body: JSON.stringify(form) },
        auth.token
      );
      setForm({ name: "", email: "", password: "", departmentId: "" });
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create faculty";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Protected allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-50 p-6 space-y-4">
  <h1 className="text-2xl font-semibold">Faculty</h1>
        <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl bg-white shadow rounded p-4" onSubmit={onSubmit}>
          <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Input label="College Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
          <Input label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
          <div>
            <label className="block text-sm font-medium text-gray-700">Department</label>
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              required
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Saving..." : "Add Faculty"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        </form>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Name</Th><Th>Email</Th><Th>Department</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {faculty.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    <Td>{s.name}</Td>
                    <Td>{s.email}</Td>
                    <Td>{s.department?.name || "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Protected>
  );
}

function Input({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        className="mt-1 w-full rounded border px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 text-sm text-gray-700">{children}</td>;
}