"use client";

import { FormEvent, useEffect, useState } from "react";
import Protected from "@/components/Protected";
import { authFetch, loadAuth } from "@/lib/client-auth";

type Department = { _id: string; name: string };

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const auth = loadAuth();

  const load = () => {
    if (!auth) return;
    authFetch("/api/admin/departments", { method: "GET" }, auth.token)
      .then((data) => setDepartments(data.departments || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load departments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    setError(null);
    try {
      await authFetch(
        "/api/admin/departments",
        { method: "POST", body: JSON.stringify({ name }) },
        auth.token
      );
      setName("");
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create department";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Protected allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-50 p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Departments</h1>
        <form className="flex flex-col sm:flex-row gap-2 max-w-xl" onSubmit={onSubmit}>
          <input
            className="flex-1 rounded border px-3 py-2"
            placeholder="New department name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving..." : "Add"}
          </button>
        </form>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {loading ? (
          <div>Loading...</div>
        ) : (
          <ul className="bg-white shadow rounded divide-y">
            {departments.map((d) => (
              <li key={d._id} className="px-4 py-3 text-sm text-gray-700">{d.name}</li>
            ))}
          </ul>
        )}
      </div>
    </Protected>
  );
}