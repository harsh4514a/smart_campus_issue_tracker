"use client";

import { useEffect, useMemo, useState } from "react";
import AdminProtected from "@/components/AdminProtected";
import AdminShell from "@/components/admin/AdminShell";
import { authFetch, loadAuth } from "@/lib/client-auth";
import { useToast } from "@/components/ToastProvider";
import { Search, Trash2 } from "lucide-react";

type Department = {
  _id: string;
  name: string;
  type?: "Academic" | "Service";
};

type Student = {
  _id: string;
  name: string;
  email: string;
  course?: string | null;
  institute?: string | null;
  department?: { _id: string; name: string; type?: "Academic" | "Service" } | null;
  createdAt?: string;
};

const POLL_INTERVAL_MS = 10000;

export default function AdminStudentsPage() {
  const auth = loadAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [query, setQuery] = useState("");
  const [academicFilter, setAcademicFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const academicOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        departments
          .filter((department) => department.type === "Academic")
          .map((department) => department.name.trim())
          .filter(Boolean)
      )
    );
    return values.sort((a, b) => a.localeCompare(b));
  }, [departments]);

  const loadStudents = (silent = false) => {
    if (!auth) return;
    if (!silent) {
      setLoading(true);
    }

    Promise.all([
      authFetch("/api/admin/students", { method: "GET" }, auth.token),
      authFetch("/api/admin/departments", { method: "GET" }, auth.token),
    ])
      .then(([studentsRes, departmentsRes]) => {
        setStudents(studentsRes.students || []);
        setDepartments(departmentsRes.departments || []);
      })
      .catch((err) =>
        showToast({
          title: "Load Failed",
          message: err instanceof Error ? err.message : "Failed to load students data",
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
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auth) return;
    const intervalId = window.setInterval(() => {
      if (!deletingId) {
        loadStudents(true);
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, deletingId]);

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const byAcademic =
      academicFilter === "ALL"
        ? students
        : students.filter((student) =>
            `${student.department?.name || ""} ${student.course || ""} ${student.institute || ""}`
              .toLowerCase()
              .includes(academicFilter.toLowerCase())
          );

    if (!normalized) return byAcademic;

    return byAcademic.filter((student) => `${student.name} ${student.email}`.toLowerCase().includes(normalized));
  }, [students, query, academicFilter]);

  const onDelete = async (student: Student) => {
    if (!auth) return;

    const confirmed = window.confirm(`Delete student ${student.name}?`);
    if (!confirmed) return;

    setDeletingId(student._id);
    try {
      await authFetch(`/api/admin/students/${student._id}`, { method: "DELETE" }, auth.token);
      showToast({ title: "Success", message: "Student deleted successfully", variant: "success" });
      loadStudents();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete student";
      showToast({ title: "Delete Failed", message, variant: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminProtected>
      <AdminShell title="Students Management" subtitle="View and manage student accounts">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                  placeholder="Search students by name or email..."
                />
              </div>

              <select
                value={academicFilter}
                onChange={(e) => setAcademicFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-teal-500 sm:w-56"
              >
                <option value="ALL">Academic Department</option>
                {academicOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
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
                    <Th>Status</Th>
                    <Th>Joined</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student._id} className="border-b border-slate-200 last:border-b-0">
                      <Td className="font-semibold text-slate-800">{student.name}</Td>
                      <Td>{student.email}</Td>
                      <Td>
                        <span className="inline-flex items-center rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
                          Active
                        </span>
                      </Td>
                      <Td>{formatDate(student.createdAt)}</Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                            onClick={() => onDelete(student)}
                            disabled={deletingId === student._id}
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

          {!loading && (
            <p className="text-center text-sm text-slate-500">
              Showing {filteredStudents.length} of {students.length} students
            </p>
          )}
        </div>
      </AdminShell>
    </AdminProtected>
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
