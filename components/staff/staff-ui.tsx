import Link from "next/link";
import { AlertTriangle, ArrowRight, LoaderCircle } from "lucide-react";
import { SlaMeta, getSlaDisplay, getSlaHighlight, getSlaMeta } from "@/components/staff/issue-utils";
import { StaffIssue } from "@/components/staff/useStaffIssues";

type BadgeTone = "green" | "yellow" | "red" | "blue" | "slate" | "orange";

export function StatusBadge({ label, tone, title }: { label: string; tone: BadgeTone; title?: string }) {
  const toneClass: Record<BadgeTone, string> = {
    green: "bg-emerald-100 text-emerald-700",
    yellow: "bg-amber-100 text-amber-700",
    red: "bg-rose-100 text-rose-700",
    blue: "bg-blue-100 text-blue-700",
    slate: "bg-slate-100 text-slate-700",
    orange: "bg-orange-100 text-orange-700",
  };

  return (
    <span title={title} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass[tone]}`}>
      {label}
    </span>
  );
}

export function StaffStatusBadge({ status }: { status: StaffIssue["status"] }) {
  const tone = status === "Resolved" ? "green" : status === "Rejected" ? "red" : status === "In Progress" ? "blue" : "yellow";
  return <StatusBadge label={status} tone={tone} />;
}

export function StaffPriorityBadge({ priority }: { priority?: StaffIssue["priority"] | null }) {
  if (!priority) {
    return <StatusBadge label="No priority" tone="slate" />;
  }

  const tone = priority === "Urgent" ? "red" : priority === "High" ? "orange" : priority === "Medium" ? "yellow" : "slate";
  return <StatusBadge label={priority} tone={tone} />;
}

export function SlaPill({ meta }: { meta: SlaMeta }) {
  const display = getSlaDisplay(meta);
  const tone = display.tone === "red" ? "red" : display.tone === "yellow" ? "yellow" : "green";
  return <StatusBadge label={display.label} tone={tone} title={display.tooltip} />;
}

export function SlaProgressBar({ issue, showLabel = true }: { issue: StaffIssue; showLabel?: boolean }) {
  const meta = getSlaMeta(issue);
  const display = getSlaDisplay(meta);
  const barClass =
    meta.level === "risk" ? "bg-rose-500" : meta.level === "watch" ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div>
      {showLabel ? (
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>{display.timeMessage}</span>
          <span className="font-semibold">{meta.deadlineLabel}</span>
        </div>
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${meta.progressPercent}%` }} />
      </div>
    </div>
  );
}

export function TimeIndicator({
  issue,
  meta,
  showProgress = true,
  compact = false,
}: {
  issue: StaffIssue;
  meta?: SlaMeta;
  showProgress?: boolean;
  compact?: boolean;
}) {
  const resolvedMeta = meta || getSlaMeta(issue);
  const display = getSlaDisplay(resolvedMeta);
  const highlight = getSlaHighlight(issue, resolvedMeta);

  const toneClass =
    display.tone === "red"
      ? "border-rose-200 bg-rose-50/60 border-l-rose-500"
      : display.tone === "yellow"
        ? "border-amber-200 bg-amber-50/60 border-l-amber-500"
        : "border-emerald-200 bg-emerald-50/60 border-l-emerald-500";

  const highlightClass = highlight === "critical" ? "ring-1 ring-rose-300" : highlight === "warning" ? "ring-1 ring-amber-300" : "";

  return (
    <div
      className={`rounded-lg border border-l-4 ${toneClass} ${highlightClass} ${compact ? "p-2" : "p-3"}`}
      title={display.tooltip}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SlaPill meta={resolvedMeta} />
      </div>
      <p className={`mt-1 font-medium text-slate-700 ${compact ? "text-xs" : "text-sm"}`}>{display.timeMessage}</p>
      {showProgress ? <div className="mt-1.5"><SlaProgressBar issue={issue} showLabel={false} /></div> : null}
    </div>
  );
}

export function StaffEmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

export function StaffListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton-shimmer h-16 rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

type ActionButtonTone = "neutral" | "primary" | "success";

type ActionButtonProps = {
  label: string;
  tone?: ActionButtonTone;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  href?: string;
  prefetch?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
};

export function ActionButton({
  label,
  tone = "neutral",
  onClick,
  href,
  prefetch = false,
  icon,
  loading = false,
  disabled = false,
  title,
}: ActionButtonProps) {
  const className = `inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${getActionToneClass(tone)}`;
  const content = (
    <>
      {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : icon}
      <span>{loading ? "Updating..." : label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} prefetch={prefetch} className={className} title={title}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {content}
    </button>
  );
}

function getActionToneClass(tone: ActionButtonTone) {
  if (tone === "primary") {
    return "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100";
  }

  if (tone === "success") {
    return "bg-emerald-600 text-white hover:bg-emerald-700";
  }

  return "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
}
