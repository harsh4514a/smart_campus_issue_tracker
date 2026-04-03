"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { StudentSidebar } from "@/app/student/components/StudentSidebar";
import { StudentNavbar } from "@/app/student/components/StudentNavbar";
import { authFetch, clearAuth, loadAuth } from "@/lib/client-auth";
import { ClipboardList, Search, SlidersHorizontal } from "lucide-react";

type Issue = {
  _id: string;
  title: string;
  category: string;
  location: string;
  status: string;
  createdAt: string;
};

type SortBy = "created_desc" | "created_asc" | "status" | "category";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const MAX_VISIBLE_PAGES = 5;
const STATUS_OPTIONS = ["All", "Pending", "In Progress", "Resolved", "Rejected"] as const;

export default function StudentAllIssuesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useMemo(() => loadAuth(), []);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(() => Boolean(auth));
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState<SortBy>("created_desc");
  const [categoryOptions, setCategoryOptions] = useState<string[]>(["All"]);

  const userName = auth?.user.name?.trim() || auth?.user.email || "Student";
  const userEmail = auth?.user.email || "student@example.com";
  const userInitials = getInitials(userName);
  const userRoleLabel = formatRoleLabel(auth?.user.role);
  const firstName = userName.split(" ")[0] || "Student";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const next = searchInput.trim();
      setSearchQuery(next);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (!auth) {
      return;
    }

    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
      sortBy,
    });

    if (searchQuery) {
      params.set("search", searchQuery);
    }

    if (statusFilter !== "All") {
      params.set("status", statusFilter);
    }

    if (categoryFilter !== "All") {
      params.set("category", categoryFilter);
    }

    const controller = new AbortController();
    const loadingTimeoutId = window.setTimeout(() => {
      setLoading(true);
    }, 0);

    authFetch(`/api/issues?${params.toString()}`, { method: "GET", signal: controller.signal }, auth.token)
      .then((data: unknown) => {
        if (controller.signal.aborted) return;

        const payload = (data || {}) as {
          issues?: Issue[];
          page?: number;
          totalPages?: number;
          totalItems?: number;
        };

        const nextIssues = Array.isArray(payload.issues) ? payload.issues : [];
        setIssues(nextIssues);

        const nextTotalItems =
          typeof payload.totalItems === "number" && Number.isFinite(payload.totalItems)
            ? payload.totalItems
            : nextIssues.length;
        const nextTotalPages =
          typeof payload.totalPages === "number" && Number.isFinite(payload.totalPages)
            ? Math.max(1, payload.totalPages)
            : Math.max(1, Math.ceil(nextTotalItems / pageSize));
        const nextPage = typeof payload.page === "number" && Number.isFinite(payload.page) ? payload.page : page;

        setTotalItems(nextTotalItems);
        setTotalPages(nextTotalPages);
        if (nextPage !== page) {
          setPage(nextPage);
        }

        const incomingCategories = nextIssues
          .map((issue) => issue.category?.trim())
          .filter((value): value is string => Boolean(value));

        setCategoryOptions((prev) => {
          const merged = new Set(prev.filter((value) => value !== "All"));
          for (const category of incomingCategories) {
            merged.add(category);
          }
          if (categoryFilter !== "All") {
            merged.add(categoryFilter);
          }
          return ["All", ...Array.from(merged).sort((a, b) => a.localeCompare(b))];
        });

        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load all issues");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      window.clearTimeout(loadingTimeoutId);
      controller.abort();
    };
  }, [auth, categoryFilter, page, pageSize, searchQuery, sortBy, statusFilter]);

  const showingStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingEnd = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);
  const visiblePages = useMemo(() => getVisiblePages(page, totalPages, MAX_VISIBLE_PAGES), [page, totalPages]);

  const resetFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStatusFilter("All");
    setCategoryFilter("All");
    setSortBy("created_desc");
    setPageSize(DEFAULT_PAGE_SIZE);
    setPage(1);
  };

  const hasActiveFilters =
    searchQuery.length > 0 ||
    statusFilter !== "All" ||
    categoryFilter !== "All" ||
    sortBy !== "created_desc" ||
    pageSize !== DEFAULT_PAGE_SIZE;

  return (
    <Protected allowedRoles={["student", "faculty"]}>
      <div className="min-h-screen bg-slate-50 flex">
        <StudentSidebar
          pathname={pathname}
          initials={userInitials}
          userName={userName}
          roleLabel={userRoleLabel}
        />

        <div className="flex-1 flex flex-col">
          <StudentNavbar
            firstName={firstName}
            userName={userName}
            userEmail={userEmail}
            userInitials={userInitials}
            onSignOut={() => {
              clearAuth();
              router.replace("/login");
            }}
            title="All Issues"
            subtitle="Browse campus issues and monitor resolution progress."
          />

          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            {error ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="relative block md:col-span-2 xl:col-span-2">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="Search by title, category, location"
                  />
                </label>

                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as (typeof STATUS_OPTIONS)[number]);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status === "All" ? "All Statuses" : status}
                    </option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category === "All" ? "All Categories" : category}
                    </option>
                  ))}
                </select>

                <select
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value as SortBy);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="created_desc">Sort: Newest</option>
                  <option value="created_asc">Sort: Oldest</option>
                  <option value="status">Sort: Status</option>
                  <option value="category">Sort: Category</option>
                </select>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {hasActiveFilters ? "Filters applied" : "No filters applied"}
                </div>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Clear All Filters
                  </button>
                ) : null}
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
                <span>
                  Showing {showingStart}-{showingEnd} of {totalItems} issues
                </span>
                {loading ? <span className="rounded-full bg-slate-200 px-2 py-0.5">Refreshing...</span> : null}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Building</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Room</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>Loading issues...</td>
                      </tr>
                    ) : issues.length === 0 ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={6}>
                          <div className="flex flex-col items-center gap-2">
                            <ClipboardList size={28} className="text-slate-300" />
                            <span>No issues found.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      issues.map((issue) => {
                        const { building, room } = splitLocation(issue.location);

                        return (
                          <tr key={issue._id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">{issue.title}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{issue.category || "-"}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{building}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{room}</td>
                            <td className="px-4 py-3 text-sm">
                              <StatusBadge status={issue.status} />
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{formatDate(issue.createdAt)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                    <label htmlFor="issues-page-size" className="text-xs">Rows per page</label>
                    <select
                      id="issues-page-size"
                      value={String(pageSize)}
                      onChange={(event) => {
                        const nextSize = Number(event.target.value);
                        if (!Number.isFinite(nextSize) || nextSize <= 0) return;
                        setPageSize(nextSize);
                        setPage(1);
                      }}
                      className="inline-flex h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
                    >
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPage(1)}
                      disabled={loading || page <= 1}
                      className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      First
                    </button>

                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={loading || page <= 1}
                      className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>

                    {visiblePages.map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setPage(pageNumber)}
                        disabled={loading}
                        aria-current={pageNumber === page ? "page" : undefined}
                        className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                          pageNumber === page
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={loading || page >= totalPages}
                      className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>

                    <button
                      type="button"
                      onClick={() => setPage(totalPages)}
                      disabled={loading || page >= totalPages}
                      className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Last
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </Protected>
  );
}

function splitLocation(location: string) {
  const normalized = String(location || "").trim();
  if (!normalized || normalized.toLowerCase() === "not specified") {
    return { building: "-", room: "-" };
  }

  const splitBy = (delimiter: string) =>
    normalized
      .split(delimiter)
      .map((part) => part.trim())
      .filter(Boolean);

  const dotParts = splitBy(" · ");
  if (dotParts.length >= 2) {
    return { building: dotParts[0], room: dotParts[1] };
  }

  const pipeParts = splitBy("|");
  if (pipeParts.length >= 2) {
    return { building: pipeParts[0], room: pipeParts[1] };
  }

  const commaParts = splitBy(",");
  if (commaParts.length >= 2) {
    return { building: commaParts[0], room: commaParts[1] };
  }

  return {
    building: normalized,
    room: "-",
  };
}

function StatusBadge({ status }: { status: string }) {
  const palette =
    status === "Resolved"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
      : status === "In Progress"
        ? "bg-sky-50 text-sky-700 border border-sky-100"
        : status === "Pending"
          ? "bg-amber-50 text-amber-700 border border-amber-100"
          : "bg-slate-100 text-slate-600 border border-slate-200";

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${palette}`}>{status}</span>;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(value: string) {
  const initials = value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "ST";
}

function formatRoleLabel(role?: string) {
  if (!role) return "Student";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function getVisiblePages(currentPage: number, totalPages: number, maxVisible: number) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeMaxVisible = Math.max(1, maxVisible);

  if (safeTotalPages <= safeMaxVisible) {
    return Array.from({ length: safeTotalPages }, (_, index) => index + 1);
  }

  const halfWindow = Math.floor(safeMaxVisible / 2);
  let start = Math.max(1, currentPage - halfWindow);
  let end = start + safeMaxVisible - 1;

  if (end > safeTotalPages) {
    end = safeTotalPages;
    start = Math.max(1, end - safeMaxVisible + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
