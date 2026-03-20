"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { StudentSidebar, studentNavItems } from "@/app/student/components/StudentSidebar";
import { StudentNavbar } from "@/app/student/components/StudentNavbar";
import { authFetch, clearAuth, loadAuth } from "@/lib/client-auth";
import {
  AlertCircle,
  Calendar,
  MapPin,
  Pencil,
  PlusCircle,
  Tag,
  Search,
  Trash2,
} from "lucide-react";

const statusFilters = ["All", "Pending", "In Progress", "Resolved"] as const;
type StatusFilter = (typeof statusFilters)[number];

type Issue = {
  _id: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  location: string;
  imageUrl?: string | null;
  createdAt: string;
};

const POLL_INTERVAL_MS = 10000;

export default function StudentIssuesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useMemo(() => loadAuth(), []);
  const cacheKey = "scit_issues_cache";
  const cacheTtlMs = 2 * 60 * 1000;
  const cachedIssues = readCachedIssues(cacheKey, cacheTtlMs);
  const [issues, setIssues] = useState<Issue[]>(() => cachedIssues || []);
  const [loading, setLoading] = useState(() => Boolean(auth) && !cachedIssues);
  const [error, setError] = useState<string | null>(() =>
    auth ? null : "You're not authenticated. Please sign in again."
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userName] = useState(() => auth?.user.name?.trim() || auth?.user.email || "there");
  const [userInitials] = useState(() => getInitials(auth?.user.name || auth?.user.email || "there"));
  const userEmail = auth?.user.email || "student@example.com";
  const userRoleLabel = formatRoleLabel(auth?.user.role);
  const firstName = userName.split(" ")[0] || "Student";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!auth) return;
    let isMounted = true;

    authFetch("/api/issues/mine", { method: "GET" }, auth.token)
      .then((data) => {
        if (isMounted) {
          const latest = data.issues || [];
          setIssues(latest);
          writeCachedIssues(cacheKey, latest);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load issues");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [auth, cacheKey, cacheTtlMs]);

  useEffect(() => {
    if (!auth) return;

    const intervalId = window.setInterval(() => {
      if (deletingId) return;

      authFetch("/api/issues/mine", { method: "GET" }, auth.token)
        .then((data) => {
          const latest = data.issues || [];
          setIssues(latest);
          writeCachedIssues(cacheKey, latest);
        })
        .catch(() => {
          // keep existing list on transient polling failures
        });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [auth, cacheKey, deletingId]);

  const filteredIssues = useMemo(() => {
    const term = search.trim().toLowerCase();
    return issues.filter((issue) => {
      const matchesStatus = statusFilter === "All" ? true : issue.status === statusFilter;
      const matchesSearch =
        !term ||
        issue.title.toLowerCase().includes(term) ||
        issue.category.toLowerCase().includes(term) ||
        issue.location.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [issues, statusFilter, search]);

  const handleSignOut = () => {
    clearAuth();
    router.replace("/login");
  };

  const handleDelete = async (issueId: string) => {
    if (!auth || deletingId) return;
    const confirmed = window.confirm("Delete this issue? This action cannot be undone.");
    if (!confirmed) return;

    setDeletingId(issueId);
    try {
      await authFetch(`/api/issues/${issueId}`, { method: "DELETE" }, auth.token);
      setIssues((prev) => prev.filter((issue) => issue._id !== issueId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete issue");
    } finally {
      setDeletingId(null);
    }
  };

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
            onSignOut={handleSignOut}
            title="My Issues"
            subtitle="View and track all your reported issues."
            className="relative z-20"
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

            {error && !loading && <ErrorPanel message={error} />}

            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <label className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="Search issues..."
                  />
                </label>

                <div className="w-full md:w-48">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                  >
                    {statusFilters.map((filter) => (
                      <option key={filter} value={filter}>
                        {filter === "All" ? "All Statuses" : filter}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              {loading ? (
                <IssueCardSkeleton />
              ) : filteredIssues.length === 0 ? (
                <EmptyState />
              ) : (
                filteredIssues.map((issue) => (
                  <IssueCard
                    key={issue._id}
                    issue={issue}
                    deleting={deletingId === issue._id}
                    onDelete={() => handleDelete(issue._id)}
                  />
                ))
              )}
            </section>
          </main>
        </div>
      </div>
    </Protected>
  );
}

function IssueCard({ issue, deleting, onDelete }: { issue: Issue; deleting: boolean; onDelete: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-900">{issue.title}</h3>
            <StatusBadge status={issue.status} />
          </div>
          {issue.description && <p className="text-sm text-slate-500">{issue.description}</p>}
        </div>

        {issue.imageUrl && (
          <div className="h-20 w-28 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
            <Image
              src={issue.imageUrl}
              alt={issue.title}
              width={112}
              height={80}
              className="h-full w-full object-cover"
              unoptimized
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Link
            href={`/student/issues/${issue._id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
          >
            <Pencil size={14} /> Edit
          </Link>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={14} /> {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={14} />
          {issue.location}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={14} />
          {formatDate(issue.createdAt)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
          <Tag size={12} />
          {issue.category}
        </span>
      </div>
    </div>
  );
}

function IssueCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm animate-pulse">
      <div className="h-5 w-32 rounded bg-slate-200" />
      <div className="mt-3 h-3 w-64 rounded bg-slate-100" />
      <div className="mt-6 flex gap-3">
        <div className="h-3 w-32 rounded bg-slate-100" />
        <div className="h-3 w-24 rounded bg-slate-100" />
        <div className="h-5 w-20 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center">
      <AlertCircle size={32} className="text-slate-300" />
      <p className="text-base font-semibold text-slate-700">No matching issues</p>
      <p className="text-sm text-slate-500">Adjust the filters or report a new issue to get started.</p>
      <Link
        href="/student/report"
        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
      >
        <PlusCircle size={16} /> Report New Issue
      </Link>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
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
  if (Number.isNaN(date.getTime())) return "—";
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

function readCachedIssues(key: string, ttlMs: number) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; issues: Issue[] };
    if (!parsed.timestamp || !Array.isArray(parsed.issues)) return null;
    if (Date.now() - parsed.timestamp > ttlMs) return null;
    return parsed.issues;
  } catch {
    return null;
  }
}

function writeCachedIssues(key: string, issues: Issue[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), issues }));
  } catch {
    // ignore storage failures
  }
}
