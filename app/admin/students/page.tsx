"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AdminProtected from "@/components/AdminProtected";
import AdminShell from "@/components/admin/AdminShell";
import { authFetch, loadAuth } from "@/lib/client-auth";
import { useToast } from "@/components/ToastProvider";
import { Search } from "lucide-react";

type Student = {
  _id: string;
  name: string;
  email: string;
  role?: "student" | "faculty";
  isActive?: boolean;
  isDemoUser?: boolean;
  course?: string | null;
  institute?: string | null;
  department?: { _id: string; name: string; type?: "Academic" | "Service" } | null;
  academicDepartment?: { _id: string; name: string; type?: "Academic" | "Service" } | null;
  createdAt?: string;
};

const POLL_INTERVAL_MS = 30000;
const ENABLE_ADMIN_AUTO_REFRESH = false;
const STUDENT_LIST_ENDPOINT = "/api/admin/students";
const STUDENT_METRICS_ENDPOINT = "/api/admin/metrics?scope=students";

export default function AdminStudentsPage() {
  const auth = useMemo(() => loadAuth(), []);
  const { showToast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "faculty">("all");
  const [academicFilter, setAcademicFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"Active" | "Inactive">("Active");
  const [sortBy, setSortBy] = useState<"joined_desc" | "joined_asc" | "department" | "status">("joined_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState<Student | null>(null);
  const [actionMode, setActionMode] = useState<"activate" | "deactivate" | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [raisedCountMap, setRaisedCountMap] = useState<Record<string, number>>({});
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    document.title = "Users | CampusTracker Admin";
  }, []);

  const getDepartmentName = (student: Student) =>
    student.course?.trim() || student.department?.name || student.academicDepartment?.name || "";

  const academicOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        students
          .map((student) => getDepartmentName(student))
          .filter(Boolean)
      )
    );
    return values.sort((a, b) => a.localeCompare(b));
  }, [students]);

  const loadStudents = (silent = false) => {
    if (!auth) return;
    if (!silent) {
      setLoading(true);
    }

    Promise.all([
      authFetch(STUDENT_LIST_ENDPOINT, { method: "GET" }, auth.token),
      authFetch(STUDENT_METRICS_ENDPOINT, { method: "GET" }, auth.token),
    ])
      .then(([studentsRes, metricsRes]) => {
        setStudents(studentsRes.students || []);
        setRaisedCountMap((metricsRes?.issueCountByStudent || {}) as Record<string, number>);
      })
      .catch((err) =>
        showToast({
          title: "Load Failed",
          message: err instanceof Error ? err.message : "Failed to load users data",
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
    if (!ENABLE_ADMIN_AUTO_REFRESH || !auth) return;
    const intervalId = window.setInterval(() => {
      if (!actionTarget && !actionSubmitting && !document.hidden) {
        loadStudents(true);
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, actionTarget, actionSubmitting]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;
      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const byRole =
      roleFilter === "all"
        ? students
        : students.filter((student) => (student.role || "student") === roleFilter);

    const byAcademic =
      academicFilter === "ALL"
        ? byRole
        : byRole.filter((student) =>
            `${getDepartmentName(student)} ${student.institute || ""}`
              .toLowerCase()
              .includes(academicFilter.toLowerCase())
          );

    const byStatus = byAcademic.filter((student) =>
      statusFilter === "Active" ? student.isActive !== false : student.isActive === false
    );

    const searched = !normalized
      ? byStatus
      : byStatus.filter((student) =>
          `${student.name} ${student.email} ${student.role || "student"}`.toLowerCase().includes(normalized)
        );

    return searched.slice().sort((a, b) => {
      if (sortBy === "joined_desc") {
        return (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0);
      }

      if (sortBy === "joined_asc") {
        return (new Date(a.createdAt || 0).getTime() || 0) - (new Date(b.createdAt || 0).getTime() || 0);
      }

      if (sortBy === "department") {
        return getDepartmentName(a).localeCompare(getDepartmentName(b));
      }

      const aActive = a.isActive === false ? 0 : 1;
      const bActive = b.isActive === false ? 0 : 1;
      return bActive - aActive;
    });
  }, [students, query, roleFilter, academicFilter, sortBy, statusFilter]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: "query" | "role" | "academic" | "status"; label: string }> = [];
    if (query.trim()) chips.push({ key: "query", label: `Search: ${query.trim()}` });
    if (roleFilter !== "all") chips.push({ key: "role", label: `Role: ${roleFilter === "student" ? "Student" : "Faculty"}` });
    if (academicFilter !== "ALL") chips.push({ key: "academic", label: `Department: ${academicFilter}` });
    if (statusFilter === "Inactive") chips.push({ key: "status", label: "Status: Inactive" });
    return chips;
  }, [roleFilter, academicFilter, query, statusFilter]);

  const clearFilterChip = (key: "query" | "role" | "academic" | "status") => {
    if (key === "query") setQuery("");
    if (key === "role") setRoleFilter("all");
    if (key === "academic") setAcademicFilter("ALL");
    if (key === "status") setStatusFilter("Active");
    setCurrentPage(1);
  };

  const resetAllFilters = () => {
    setQuery("");
    setRoleFilter("all");
    setAcademicFilter("ALL");
    setStatusFilter("Active");
    setSortBy("joined_desc");
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [query, roleFilter, academicFilter, statusFilter, sortBy]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredStudents.length / pageSize)), [filteredStudents.length, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const studentsForCards = useMemo(() => {
    if (academicFilter === "ALL") return students;

    return students.filter((student) =>
      `${getDepartmentName(student)} ${student.institute || ""}`
        .toLowerCase()
        .includes(academicFilter.toLowerCase())
    );
  }, [students, academicFilter]);

  const studentSummary = useMemo(() => {
    const total = studentsForCards.length;
    const studentsCount = studentsForCards.filter((item) => (item.role || "student") === "student").length;
    const facultyCount = studentsForCards.filter((item) => (item.role || "student") === "faculty").length;
    const active = studentsForCards.filter((student) => student.isActive !== false).length;
    const inactive = total - active;
    const issuesRaised = studentsForCards.reduce((sum, student) => sum + (raisedCountMap[student._id] || 0), 0);

    return { total, studentsCount, facultyCount, active, inactive, issuesRaised };
  }, [studentsForCards, raisedCountMap]);

  const exportCsv = () => {
    const rows = [
      ["Name", "Email", "Role", "Department", "Issues Raised", "Status"],
      ...filteredStudents.map((student) => [
        student.name,
        student.email,
        (student.role || "student").toUpperCase(),
        getDepartmentName(student) || "—",
        String(raisedCountMap[student._id] || 0),
        student.isActive === false ? "Inactive" : "Active",
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openStatusAction = (student: Student) => {
    const mode = student.isActive === false ? "activate" : "deactivate";
    setActionTarget(student);
    setActionMode(mode);
  };

  const closeStatusAction = () => {
    if (actionSubmitting) return;
    setActionTarget(null);
    setActionMode(null);
  };

  const submitStatusAction = async () => {
    if (!auth || !actionTarget || !actionMode) return;

    const endpoint =
      actionMode === "activate"
        ? `/api/admin/users/${actionTarget._id}/activate`
        : `/api/admin/users/${actionTarget._id}/deactivate`;

    setActionSubmitting(true);
    try {
      await authFetch(endpoint, { method: "PATCH" }, auth.token);
      showToast({
        message:
          actionMode === "activate"
            ? "User activated successfully"
            : "User deactivated successfully",
        variant: "success",
      });
      setActionTarget(null);
      setActionMode(null);
      loadStudents(true);
    } catch (err) {
      showToast({
        title: "Update Failed",
        message: err instanceof Error ? err.message : "Failed to update user status",
        variant: "error",
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  return (
    <AdminProtected allowedAdminRoles={["super_admin"]}>
      <AdminShell
        title="Users Management"
        subtitle="View and manage student and faculty accounts"
        headerActions={
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
        }
      >
        <div className="space-y-4">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Users</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{studentSummary.total}</p>
              <p className="mt-1 text-xs text-slate-500">Based on academic department filter</p>
            </article>
            <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Students</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-900">{studentSummary.studentsCount}</p>
              <p className="mt-1 text-xs text-emerald-700">Role: student</p>
            </article>
            <article className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Faculty</p>
              <p className="mt-2 text-2xl font-semibold text-violet-900">{studentSummary.facultyCount}</p>
              <p className="mt-1 text-xs text-violet-700">Role: faculty</p>
            </article>
            <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Active Users</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-900">{studentSummary.active}</p>
              <p className="mt-1 text-xs text-emerald-700">Can sign in</p>
            </article>
            <article className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Inactive Users</p>
              <p className="mt-2 text-2xl font-semibold text-rose-900">{studentSummary.inactive}</p>
              <p className="mt-1 text-xs text-rose-700">Deactivated accounts</p>
            </article>
            <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Issues Raised</p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">{studentSummary.issuesRaised}</p>
              <p className="mt-1 text-xs text-amber-700">From listed users</p>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  roleFilter === "all"
                    ? "bg-teal-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                All Users
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("student")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  roleFilter === "student"
                    ? "bg-sky-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Students
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("faculty")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  roleFilter === "faculty"
                    ? "bg-violet-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Faculty
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                  placeholder="Search users by name or email..."
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

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "Active" | "Inactive")}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-teal-500 sm:w-44"
              >
                <option value="Active">Active Users</option>
                <option value="Inactive">Inactive Users</option>
              </select>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as "joined_desc" | "joined_asc" | "department" | "status")}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-teal-500 sm:w-48"
              >
                <option value="joined_desc">Sort: Newest</option>
                <option value="joined_asc">Sort: Oldest</option>
                <option value="department">Sort: Department</option>
                <option value="status">Sort: Status</option>
              </select>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Active users are shown by default. Switch to Inactive Users to view deactivated accounts.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeFilterChips.length > 0 ? (
                <>
                  <span className="text-xs font-semibold text-slate-500">Filters applied:</span>
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => clearFilterChip(chip.key)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {chip.label}
                      <span>×</span>
                    </button>
                  ))}
                </>
              ) : (
                <span className="text-xs text-slate-500">No filters applied</span>
              )}
              <button
                type="button"
                onClick={resetAllFilters}
                className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset All
              </button>
            </div>
          </section>

          {loading ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="skeleton-shimmer h-10 rounded bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Department</Th>
                    <Th>Issues Raised</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((student) => (
                    <tr key={student._id} className="border-b border-slate-200 transition hover:bg-gray-50 last:border-b-0">
                      <Td className="font-semibold text-slate-800">{student.name}</Td>
                      <Td>{student.email}</Td>
                      <Td>
                        {(student.role || "student") === "faculty" ? (
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                            Faculty
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                            Student
                          </span>
                        )}
                      </Td>
                      <Td>{getDepartmentName(student) || "—"}</Td>
                      <Td>
                        {(raisedCountMap[student._id] || 0) > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            {raisedCountMap[student._id] || 0}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">0</span>
                        )}
                      </Td>
                      <Td>
                        <StatusBadge isActive={student.isActive !== false} />
                        {student.isDemoUser && process.env.NODE_ENV !== "production" ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Test</span>
                        ) : null}
                      </Td>
                      <Td className="text-right">
                        <button
                          type="button"
                          onClick={() => openStatusAction(student)}
                          disabled={actionSubmitting}
                          className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            student.isActive === false
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {student.isActive === false ? "Activate" : "Deactivate"}
                        </button>
                      </Td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <Td className="py-10 text-center text-slate-500" colSpan={7}>
                        No data available
                      </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing {filteredStudents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                -{Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} filtered users ({students.length} total)
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={String(pageSize)}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
                >
                  <option value="10">10 / page</option>
                  <option value="20">20 / page</option>
                  <option value="50">50 / page</option>
                </select>

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {actionTarget && actionMode ? (
            <StatusActionModal
              open
              mode={actionMode}
              userName={actionTarget.name}
              submitting={actionSubmitting}
              onCancel={closeStatusAction}
              onConfirm={submitStatusAction}
            />
          ) : null}
        </div>
      </AdminShell>
    </AdminProtected>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
      Inactive
    </span>
  );
}

function StatusActionModal({
  open,
  mode,
  userName,
  submitting,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  mode: "activate" | "deactivate";
  userName: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  const isDeactivate = mode === "deactivate";
  const title = isDeactivate ? "Deactivate User" : "Activate User";
  const message = isDeactivate
    ? "Are you sure you want to deactivate this user? They will not be able to log in."
    : "Activate this user account?";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <p className="mt-1 text-xs text-slate-500">User: {userName}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
              isDeactivate ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {submitting ? "Updating..." : isDeactivate ? "Deactivate" : "Activate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-sm font-semibold text-slate-600 ${className}`}>{children}</th>;
}

function Td({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`px-4 py-4 text-sm text-slate-500 ${className}`}>
      {children}
    </td>
  );
}
