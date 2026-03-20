"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Bell, ClipboardList, LayoutDashboard } from "lucide-react";
import { loadAuth } from "@/lib/client-auth";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; size?: number }>;
};

const navItems: NavItem[] = [
  { href: "/staff/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/staff/issues", label: "Assigned Issues", Icon: ClipboardList },
  { href: "/staff/notifications", label: "Notifications", Icon: Bell },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function StaffSidebar() {
  const pathname = usePathname();
  const auth = loadAuth();
  const name = auth?.user?.name || "Staff User";

  const initials = useMemo(() => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [name]);

  return (
    <aside className="hidden h-screen w-64 flex-col bg-emerald-900 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex">
      <div className="border-b border-emerald-800 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700/60">
            <Image
              src="/images/logo1.png?v=2"
              alt="CampusTrack logo"
              width={26}
              height={26}
              className="h-6 w-6 object-contain"
              priority
              unoptimized
            />
          </div>
          <p className="text-lg font-semibold">CampusTrack</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-3">
        {navItems.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
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
        <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="text-xs text-white/60">Staff</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
