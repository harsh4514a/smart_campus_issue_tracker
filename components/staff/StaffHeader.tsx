"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, User } from "lucide-react";
import { clearAuth, loadAuth } from "@/lib/client-auth";

type StaffHeaderProps = {
  title?: string;
  subtitle?: string;
};

export default function StaffHeader({ title, subtitle }: StaffHeaderProps) {
  const router = useRouter();
  const auth = loadAuth();
  const name = auth?.user?.name || "Staff User";
  const email = auth?.user?.email || "staff@campustrack.local";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const initial = useMemo(() => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ST";
  }, [name]);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
      <div>
        {title ? <h1 className="text-2xl font-bold text-slate-900">{title}</h1> : null}
        {subtitle ? <p className="mt-1 text-slate-500">{subtitle}</p> : null}
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/staff/notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </Link>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Open profile menu"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            title={name}
          >
            {initial}
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-50 mt-3 w-64 rounded-2xl border border-slate-100 bg-white shadow-xl ring-1 ring-slate-900/5">
              <div className="border-b border-slate-100 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-slate-500 truncate">{email}</p>
              </div>

              <Link
                href="/staff/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  clearAuth();
                  router.replace("/login");
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
