"use client";

import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { authFetch, loadAuth } from "@/lib/client-auth";

type Props = {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

type NotificationItem = {
  _id: string;
  issueId: string;
  issueTitle: string;
  action: string;
  actorName: string;
  timestamp?: string;
};

export default function DeptAdminHeader({ title, subtitle, actions }: Props) {
  const auth = useMemo(() => loadAuth(), []);
  const name = auth?.user.name || "Dept Admin";
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!auth) return;

    let cancelled = false;
    const fetchNotifications = async () => {
      try {
        const res = await authFetch("/api/dept-admin/notifications", { method: "GET" }, auth.token);
        if (cancelled) return;
        const next: NotificationItem[] = Array.isArray(res.notifications) ? res.notifications : [];
        setNotifications(next);

        const seenAtRaw = window.localStorage.getItem("dept_admin_notif_seen_at");
        const seenAt = seenAtRaw ? new Date(seenAtRaw).getTime() : 0;
        const nextUnread = next.filter((item) => {
          if (!item.timestamp) return true;
          return new Date(item.timestamp).getTime() > seenAt;
        }).length;
        setUnread(nextUnread);
      } catch {
        if (!cancelled) {
          setNotifications([]);
          setUnread(0);
        }
      }
    };

    void fetchNotifications();
    const timer = window.setInterval(() => {
      void fetchNotifications();
    }, 45000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [auth]);

  const initial = useMemo(() => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [name]);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
      <div>
        {title ? <h1 className="text-2xl font-bold text-slate-900">{title}</h1> : null}
        {subtitle ? <p className="mt-1 text-slate-500">{subtitle}</p> : null}
      </div>

      <div className="relative flex items-center gap-3">
        {actions ? <div>{actions}</div> : null}
        <button
          type="button"
          onClick={() => {
            const nextOpen = !open;
            setOpen(nextOpen);
            if (nextOpen) {
              const now = new Date().toISOString();
              window.localStorage.setItem("dept_admin_notif_seen_at", now);
              setUnread(0);
            }
          }}
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -mt-5 ml-5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
        {open ? (
          <div className="absolute right-16 top-16 z-30 w-96 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Notifications</p>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-700">
                Close
              </button>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">No recent updates.</p>
              ) : (
                notifications.map((item) => (
                  <Link
                    key={item._id}
                    href={`/dept-admin/issues/${item.issueId}`}
                    className="block rounded-lg border border-slate-100 bg-slate-50 p-3 hover:bg-emerald-50"
                  >
                    <p className="line-clamp-1 text-sm font-semibold text-slate-800">{item.issueTitle}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.action} by {item.actorName}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : "Just now"}
                    </p>
                    <span className="mt-1 inline-flex items-center text-[11px] font-semibold text-emerald-700">
                      Open issue <ChevronRight className="ml-1 h-3 w-3" />
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        ) : null}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700"
          title={name}
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
