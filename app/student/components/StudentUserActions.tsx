"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, User } from "lucide-react";

interface StudentUserActionsProps {
  name: string;
  email: string;
  initials: string;
  onSignOut: () => void;
  className?: string;
}

export function StudentUserActions({ name, email, initials, onSignOut, className = "" }: StudentUserActionsProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <button
        type="button"
        aria-label="Notifications"
        className="h-10 w-10 cursor-pointer rounded-full border border-slate-200 flex items-center justify-center text-slate-600"
      >
        <Bell size={18} />
      </button>

      <UserMenu name={name} email={email} initials={initials} onSignOut={onSignOut} />
    </div>
  );
}

interface UserMenuProps {
  name: string;
  email: string;
  initials: string;
  onSignOut: () => void;
}

function UserMenu({ name, email, initials, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
        onClick={() => setOpen((prev) => !prev)}
        className="h-10 w-10 cursor-pointer rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-slate-100 bg-white shadow-xl ring-1 ring-slate-900/5">
          <div className="px-4 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-500 truncate">{email}</p>
          </div>

          <Link
            href="/student/profile"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <User size={16} />
            Profile
          </Link>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="w-full flex cursor-pointer items-center gap-3 px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
