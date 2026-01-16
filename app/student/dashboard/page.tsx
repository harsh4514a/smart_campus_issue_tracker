"use client";

import { useEffect, useState } from "react";
import Protected from "@/components/Protected";
import { authFetch, loadAuth } from "@/lib/client-auth";
import Link from "next/link";

type Issue = { _id: string; status: string };

export default function StudentDashboard() {
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth) return;
    authFetch("/api/issues/mine", { method: "GET" }, auth.token)
      .then((data) => setIssues(data.issues || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load issues"))
      .finally(() => setLoading(false));
  }, []);

  const total = issues.length;
  const pending = issues.filter((i) => i.status === "Pending").length;
  const resolved = issues.filter((i) => i.status === "Resolved").length;

  return (
    <Protected allowedRoles={["student"]}>
      <div className="min-h-screen bg-gray-50 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Student Dashboard</h1>
          <div className="space-x-2 text-sm text-gray-600">
            <Link href="/student/report" className="rounded bg-blue-600 text-white px-4 py-2">Report Issue</Link>
            <Link href="/student/issues" className="rounded bg-gray-200 px-4 py-2">My Issues</Link>
          </div>
        </div>

        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total Issues" value={total} />
            <StatCard label="Pending" value={pending} />
            <StatCard label="Resolved" value={resolved} />
          </div>
        )}
      </div>
    </Protected>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white shadow p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}