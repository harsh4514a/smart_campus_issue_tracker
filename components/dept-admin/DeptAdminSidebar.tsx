"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ClipboardList, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";
import { clearAuth, loadAuth } from "@/lib/client-auth";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
};

const navItems: NavItem[] = [
  { href: "/dept-admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/dept-admin/issues", label: "Issue Management", Icon: ClipboardList },
  { href: "/dept-admin/workers", label: "Workers", Icon: Users },
  { href: "/dept-admin/reports", label: "Reports", Icon: BarChart3 },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DeptAdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const auth = loadAuth();
  const name = auth?.user?.name || "Department Admin";

  const initials = useMemo(() => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [name]);

  const logout = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("isAdmin");
    }
    clearAuth();
    router.replace("/admin/login");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
        aria-label="Open dept admin menu"
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
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarBody
              pathname={pathname}
              initials={initials}
              name={name}
              onNavigate={() => setMobileOpen(false)}
              onLogout={logout}
            />
          </aside>
        </div>
      ) : null}

      <aside className="hidden h-screen w-64 flex-col bg-emerald-900 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex">
        <SidebarBody pathname={pathname} initials={initials} name={name} onLogout={logout} />
      </aside>
    </>
  );
}

function SidebarBody({
  pathname,
  initials,
  name,
  onNavigate,
  onLogout,
}: {
  pathname: string;
  initials: string;
  name: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <div className="border-b border-emerald-800 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl">
            <Image
              src="/images/logo1.png?v=2"
              alt="CampusTracker logo"
              width={54}
              height={54}
              className="h-full w-full object-contain"
              style={{ transform: "scale(1.7)" }}
              priority
              unoptimized
            />
          </div>
          <div>
            <p className="text-lg font-semibold">Dept Admin</p>
            <p className="text-sm text-white/60">CampusTracker</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                active ? "bg-teal-400 text-emerald-950" : "text-white/85 hover:bg-white/10"
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-emerald-800 px-4 py-4">
        <button
          type="button"
          onClick={onLogout}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          <LogOut size={16} />
          Logout
        </button>

        <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="text-xs text-white/60">Department Admin</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}