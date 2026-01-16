"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Protected from "@/components/Protected";
import { authFetch, loadAuth } from "@/lib/client-auth";

type Issue = {
  _id: string;
  title: string;
  category: string;
  status: string;
  location: string;
  createdAt: string;
};

export default function StudentIssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth) return;
    authFetch("/api/issues/mine", { method: "GET" }, auth.token)
      .then((data) => setIssues(data.issues || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load issues"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Protected allowedRoles={["student"]}>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">My Issues</h1>
          <Link href="/student/report" className="rounded bg-blue-600 text-white px-4 py-2">Report Issue</Link>
        </div>
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Title</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th>Location</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {issues.map((issue) => (
                  <tr key={issue._id} className="hover:bg-gray-50">
                    <Td>{issue.title}</Td>
                    <Td>{issue.category}</Td>
                    <Td><StatusBadge status={issue.status} /></Td>
                    <Td>{issue.location}</Td>
                    <Td>{new Date(issue.createdAt).toLocaleString()}</Td>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 text-sm text-gray-700">{children}</td>;
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "Resolved" ? "bg-green-100 text-green-700" : status === "In Progress" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-700";
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{status}</span>;
}