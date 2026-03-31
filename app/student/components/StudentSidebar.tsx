"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ClipboardList, LayoutDashboard, ListChecks, Menu, PlusCircle, X } from "lucide-react";

export const studentNavItems = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Report Issue", href: "/student/report", icon: PlusCircle },
  { label: "All Issues", href: "/student/issues", icon: ListChecks },
  { label: "My Issues", href: "/student/my-issues", icon: ClipboardList },
] as const;

type StudentSidebarProps = {
  pathname: string;
  initials?: string;
  userName?: string;
  roleLabel?: string;
  footerSlot?: ReactNode;
};

export function StudentSidebar({
  pathname,
  initials = "ST",
  userName = "Student",
  roleLabel = "Student",
  footerSlot,
}: StudentSidebarProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    studentNavItems.forEach((item) => {
      router.prefetch(item.href);
    });
  }, [router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
        aria-label="Open student menu"
      >
        <Menu size={18} />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-emerald-900 text-white shadow-2xl">
            <div className="flex items-center justify-end border-b border-emerald-800 px-4 py-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10"
                aria-label="Close student menu"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              initials={initials}
              userName={userName}
              roleLabel={roleLabel}
              footerSlot={footerSlot}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-64 bg-emerald-900 text-white lg:flex flex-col sticky top-0 h-screen overflow-hidden">
        <SidebarContent
          pathname={pathname}
          initials={initials}
          userName={userName}
          roleLabel={roleLabel}
          footerSlot={footerSlot}
        />
      </aside>
    </>
  );
}

function SidebarContent({
  pathname,
  initials,
  userName,
  roleLabel,
  footerSlot,
  onNavigate,
}: StudentSidebarProps & { onNavigate?: () => void }) {
  return (
    <>
      <div className="px-6 py-6 border-b border-emerald-800">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl">
            <Image
              src="/images/logo1.png?v=2"
              alt="CampusTracker logo"
              width={54}
              height={54}
              className="h-full w-full object-contain "
              style={{ transform: "scale(1.7)" }}
              priority
              unoptimized
            />
          </div>
          <div>
            <p className="text-lg font-semibold">Student Hub</p>
            <p className="text-sm text-white/60">CampusTracker</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {studentNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
              pathname === item.href
                ? "bg-white text-emerald-900"
                : "text-white/80 hover:bg-white/10"
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}

        {/* <div className="mt-4 flex items-center gap-3 px-4 py-3 text-white/50">
          <ListChecks size={18} />
          Notifications (soon)
        </div> */}
      </nav>

      <div className="px-6 py-6 border-t border-emerald-800">
        {footerSlot ? (
          footerSlot
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-semibold">
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-white/60">{roleLabel}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
