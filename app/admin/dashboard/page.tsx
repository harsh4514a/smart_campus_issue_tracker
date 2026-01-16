"use client";

import { useEffect, useState } from "react";
import Protected from "@/components/Protected";
import { authFetch, loadAuth } from "@/lib/client-auth";
import Link from "next/link";

type Stats = { students: number; staff: number; issues: number; pending: number };

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth) return;
    authFetch("/api/admin/stats", { method: "GET" }, auth.token)
      .then((data) => setStats(data))
      .catch((err) => setError(err.message || "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Protected allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-50 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <div className="space-x-2 text-sm text-gray-600">
            <Link className="px-3 py-2 rounded bg-blue-600 text-white" href="/admin/departments">Departments</Link>
            <Link className="px-3 py-2 rounded bg-blue-600 text-white" href="/admin/staff">Staff</Link>
            <Link className="px-3 py-2 rounded bg-blue-600 text-white" href="/admin/issues">Issues</Link>
          </div>
        </div>
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card label="Students" value={stats.students} />
            <Card label="Staff" value={stats.staff} />
            <Card label="Issues" value={stats.issues} />
            <Card label="Pending" value={stats.pending} />
          </div>
        )}
      </div>
    </Protected>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white shadow rounded p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}