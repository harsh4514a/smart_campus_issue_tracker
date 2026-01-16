"use client";

import { useEffect, useState } from "react";
import Protected from "@/components/Protected";
import { authFetch, loadAuth } from "@/lib/client-auth";

type Issue = {
  _id: string;
  title: string;
  category: string;
  status: "Pending" | "In Progress" | "Resolved";
  location: string;
  createdAt: string;
  student?: { name: string; email: string };
};

const nextStatus: Record<Issue["status"], Issue["status"]> = {
  Pending: "In Progress",
  "In Progress": "Resolved",
  Resolved: "Resolved",
};

export default function StaffIssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = () => {
    const auth = loadAuth();
    if (!auth) return;
    authFetch("/api/issues/department", { method: "GET" }, auth.token)
      .then((data) => setIssues(data.issues || []))
      .catch((err) => setError(err.message || "Failed to load issues"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdate = async (issue: Issue) => {
    const auth = loadAuth();
    if (!auth) return;
    setUpdatingId(issue._id);
    try {
      const status = nextStatus[issue.status];
      await authFetch(
        `/api/issues/${issue._id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
        auth.token
      );
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Protected allowedRoles={["staff"]}>
      <div className="min-h-screen bg-gray-50 p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Department Issues</h1>
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Title</Th><Th>Category</Th><Th>Status</Th><Th>Student</Th><Th>Created</Th><Th>Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {issues.map((issue) => (
                  <tr key={issue._id} className="hover:bg-gray-50">
                    <Td>{issue.title}</Td>
                    <Td>{issue.category}</Td>
                    <Td><StatusBadge status={issue.status} /></Td>
                    <Td>{issue.student ? `${issue.student.name} (${issue.student.email})` : "-"}</Td>
                    <Td>{new Date(issue.createdAt).toLocaleString()}</Td>
                    <Td>
                      <button
                        onClick={() => handleUpdate(issue)}
                        className="rounded bg-blue-600 text-white px-3 py-1 text-sm hover:bg-blue-700 disabled:opacity-60"
                        disabled={updatingId === issue._id || issue.status === "Resolved"}
                      >
                        {updatingId === issue._id ? "Updating..." : issue.status === "Resolved" ? "Resolved" : "Advance Status"}
                      </button>
                    </Td>
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

function StatusBadge({ status }: { status: Issue["status"] }) {
  const color =
    status === "Resolved" ? "bg-green-100 text-green-700" : status === "In Progress" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-700";
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{status}</span>;
}