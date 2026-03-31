"use client";

import { useMemo, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { StudentSidebar } from "@/app/student/components/StudentSidebar";
import { StudentNavbar } from "@/app/student/components/StudentNavbar";
import { clearAuth, loadAuth } from "@/lib/client-auth";
import { useStudentIssues, type StudentIssue } from "@/app/student/components/useStudentIssues";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  PlusCircle,
} from "lucide-react";

interface SummaryCardProps {
  label: string;
  value: number;
  icon: ComponentType<{ size?: number }>;
  accent: string;
  loading: boolean;
}

/* ================= PAGE ================= */

export default function StudentDashboard() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useMemo(() => loadAuth(), []);
  const { issues, loading, error } = useStudentIssues({
    cacheKey: "scit_dashboard_issues",
    cacheTtlMs: 2 * 60 * 1000,
    pollIntervalMs: 15 * 1000,
  });

  const userName = auth?.user.name || auth?.user.email || "Student";
  const userEmail = auth?.user.email || "student@example.com";
  const userInitials = getInitials(userName);
  const firstName = userName.split(" ")[0];
  const userRoleLabel = formatRoleLabel(auth?.user.role);

  const handleSignOut = () => {
    clearAuth();
    router.replace("/login");
  };

  const stats = useMemo(() => {
    const total = issues.length;
    const pending = issues.filter((i) => i.status === "Pending").length;
    const inProgress = issues.filter((i) => i.status === "In Progress").length;
    const resolved = issues.filter((i) => i.status === "Resolved").length;

    return [
      {
        label: "Total Issues",
        value: total,
        icon: ClipboardList,
        accent: "bg-slate-100 text-slate-700",
      },
      {
        label: "Pending",
        value: pending,
        icon: Clock3,
        accent: "bg-amber-100 text-amber-600",
      },
      {
        label: "In Progress",
        value: inProgress,
        icon: Loader2,
        accent: "bg-blue-100 text-blue-600",
      },
      {
        label: "Resolved",
        value: resolved,
        icon: CheckCircle2,
        accent: "bg-green-100 text-green-600",
      },
    ];
  }, [issues]);

  const recentIssues = [...issues]
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    )
    .slice(0, 4);

  return (
    <Protected allowedRoles={["student", "faculty"]}>
      <div className="min-h-screen flex bg-slate-50">
        <StudentSidebar
          pathname={pathname}
          userName={userName}
          initials={userInitials}
          roleLabel={userRoleLabel}
        />

        <div className="flex-1 flex flex-col">
          {/* ================= HEADER ================= */}
          <StudentNavbar
            firstName={firstName}
            userName={userName}
            userEmail={userEmail}
            userInitials={userInitials}
            onSignOut={handleSignOut}
          />

          {/* ================= MAIN ================= */}
          <main className="p-6 space-y-6">
            {error && <ErrorPanel message={error} />}

            {/* Stats */}
            <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {stats.map((s) => (
                <SummaryCard key={s.label} {...s} loading={loading} />
              ))} 
            </section>

            {/* Recent Issues */}
            <section className="rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Recent Issues
                  </h2>
                  <p className="text-sm text-slate-500">
                    Your latest reported issues
                  </p>
                </div>
                <Link
                  href="/student/my-issues"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  View All →
                </Link>
              </div>

              <div className="p-6">
                {loading ? (
                  <RecentIssueSkeleton />
                ) : recentIssues.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {recentIssues.map((issue) => (
                      <RecentIssueCard key={issue._id} issue={issue} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </Protected>
  );
}

/* ================= COMPONENTS ================= */

function SummaryCard({ label, value, icon: Icon, accent, loading }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
      {loading ? (
        <div className="h-8 w-16 bg-slate-200 rounded" />
      ) : (
        <>
          <div>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-3xl font-bold text-slate-900">{value}</p>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent}`}>
            <Icon size={18} />
          </div>
        </>
      )}
    </div>
  );
}

function RecentIssueCard({ issue }: { issue: StudentIssue }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
      <p className="text-xs text-slate-500">{formatDate(issue.createdAt)}</p>
      <h3 className="mt-1 font-semibold text-slate-900">{issue.title}</h3>
      <div className="mt-2">
        <StatusBadge status={issue.status} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <ClipboardList size={48} className="text-slate-300 mb-4" />
      <h3 className="text-lg font-semibold text-slate-900">
        No issues reported yet
      </h3>
      <p className="text-sm text-slate-500 mt-1">
        Start by reporting your first campus issue.
      </p>
      <Link
        href="/student/report"
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
      >
        <PlusCircle size={16} />
        Report Issue
      </Link>
    </div>
  );
}

function RecentIssueSkeleton() {
  return <div className="h-24 rounded bg-slate-100 animate-pulse" />;
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "Resolved"
      ? "bg-green-100 text-green-700"
      : status === "In Progress"
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";

  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>
      {status}
    </span>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
      {message}
    </div>
  );
}

/* ================= UTILS ================= */

function formatDate(dateString?: string) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(value: string) {
  return value
    .split(" ")
    .map((v) => v[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRoleLabel(role?: string) {
  if (!role) return "Student";
  return role.charAt(0).toUpperCase() + role.slice(1);
}
