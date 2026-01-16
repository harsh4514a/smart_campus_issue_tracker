"use client";

import { useEffect, useState } from "react";
import Protected from "@/components/Protected";
import { authFetch, loadAuth } from "@/lib/client-auth";
import Link from "next/link";

type Issue = { _id: string; status: string };

export default function StaffDashboard() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth) return;
    authFetch("/api/issues/department", { method: "GET" }, auth.token)
      .then((data) => setIssues(data.issues || []))
      .catch((err) => setError(err.message || "Failed to load issues"))
      .finally(() => setLoading(false));
  }, []);

  const total = issues.length;
  const pending = issues.filter((i) => i.status === "Pending").length;
  const inProgress = issues.filter((i) => i.status === "In Progress").length;
  const resolved = issues.filter((i) => i.status === "Resolved").length;

  return (
    <Protected allowedRoles={["staff"]}>
      <div className="min-h-screen bg-gray-50 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Staff Dashboard</h1>
          <Link href="/staff/issues" className="rounded bg-blue-600 text-white px-4 py-2">View Issues</Link>
        </div>

        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Stat label="Total" value={total} />
            <Stat label="Pending" value={pending} />
            <Stat label="In Progress" value={inProgress} />
            <Stat label="Resolved" value={resolved} />
          </div>
        )}
      </div>
    </Protected>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-white shadow p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}