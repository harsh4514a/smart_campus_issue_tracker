"use client";

import { useEffect, useState } from "react";
import Protected from "@/components/Protected";
import { authFetch, loadAuth } from "@/lib/client-auth";

type Department = { _id: string; name: string };
type Issue = {
  _id: string;
  title: string;
  category: string;
  status: "Pending" | "In Progress" | "Resolved";
  location: string;
  student?: { name: string; email: string };
  department?: Department;
};

export default function AdminIssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const auth = loadAuth();

  const load = () => {
    if (!auth) return;
    Promise.all([
      authFetch("/api/admin/issues", { method: "GET" }, auth.token),
      authFetch("/api/admin/departments", { method: "GET" }, auth.token),
    ])
      .then(([issuesRes, deptRes]) => {
        setIssues(issuesRes.issues || []);
        setDepartments(deptRes.departments || []);
      })
    .catch((err) => setError(err instanceof Error ? err.message : "Failed to load issues"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAssign = async (issueId: string, departmentId: string, status?: Issue["status"]) => {
    if (!auth) return;
    setSavingId(issueId);
    try {
      await authFetch(
        `/api/issues/${issueId}/assign`,
        { method: "PATCH", body: JSON.stringify({ departmentId, status }) },
        auth.token
      );
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to assign";
      setError(message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Protected allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-50 p-6 space-y-4">
        <h1 className="text-2xl font-semibold">All Issues</h1>
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Title</Th><Th>Category</Th><Th>Status</Th><Th>Student</Th><Th>Department</Th><Th>Assign</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {issues.map((issue) => (
                  <tr key={issue._id} className="hover:bg-gray-50">
                    <Td>{issue.title}</Td>
                    <Td>{issue.category}</Td>
                    <Td><StatusBadge status={issue.status} /></Td>
                    <Td>{issue.student ? `${issue.student.name} (${issue.student.email})` : "-"}</Td>
                    <Td>{issue.department?.name || "Unassigned"}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <select
                          className="rounded border px-2 py-1 text-sm"
                          defaultValue={issue.department?._id || ""}
                          onChange={(e) => onAssign(issue._id, e.target.value || "", issue.status)}
                        >
                          <option value="">Select dept</option>
                          {departments.map((d) => (
                            <option key={d._id} value={d._id}>{d.name}</option>
                          ))}
                        </select>
                        <button
                          className="rounded bg-blue-600 text-white px-3 py-1 text-sm hover:bg-blue-700 disabled:opacity-60"
                          disabled={savingId === issue._id}
                          onClick={() => onAssign(issue._id, issue.department?._id || "", issue.status)}
                        >
                          {savingId === issue._id ? "Saving..." : "Save"}
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