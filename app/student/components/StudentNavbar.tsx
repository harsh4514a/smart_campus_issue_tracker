"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { StudentUserActions } from "./StudentUserActions";

interface StudentNavbarProps {
  firstName: string;
  userName: string;
  userEmail: string;
  userInitials: string;
  onSignOut: () => void;
  title?: string;
  subtitle?: string;
  reportHref?: string;
  className?: string;
}

export function StudentNavbar({
  firstName,
  userName,
  userEmail,
  userInitials,
  onSignOut,
  title,
  subtitle,
  reportHref = "/student/report",
  className = "",
}: StudentNavbarProps) {
  const headerClass = `sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`;

  return (
    <header className={headerClass.trim()}>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {title ?? `Welcome back, ${firstName}!`}
        </h1>
        <p className="text-slate-500 mt-1">
          {subtitle ?? "Here's an overview of your reported issues."}
        </p>
      </div>

      <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
        <Link
          href={reportHref}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          <PlusCircle size={16} />
          Report Issue
        </Link>

        <StudentUserActions
          name={userName}
          email={userEmail}
          initials={userInitials}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
}
