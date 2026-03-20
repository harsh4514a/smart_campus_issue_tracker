"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { StudentSidebar, studentNavItems } from "@/app/student/components/StudentSidebar";
import { StudentNavbar } from "@/app/student/components/StudentNavbar";
import { authFetch, clearAuth, loadAuth } from "@/lib/client-auth";
import { ClipboardList, Search } from "lucide-react";

type Issue = {
  _id: string;
  title: string;
  category: string;
  location: string;
  status: string;
  createdAt: string;
};

const PAGE_LIMIT = 20;

export default function StudentAllIssuesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useMemo(() => loadAuth(), []);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(() => Boolean(auth));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [buildingFilter, setBuildingFilter] = useState("All");
  const [roomFilter, setRoomFilter] = useState("All");

  const userName = auth?.user.name?.trim() || auth?.user.email || "Student";
  const userEmail = auth?.user.email || "student@example.com";
  const userInitials = getInitials(userName);
  const userRoleLabel = formatRoleLabel(auth?.user.role);
  const firstName = userName.split(" ")[0] || "Student";

  const fetchIssuesPage = async (pageToLoad: number, append: boolean) => {
    if (!auth) return;

    const data = await authFetch(`/api/issues?page=${pageToLoad}&limit=${PAGE_LIMIT}`, { method: "GET" }, auth.token);
    const incoming = Array.isArray(data?.issues) ? (data.issues as Issue[]) : [];

    setIssues((prev) => {
      if (!append) return incoming;

      const merged = [...prev, ...incoming];
      const uniqueById = new Map(merged.map((issue) => [issue._id, issue]));
      return Array.from(uniqueById.values());
    });

    setPage(pageToLoad);
    setHasMore(Boolean(data?.hasMore));
    setError(null);
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    setLoading(true);

    fetchIssuesPage(1, false)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load all issues");
      })
      .finally(() => setLoading(false));
  }, [auth]);

  const handleLoadMore = async () => {
    if (!auth || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      await fetchIssuesPage(page + 1, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more issues");
    } finally {
      setLoadingMore(false);
    }
  };

  const categoryOptions = useMemo(() => {
    return ["All", ...Array.from(new Set(issues.map((issue) => issue.category).filter(Boolean)))];
  }, [issues]);

  const roomOptions = useMemo(() => {
    const rooms = issues.map((issue) => splitLocation(issue.location).room).filter((room) => room && room !== "-");
    return ["All", ...Array.from(new Set(rooms))];
  }, [issues]);

  const buildingOptions = useMemo(() => {
    const buildings = issues
      .map((issue) => splitLocation(issue.location).building)
      .filter((building) => building && building !== "-");
    return ["All", ...Array.from(new Set(buildings))];
  }, [issues]);

  const filteredIssues = useMemo(() => {
    const term = search.trim().toLowerCase();
    return issues.filter((issue) => {
      const { building, room } = splitLocation(issue.location);
      const matchesStatus = statusFilter === "All" || issue.status === statusFilter;
      const matchesCategory = categoryFilter === "All" || issue.category === categoryFilter;
      const matchesBuilding = buildingFilter === "All" || building === buildingFilter;
      const matchesRoom = roomFilter === "All" || room === roomFilter;
      const matchesSearch =
        !term ||
        issue.title.toLowerCase().includes(term) ||
        issue.category.toLowerCase().includes(term) ||
        issue.location.toLowerCase().includes(term) ||
        issue.status.toLowerCase().includes(term);

      return (
        matchesStatus &&
        matchesCategory &&
        matchesBuilding &&
        matchesRoom &&
        matchesSearch
      );
    });
  }, [issues, search, statusFilter, categoryFilter, buildingFilter, roomFilter]);

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
            subtitle="Browse campus issues and track current status."
          />

          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            <nav className="flex gap-2 lg:hidden">
              {studentNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 rounded-xl border px-3 py-2 text-center text-sm font-medium ${
                    pathname === item.href
                      ? "border-emerald-200 bg-white text-emerald-700"
                      : "border-transparent bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="relative block md:col-span-2 xl:col-span-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="Search issues..."
                  />
                </label>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Rejected">Rejected</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category === "All" ? "All Categories" : category}
                    </option>
                  ))}
                </select>

                <select
                  value={buildingFilter}
                  onChange={(event) => setBuildingFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                >
                  {buildingOptions.map((building) => (
                    <option key={building} value={building}>
                      {building === "All" ? "All Buildings" : building}
                    </option>
                  ))}
                </select>

                <select
                  value={roomFilter}
                  onChange={(event) => setRoomFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                >
                  {roomOptions.map((room) => (
                    <option key={room} value={room}>
                      {room === "All" ? "All Rooms" : room}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
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
                    ) : filteredIssues.length === 0 ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={6}>
                          <div className="flex flex-col items-center gap-2">
                            <ClipboardList size={28} className="text-slate-300" />
                            <span>No issues found.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredIssues.map((issue) => {
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
            </section>

            {!loading && hasMore && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </Protected>
  );
}

function splitLocation(location: string) {
  const [building = "-", room = "-"] = String(location || "").split(" · ");
  return {
    building: building || "-",
    room: room || "-",
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
