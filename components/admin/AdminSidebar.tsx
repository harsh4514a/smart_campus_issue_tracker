"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authFetch, clearAuth, loadAuth } from "@/lib/client-auth";
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  Users2,
  GraduationCap,
  BarChart3,
  LogOut,
} from "lucide-react";

type NavItem = {
  href?: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; size?: number }>;
  match?: "exact" | "prefix";
};

const navItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard, match: "exact" },
  { href: "/admin/issues", label: "Issues Triage", Icon: ClipboardList, match: "prefix" },
  { href: "/admin/departments", label: "Departments", Icon: Building2, match: "prefix" },
  { href: "/admin/staff", label: "Staff", Icon: Users2, match: "prefix" },
  { href: "/admin/students", label: "Students", Icon: GraduationCap, match: "prefix" },
  { href: "/admin/reports", label: "Reports", Icon: BarChart3, match: "prefix" },
];

function isActive(pathname: string, item: NavItem) {
  if (!item.href) return false;
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const auth = useSyncExternalStore(
    () => () => {},
    () => {
      const currentAuth = loadAuth();
      if (!currentAuth) return "";
      const name = currentAuth.user?.name || "";
      const token = currentAuth.token || "";
      return `${name}|||${token}`;
    },
    () => null
  );

  const [authName, authToken] = typeof auth === "string" ? auth.split("|||") : ["", ""];
  const fallbackName = authName?.trim() || "Admin";
  const [profileName, setProfileName] = useState<string | null>(null);
  const name = profileName || fallbackName;

  useEffect(() => {
    if (!authToken) return;

    authFetch("/api/users/me", { method: "GET" }, authToken)
      .then((res) => {
        const dbName = res?.user?.name;
        if (typeof dbName === "string" && dbName.trim().length > 0) {
          setProfileName(dbName.trim());
        }
      })
      .catch(() => {
        // keep sidebar name from local auth as fallback
      });
  }, [authToken]);

  const initials = useMemo(() => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [name]);

  return (
    <aside className="hidden w-64 bg-emerald-900 text-white lg:flex flex-col sticky top-0 h-screen overflow-hidden">
      <div className="px-6 py-6 border-b border-emerald-800">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl">
            <Image
              src="/images/logo1.png?v=2"
              alt="CampusTrack logo"
              width={54}
              height={54}
              className="h-full w-full object-contain"
              style={{ transform: "scale(1.7)" }}
              priority
              unoptimized
            />
          </div>
          <div>
            <p className="text-lg font-semibold">CampusTrack</p>
            <p className="text-sm text-white/60">Smart Campus Issue Tracker</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map(({ href, label, Icon, match }) => {
          const active = isActive(pathname, { href, label, Icon, match });
          const base = "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition";
          const cls = active
            ? `${base} bg-white text-emerald-900`
            : `${base} text-white/85 hover:bg-white/10 hover:text-white`;

          const content = (
            <>
              <Icon size={18} className={active ? "text-emerald-900" : "text-white/80"} />
              <span className="truncate">{label}</span>
            </>
          );

          if (!href) {
            return (
              <div key={label} className={`${base} text-white/80`}>
                {content}
              </div>
            );
          }

          return (
            <Link key={href} href={href} className={cls}>
              {content}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-6 border-t border-emerald-800">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem("isAdmin");
            }
            clearAuth();
            router.replace("/admin/login");
          }}
          className="mb-4 w-full cursor-pointer rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition flex items-center justify-center gap-2"
        >
          <LogOut size={16} />
          Logout
        </button>

        <div className="mb-4 -mx-6 h-px bg-white/15" />

        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-xs text-white/60">Admin</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
