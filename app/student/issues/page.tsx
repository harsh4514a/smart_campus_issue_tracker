"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { StudentSidebar, studentNavItems } from "@/app/student/components/StudentSidebar";
import { StudentUserActions } from "@/app/student/components/StudentUserActions";
import { authFetch, clearAuth, loadAuth } from "@/lib/client-auth";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  PlusCircle,
  Search,
} from "lucide-react";

const statusFilters = ["All", "Pending", "In Progress", "Resolved"] as const;
type StatusFilter = (typeof statusFilters)[number];

type Issue = {
  _id: string;
  title: string;
  category: string;
  status: string;
  location: string;
  createdAt: string;
};

export default function StudentIssuesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useMemo(() => loadAuth(), []);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(() => Boolean(auth));
  const [error, setError] = useState<string | null>(() =>
    auth ? null : "You're not authenticated. Please sign in again."
  );
  const [userName] = useState(() => auth?.user.name?.trim() || auth?.user.email || "there");
  const [userInitials] = useState(() => getInitials(auth?.user.name || auth?.user.email || "there"));
  const userEmail = auth?.user.email || "student@example.com";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!auth) return;
    let isMounted = true;

    authFetch("/api/issues/mine", { method: "GET" }, auth.token)
      .then((data) => {
        if (isMounted) {
          setIssues(data.issues || []);
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
  }, [auth]);

  const stats = useMemo(() => {
    const total = issues.length;
    const pending = issues.filter((i) => i.status === "Pending").length;
    const inProgress = issues.filter((i) => i.status === "In Progress").length;
    const resolved = issues.filter((i) => i.status === "Resolved").length;

    return [
      {
        label: "Total Issues",
        value: total,
        description: "All reports you've logged",
        icon: ClipboardList,
        accent: "bg-emerald-50 text-emerald-600",
      },
      {
        label: "Pending",
        value: pending,
        description: "Waiting for review",
        icon: Clock3,
        accent: "bg-amber-50 text-amber-600",
      },
      {
        label: "In Progress",
        value: inProgress,
        description: "Currently being handled",
        icon: Loader2,
        accent: "bg-sky-50 text-sky-600",
      },
      {
        label: "Resolved",
        value: resolved,
        description: "Successfully closed",
        icon: CheckCircle2,
        accent: "bg-lime-50 text-lime-600",
      },
    ];
  }, [issues]);

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

  const firstName = userName.split(" ")[0] || "there";
  const handleSignOut = () => {
    clearAuth();
    router.replace("/login");
  };

  return (
    <Protected allowedRoles={["student", "faculty"]}>
      <div className="min-h-screen bg-slate-50 flex">
        <StudentSidebar pathname={pathname} initials={userInitials} userName={userName} />

        <div className="flex-1 flex flex-col">
          <header className="border-b border-slate-200 bg-white px-6 py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Here&apos;s a look at everything you&apos;ve reported, {firstName}.</p>
              <h1 className="text-2xl font-semibold text-slate-900">Manage and track all your issues in one place.</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/student/report"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-5 py-2.5 text-sm font-medium shadow-sm hover:bg-emerald-500"
              >
                <PlusCircle size={16} /> Report Issue
              </Link>
              <StudentUserActions
                name={userName}
                email={userEmail}
                initials={userInitials}
                onSignOut={handleSignOut}
              />
            </div>
          </header>

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

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <SummaryCard key={stat.label} {...stat} loading={loading} />
              ))}
            </section>

            <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">My Issues</h2>
                  <p className="text-sm text-slate-500">Review status, locations, and timelines for every report.</p>
                </div>
                <div className="text-sm font-medium text-slate-500">
                  {issues.length === 0 ? "No issues logged yet" : `${issues.length} total issues`}
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {statusFilters.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setStatusFilter(filter)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                          statusFilter === filter
                            ? "bg-emerald-600 text-white shadow"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  <label className="relative w-full md:w-72">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="Search by title, category, or location"
                    />
                  </label>
                </div>

                {loading ? (
                  <IssueTableSkeleton />
                ) : filteredIssues.length === 0 ? (
                  <EmptyState />
                ) : (
                  <IssuesTable issues={filteredIssues} />
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </Protected>
  );
}

function SummaryCard({ label, value, description, icon: Icon, accent, loading }: SummaryCardProps) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-3 w-24 rounded-full bg-slate-200" />
          <div className="h-8 w-16 rounded-full bg-slate-200" />
          <div className="h-3 w-32 rounded-full bg-slate-100" />
        </div>
      ) : (
        <>
          <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl ${accent}`}>
            <Icon size={20} />
          </div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-3xl font-semibold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </>
      )}
    </div>
  );
}

function IssuesTable({ issues }: { issues: Issue[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-slate-600">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-500">
            <Th>Title</Th>
            <Th>Category</Th>
            <Th>Status</Th>
            <Th>Location</Th>
            <Th>Reported</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {issues.map((issue) => (
            <tr key={issue._id} className="bg-white">
              <Td>
                <p className="font-medium text-slate-900">{issue.title}</p>
                <p className="text-xs text-slate-500">{formatDateTime(issue.createdAt)}</p>
              </Td>
              <Td>{issue.category}</Td>
              <Td>
                <StatusBadge status={issue.status} />
              </Td>
              <Td>{issue.location}</Td>
              <Td>{formatDateTime(issue.createdAt)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IssueTableSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-100 p-4 shadow-sm animate-pulse">
      {[...Array(3)].map((_, idx) => (
        <div key={idx} className="h-12 rounded-xl bg-slate-100" />
      ))}
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

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

interface SummaryCardProps {
  label: string;
  value: number;
  description: string;
  icon: ComponentType<{ size?: number }>;
  accent: string;
  loading: boolean;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 text-sm text-gray-700">{children}</td>;
}