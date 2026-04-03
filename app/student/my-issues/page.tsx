"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { StudentSidebar } from "@/app/student/components/StudentSidebar";
import { StudentNavbar } from "@/app/student/components/StudentNavbar";
import { authFetch, clearAuth, loadAuth } from "@/lib/client-auth";
import { useStudentIssues, type StudentIssue } from "@/app/student/components/useStudentIssues";
import {
  AlertCircle,
  Calendar,
  MapPin,
  Pencil,
  PlusCircle,
  Tag,
  Search,
  Star,
  Trash2,
} from "lucide-react";

const statusFilters = ["All", "Pending", "In Progress", "Resolved"] as const;
type StatusFilter = (typeof statusFilters)[number];

type Issue = StudentIssue;

type FeedbackRecord = {
  rating: number;
  comment?: string | null;
};

export default function StudentIssuesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useMemo(() => loadAuth(), []);
  const { issues, loading, error, setError, reload } = useStudentIssues({
    cacheKey: "scit_issues_cache",
    cacheTtlMs: 2 * 60 * 1000,
    pollIntervalMs: 15 * 1000,
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userName] = useState(() => auth?.user.name?.trim() || auth?.user.email || "there");
  const [userInitials] = useState(() => getInitials(auth?.user.name || auth?.user.email || "there"));
  const userEmail = auth?.user.email || "student@example.com";
  const userRoleLabel = formatRoleLabel(auth?.user.role);
  const firstName = userName.split(" ")[0] || "Student";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [search, setSearch] = useState("");
  const [feedbackIssue, setFeedbackIssue] = useState<Issue | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackByIssueId, setFeedbackByIssueId] = useState<Record<string, FeedbackRecord | null>>({});

  useEffect(() => {
    if (!auth) return;

    const resolvedIssueIds = issues
      .filter((issue) => issue.status === "Resolved")
      .map((issue) => issue._id);

    const unresolvedFeedbackIds = resolvedIssueIds.filter((issueId) => feedbackByIssueId[issueId] === undefined);
    if (unresolvedFeedbackIds.length === 0) return;

    let cancelled = false;

    void Promise.all(
      unresolvedFeedbackIds.map(async (issueId) => {
        try {
          const data = await authFetch(`/api/issues/${issueId}/feedback`, { method: "GET" }, auth.token);
          const feedback = data.feedback as FeedbackRecord | null;
          return { issueId, feedback: feedback || null };
        } catch {
          return { issueId, feedback: null };
        }
      })
    ).then((results) => {
      if (cancelled) return;

      setFeedbackByIssueId((prev) => {
        const next = { ...prev };
        for (const result of results) {
          next[result.issueId] = result.feedback;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [auth, issues, feedbackByIssueId]);

  const filteredIssues = useMemo(() => {
    const term = search.trim().toLowerCase();
    return issues.filter((issue) => {
      const matchesStatus = statusFilter === "All" ? true : issue.status === statusFilter;
      const matchesSearch =
        !term ||
        String(issue.title || "").toLowerCase().includes(term) ||
        String(issue.category || "").toLowerCase().includes(term) ||
        String(issue.location || "").toLowerCase().includes(term);
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
      await reload(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete issue");
    } finally {
      setDeletingId(null);
    }
  };

  const openFeedbackModal = async (issue: Issue) => {
    if (!auth) return;

    setFeedbackIssue(issue);
    setFeedbackError(null);
    setFeedbackRating(5);
    setFeedbackComment("");

    try {
      const data = await authFetch(`/api/issues/${issue._id}/feedback`, { method: "GET" }, auth.token);
      const existing = data.feedback as FeedbackRecord | null;
      if (existing) {
        setFeedbackRating(existing.rating || 5);
        setFeedbackComment(existing.comment || "");
        setFeedbackByIssueId((prev) => ({ ...prev, [issue._id]: existing }));
      } else {
        setFeedbackByIssueId((prev) => ({ ...prev, [issue._id]: null }));
      }
    } catch {
      // keep modal editable even if existing feedback fetch fails
    }
  };

  const submitFeedback = async () => {
    if (!auth || !feedbackIssue) return;

    setFeedbackSubmitting(true);
    setFeedbackError(null);

    try {
      const currentIssueId = feedbackIssue._id;
      const data = await authFetch(
        `/api/issues/${feedbackIssue._id}/feedback`,
        {
          method: "POST",
          body: JSON.stringify({ rating: feedbackRating, comment: feedbackComment }),
        },
        auth.token
      );
      const savedFeedback = data.feedback as FeedbackRecord | null;
      setFeedbackByIssueId((prev) => ({
        ...prev,
        [currentIssueId]:
          savedFeedback || {
            rating: feedbackRating,
            comment: feedbackComment,
          },
      }));
      setFeedbackIssue(null);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setFeedbackSubmitting(false);
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
                    feedback={feedbackByIssueId[issue._id] ?? null}
                    deleting={deletingId === issue._id}
                    onDelete={() => handleDelete(issue._id)}
                    onRateResolution={() => openFeedbackModal(issue)}
                  />
                ))
              )}
            </section>

            {feedbackIssue ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
                <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
                  <h3 className="text-lg font-semibold text-slate-900">Rate Resolution</h3>
                  <p className="mt-1 text-sm text-slate-500">{feedbackIssue.title}</p>

                  <div className="mt-4 flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className={`rounded-full p-1.5 ${feedbackRating >= star ? "text-amber-500" : "text-slate-300"}`}
                        aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                      >
                        <Star size={22} fill={feedbackRating >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>

                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Comment (optional)
                    <textarea
                      value={feedbackComment}
                      onChange={(event) => setFeedbackComment(event.target.value)}
                      rows={4}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500"
                      placeholder="How satisfied are you with the resolution?"
                    />
                  </label>

                  {feedbackError ? <p className="mt-3 text-sm text-rose-600">{feedbackError}</p> : null}

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setFeedbackIssue(null)}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitFeedback}
                      disabled={feedbackSubmitting}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {feedbackSubmitting ? "Submitting..." : "Submit Feedback"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </Protected>
  );
}

function IssueCard({
  issue,
  feedback,
  deleting,
  onDelete,
  onRateResolution,
}: {
  issue: Issue;
  feedback: FeedbackRecord | null;
  deleting: boolean;
  onDelete: () => void;
  onRateResolution: () => void;
}) {
  const rating = normalizeRating(feedback?.rating);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-900">{issue.title}</h3>
            <StatusBadge status={issue.status} />
            {isOverdue(issue.dueDate, issue.status) ? <OverdueBadge /> : null}
          </div>
          {issue.description && <p className="text-sm text-slate-500">{issue.description}</p>}
        </div>

        {issue.imageUrl && (
          <div className="h-20 w-28 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
            <Image
              src={issue.imageUrl}
              alt={issue.title || "Issue image"}
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
          {issue.status === "Resolved" ? (
            <button
              type="button"
              onClick={onRateResolution}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            >
              {rating > 0 ? <InlineRatingStars rating={rating} /> : <Star size={14} />}
              {rating > 0 ? `Rated ${rating}/5` : "Rate"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={14} />
          {issue.location}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={14} />
          {issue.createdAt ? formatDate(issue.createdAt) : "-"}
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

function isOverdue(dueDate?: string, status?: string) {
  if (!dueDate) return false;
  if (status === "Resolved") return false;

  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return false;

  return Date.now() > due;
}

function OverdueBadge() {
  return (
    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
      Overdue
    </span>
  );
}

function InlineRatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={12}
          className={value <= rating ? "text-amber-500" : "text-slate-300"}
          fill={value <= rating ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

function normalizeRating(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 5) return 0;
  return rounded;
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
