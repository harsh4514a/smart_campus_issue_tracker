"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  ListChecks,
  MapPin,
  Search,
  SlidersHorizontal,
  Square,
  X,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { authFetch, loadAuth } from "@/lib/client-auth";
import { formatDate, getSlaDisplay, getSlaHighlight, getSlaMeta, type SlaMeta } from "@/components/staff/issue-utils";
import {
  ActionButton,
  StaffEmptyState,
  StaffListSkeleton,
  StaffPriorityBadge,
  StaffStatusBadge,
  TimeIndicator,
} from "@/components/staff/staff-ui";
import {
  type StaffIssue,
  type StaffIssueQuery,
  type StaffIssueSortBy,
  useStaffIssues,
} from "@/components/staff/useStaffIssues";

type StaffStatusFilter = "All" | "Pending" | "In Progress" | "Resolved";
type PriorityFilter = "All" | "Low" | "Medium" | "High" | "Urgent" | "No Priority";

type FilterTag = {
  key: "status" | "priority" | "search";
  label: string;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const INITIAL_VISIBLE_ROWS = 20;
const ROW_BATCH_SIZE = 15;

export default function StaffIssuesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <StaffIssuesPageContent />
    </Suspense>
  );
}

function StaffIssuesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [statusFilter, setStatusFilter] = useState<StaffStatusFilter>("All");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All");
  const [sortBy, setSortBy] = useState<StaffIssueSortBy>("sla_deadline");

  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [visibleRows, setVisibleRows] = useState(INITIAL_VISIBLE_ROWS);
  const lazyLoadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const next = searchInput.trim();
      setSearchQuery(next);
      setCurrentPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    const statusQuery = searchParams.get("status");
    if (!statusQuery) return;

    const normalized = decodeURIComponent(statusQuery).trim().toLowerCase();
    if (normalized === "pending") {
      setStatusFilter("Pending");
      setCurrentPage(1);
      return;
    }

    if (normalized === "in progress") {
      setStatusFilter("In Progress");
      setCurrentPage(1);
      return;
    }

    if (normalized === "resolved") {
      setStatusFilter("Resolved");
      setCurrentPage(1);
    }
  }, [searchParams]);

  const query = useMemo<StaffIssueQuery>(
    () => ({
      page: currentPage,
      limit: pageSize,
      search: searchQuery || undefined,
      status: statusFilter,
      priority: priorityFilter,
      sortBy,
    }),
    [currentPage, pageSize, priorityFilter, searchQuery, sortBy, statusFilter]
  );

  const { issues, meta, loading, error, setError, reload } = useStaffIssues({
    cacheKey: "scit_staff_issues_paginated",
    cacheTtlMs: 45 * 1000,
    pollIntervalMs: 15 * 1000,
    query,
  });

  useEffect(() => {
    if (meta.currentPage && meta.currentPage !== currentPage) {
      setCurrentPage(meta.currentPage);
    }
  }, [currentPage, meta.currentPage]);

  useEffect(() => {
    const visibleIds = new Set(issues.map((issue) => issue._id));
    setSelectedIssueIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [issues]);

  useEffect(() => {
    setVisibleRows(Math.min(INITIAL_VISIBLE_ROWS, issues.length));
  }, [issues]);

  useEffect(() => {
    const node = lazyLoadRef.current;
    if (!node) return;
    if (visibleRows >= issues.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisibleRows((prev) => Math.min(prev + ROW_BATCH_SIZE, issues.length));
      },
      { rootMargin: "180px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [issues.length, visibleRows]);

  const renderedIssues = useMemo(
    () => (issues.length > INITIAL_VISIBLE_ROWS ? issues.slice(0, visibleRows) : issues),
    [issues, visibleRows]
  );

  const summary = useMemo(() => {
    const open = issues.filter((issue) => issue.status === "Pending" || issue.status === "In Progress").length;
    const resolved = issues.filter((issue) => issue.status === "Resolved").length;
    const slaRisk = issues.filter((issue) => {
      const metaForIssue = getSlaMeta(issue);
      const display = getSlaDisplay(metaForIssue);
      return display.state === "due_soon" || display.state === "overdue";
    }).length;

    return {
      total: meta.totalItems,
      open,
      resolved,
      slaRisk,
    };
  }, [issues, meta.totalItems]);

  const attentionIssues = useMemo(() => {
    return [...issues]
      .filter((issue) => issue.status !== "Resolved" && issue.status !== "Rejected")
      .map((issue) => ({
        issue,
        score: getAttentionScore(issue),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.issue);
  }, [issues]);

  const attentionCount = attentionIssues.length;
  const recommendedIssue = attentionIssues[0] || null;
  const recommendedSla = recommendedIssue ? getSlaMeta(recommendedIssue) : null;
  const recommendedDisplay = recommendedSla ? getSlaDisplay(recommendedSla) : null;

  const hasActiveFilters =
    searchQuery.length > 0 || statusFilter !== "All" || priorityFilter !== "All" || sortBy !== "sla_deadline";

  const activeFilterTags = useMemo<FilterTag[]>(() => {
    const tags: FilterTag[] = [];

    if (statusFilter !== "All") {
      tags.push({ key: "status", label: `Status: ${statusFilter}` });
    }

    if (priorityFilter !== "All") {
      tags.push({ key: "priority", label: `Priority: ${priorityFilter}` });
    }

    if (searchQuery) {
      tags.push({ key: "search", label: `Search: ${searchQuery}` });
    }

    return tags;
  }, [priorityFilter, searchQuery, statusFilter]);

  const allVisibleSelected = issues.length > 0 && selectedIssueIds.length === issues.length;

  const totalItems = meta.totalItems;
  const totalPages = Math.max(1, meta.totalPages);
  const activePage = meta.currentPage || currentPage;
  const showingStart = totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const showingEnd = totalItems === 0 ? 0 : Math.min(activePage * pageSize, totalItems);
  const paginationItems = useMemo(() => getPaginationItems(activePage, totalPages), [activePage, totalPages]);

  const handlePageChange = (page: number) => {
    const safePage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(safePage);
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStatusFilter("All");
    setPriorityFilter("All");
    setSortBy("sla_deadline");
    setCurrentPage(1);
    setSelectedIssueIds([]);
  };

  const clearFilterTag = (tag: FilterTag["key"]) => {
    if (tag === "status") {
      setStatusFilter("All");
    }

    if (tag === "priority") {
      setPriorityFilter("All");
    }

    if (tag === "search") {
      setSearchInput("");
      setSearchQuery("");
    }

    setCurrentPage(1);
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIssueIds([]);
      return;
    }

    setSelectedIssueIds(issues.map((issue) => issue._id));
  };

  const toggleSingleSelect = (issueId: string) => {
    setSelectedIssueIds((prev) => {
      if (prev.includes(issueId)) return prev.filter((id) => id !== issueId);
      return [...prev, issueId];
    });
  };

  const patchIssueStatus = async (issueId: string, status: StaffIssue["status"]) => {
    const auth = loadAuth();
    if (!auth) return;

    await authFetch(
      `/api/issues/${issueId}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      auth.token
    );
  };

  const handleQuickUpdate = async (issue: StaffIssue, targetStatus: StaffIssue["status"], successMessage: string) => {
    setUpdatingId(issue._id);
    try {
      await patchIssueStatus(issue._id, targetStatus);
      await reload(true);
      showToast({ title: "Success", message: successMessage, variant: "success" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      setError(message);
      showToast({ title: "Update failed", message, variant: "error" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBulkUpdate = async (targetStatus: StaffIssue["status"]) => {
    if (selectedIssueIds.length === 0) return;

    const mutableIssueIds = issues
      .filter((issue) => selectedIssueIds.includes(issue._id) && issue.status !== "Resolved" && issue.status !== "Rejected")
      .map((issue) => issue._id);

    if (mutableIssueIds.length === 0) {
      showToast({
        title: "No updatable issues",
        message: "Selected issues are already closed.",
        variant: "error",
      });
      return;
    }

    setBulkUpdating(true);

    try {
      const results = await Promise.allSettled(mutableIssueIds.map((issueId) => patchIssueStatus(issueId, targetStatus)));

      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - successCount;

      await reload(true);
      setSelectedIssueIds([]);

      if (failedCount === 0) {
        showToast({
          title: "Bulk action completed",
          message: `${successCount} issue${successCount === 1 ? "" : "s"} updated to ${targetStatus}.`,
          variant: "success",
        });
      } else {
        showToast({
          title: "Bulk action partially completed",
          message: `${successCount} updated, ${failedCount} failed.`,
          variant: "error",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bulk update failed";
      setError(message);
      showToast({ title: "Bulk update failed", message, variant: "error" });
    } finally {
      setBulkUpdating(false);
    }
  };

  const openIssueDetails = (issueId: string) => {
    router.push(`/staff/issues/${issueId}`);
  };

  const onRowClick = (event: React.MouseEvent<HTMLTableRowElement>, issueId: string) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, label")) return;
    openIssueDetails(issueId);
  };

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, issueId: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openIssueDetails(issueId);
  };

  const noResults = !loading && !error && totalItems === 0;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-base font-semibold text-amber-900">⚠️ {attentionCount} issues need attention</p>
            {recommendedIssue && recommendedDisplay ? (
              <p className="mt-1 text-sm text-amber-800">
                👉 Recommended: Start work on {recommendedIssue.title} ({toReadableAlertLabel(recommendedIssue, recommendedDisplay.state)})
              </p>
            ) : (
              <p className="mt-1 text-sm text-amber-800">Great work. No urgent issue needs immediate action right now.</p>
            )}
          </div>

          {recommendedIssue && recommendedIssue.status === "Pending" ? (
            <ActionButton
              label="Start Work"
              tone="primary"
              loading={updatingId === recommendedIssue._id}
              onClick={() =>
                handleQuickUpdate(recommendedIssue, "In Progress", `Started work on "${recommendedIssue.title}".`)
              }
            />
          ) : recommendedIssue ? (
            <ActionButton label="View Issue" tone="neutral" href={`/staff/issues/${recommendedIssue._id}`} icon={<Eye className="h-3.5 w-3.5" />} />
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryPill label="Total" value={summary.total} tone="slate" />
          <SummaryPill label="Open" value={summary.open} tone="blue" />
          <SummaryPill label="Resolved" value={summary.resolved} tone="green" />
          <SummaryPill label="Due Soon / Overdue" value={summary.slaRisk} tone="amber" />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative block xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search issues by title, category, or location"
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StaffStatusFilter);
              setCurrentPage(1);
            }}
            className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => {
              setPriorityFilter(event.target.value as PriorityFilter);
              setCurrentPage(1);
            }}
            className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="All">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
            <option value="No Priority">No Priority</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as StaffIssueSortBy);
              setCurrentPage(1);
            }}
            className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="sla_deadline">Sort: Due Time</option>
            <option value="priority_desc">Sort: Priority</option>
            <option value="created_desc">Sort: Newest</option>
            <option value="created_asc">Sort: Oldest</option>
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
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear All Filters
            </button>
          ) : null}
        </div>

        {activeFilterTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {activeFilterTags.map((tag) => (
              <span
                key={tag.key}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {tag.label}
                <button
                  type="button"
                  onClick={() => clearFilterTag(tag.key)}
                  className="rounded-full p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={`Remove ${tag.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {loading && issues.length === 0 ? <StaffListSkeleton rows={8} /> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {selectedIssueIds.length > 0 ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-emerald-800">
              {selectedIssueIds.length} issue{selectedIssueIds.length === 1 ? "" : "s"} selected
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                label="Bulk Start Work"
                tone="primary"
                loading={bulkUpdating}
                onClick={() => handleBulkUpdate("In Progress")}
              />
              <ActionButton
                label="Bulk Resolve"
                tone="success"
                loading={bulkUpdating}
                onClick={() => handleBulkUpdate("Resolved")}
              />
            </div>
          </div>
        </section>
      ) : null}

      {noResults ? (
        <StaffEmptyState
          title={hasActiveFilters ? "No matching issues" : "🎉 No issues assigned"}
          description={
            hasActiveFilters
              ? "Try adjusting your filters or search query to find assigned work."
              : "You are all caught up. Newly assigned issues will appear here automatically."
          }
          actionHref={hasActiveFilters ? "/staff/issues" : undefined}
          actionLabel={hasActiveFilters ? "Reset filters" : undefined}
        />
      ) : null}

      {!error && issues.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">Assigned Issues Queue</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Showing {showingStart}-{showingEnd} of {totalItems} issues</span>
              {loading ? <span className="rounded-full bg-slate-200 px-2 py-0.5">Refreshing...</span> : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-245 w-full">
              <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur">
                <tr>
                  <Th className="w-12">
                    <button
                      type="button"
                      onClick={toggleSelectAllVisible}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                      aria-label={allVisibleSelected ? "Deselect all" : "Select all"}
                    >
                      {allVisibleSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                  </Th>
                  <Th>Issue</Th>
                  <Th>Priority</Th>
                  <Th>Time</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>

              <tbody>
                {renderedIssues.map((issue) => {
                  const slaMeta = getSlaMeta(issue);
                  const slaDisplay = getSlaDisplay(slaMeta);
                  const highlight = getSlaHighlight(issue, slaMeta);
                  const isSelected = selectedIssueIds.includes(issue._id);
                  const updating = updatingId === issue._id;

                  return (
                    <tr
                      key={issue._id}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => onRowClick(event, issue._id)}
                      onKeyDown={(event) => onRowKeyDown(event, issue._id)}
                      className={`cursor-pointer border-t border-slate-100 align-top transition ${getRowBackgroundClass(highlight, issue, slaDisplay.state)} ${
                        isSelected ? "bg-teal-50/50" : ""
                      }`}
                    >
                      <Td className={`border-l-4 ${getRowIndicatorClass(highlight, issue, slaDisplay.state)}`}>
                        <button
                          type="button"
                          onClick={() => toggleSingleSelect(issue._id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          aria-label={isSelected ? "Deselect issue" : "Select issue"}
                        >
                          {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </button>
                      </Td>

                      <Td className="min-w-65">
                        <p className="font-semibold text-slate-900">{issue.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{issue.description || issue.location || "No additional details"}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {issue.location || "-"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{issue.category}</span>
                        </div>
                      </Td>

                      <Td>
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                            <Zap className="h-3.5 w-3.5" />
                            Priority
                          </span>
                          <StaffPriorityBadge priority={issue.priority} />
                        </div>
                      </Td>

                      <Td>
                        <div className="min-w-52">
                          <div className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                            <Clock3 className="h-3.5 w-3.5" />
                            Time Status
                          </div>
                          <TimeIndicator issue={issue} meta={slaMeta} compact />
                        </div>
                      </Td>

                      <Td>
                        <StaffStatusBadge status={issue.status} />
                      </Td>

                      <Td>
                        <div className="inline-flex items-center gap-1 text-sm text-slate-600">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(issue.createdAt)}
                        </div>
                      </Td>

                      <Td>
                        <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
                          {issue.status === "Pending" ? (
                            <ActionButton
                              label="Start Work"
                              tone="primary"
                              loading={updating}
                              onClick={() => handleQuickUpdate(issue, "In Progress", "Issue moved to In Progress.")}
                            />
                          ) : null}

                          {issue.status === "In Progress" ? (
                            <>
                              <ActionButton
                                label="Update"
                                tone="neutral"
                                href={`/staff/issues/${issue._id}`}
                                icon={<Eye className="h-3.5 w-3.5" />}
                              />
                              <ActionButton
                                label="Resolve"
                                tone="success"
                                loading={updating}
                                onClick={() => handleQuickUpdate(issue, "Resolved", "Issue marked as resolved.")}
                              />
                            </>
                          ) : null}

                          {(issue.status === "Resolved" || issue.status === "Rejected") ? (
                            <ActionButton
                              label="View"
                              tone="neutral"
                              href={`/staff/issues/${issue._id}`}
                              icon={<Eye className="h-3.5 w-3.5" />}
                            />
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {issues.length > renderedIssues.length ? (
            <div ref={lazyLoadRef} className="border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-center text-xs text-slate-500">
              Loading more rows...
            </div>
          ) : null}

          <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-600">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="h-4 w-4" />
                  Showing {showingStart}-{showingEnd} of {totalItems} issues
                </span>

                {summary.slaRisk > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    {summary.slaRisk} due soon or overdue on this page
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    On time
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                  Page size
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                      setCurrentPage(1);
                    }}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => handlePageChange(activePage - 1)}
                  disabled={activePage <= 1 || loading}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </button>

                {paginationItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="px-1 text-xs text-slate-400">
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handlePageChange(item)}
                      disabled={loading}
                      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold ${
                        item === activePage
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => handlePageChange(activePage + 1)}
                  disabled={activePage >= totalPages || loading}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "blue" | "green" | "amber";
}) {
  const toneClass: Record<string, string> = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-semibold leading-none">{value}</p>
    </div>
  );
}

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-sm font-semibold text-slate-600 ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-4 text-sm text-slate-500 ${className}`}>{children}</td>;
}

function getAttentionScore(issue: StaffIssue) {
  const slaMeta = getSlaMeta(issue);
  const slaDisplay = getSlaDisplay(slaMeta);

  let score = 0;

  if (slaDisplay.state === "overdue") score += 4;
  if (slaDisplay.state === "due_soon") score += 2;

  if (issue.priority === "Urgent") score += 4;
  if (issue.priority === "High") score += 3;
  if (issue.priority === "Medium") score += 1;

  if (issue.status === "Pending") score += 1;

  return score;
}

function toReadableAlertLabel(issue: StaffIssue, state: "on_time" | "due_soon" | "overdue") {
  const urgency = state === "overdue" ? "Overdue" : state === "due_soon" ? "Due Soon" : "On Time";
  const priority = issue.priority || "No Priority";
  return `${urgency} + ${priority}`;
}

function getRowIndicatorClass(
  highlight: ReturnType<typeof getSlaHighlight>,
  issue: StaffIssue,
  state: "on_time" | "due_soon" | "overdue"
) {
  if (highlight === "critical") return "border-l-rose-500";
  if (highlight === "warning") return "border-l-amber-400";
  if (state === "on_time" && issue.priority === "Medium") return "border-l-slate-200";
  if (state === "due_soon") return "border-l-amber-300";
  return "border-l-emerald-200";
}

function getRowBackgroundClass(
  highlight: ReturnType<typeof getSlaHighlight>,
  issue: StaffIssue,
  state: "on_time" | "due_soon" | "overdue"
) {
  if (highlight === "critical") {
    return "bg-rose-50/30 hover:bg-rose-50/50 focus-within:bg-rose-50/60";
  }

  if (highlight === "warning") {
    return "bg-amber-50/20 hover:bg-amber-50/40 focus-within:bg-amber-50/50";
  }

  if (state === "on_time" && issue.priority === "Medium") {
    return "bg-slate-50/30 hover:bg-slate-50/70 focus-within:bg-slate-50/80";
  }

  return "bg-white hover:bg-slate-50/70 focus-within:bg-slate-50/80";
}

function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages] as const;
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages] as const;
}
