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
  reportHref?: string;
  className?: string;
}

export function StudentNavbar({
  firstName,
  userName,
  userEmail,
  userInitials,
  onSignOut,
  reportHref = "/student/report",
  className = "",
}: StudentNavbarProps) {
  const headerClass = `bg-white border-b border-slate-200 px-6 py-6 flex items-center justify-between ${className}`;

  return (
    <header className={headerClass.trim()}>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {firstName}!
        </h1>
        <p className="text-slate-500 mt-1">
          Here&apos;s an overview of your reported issues.
        </p>
      </div>

      <div className="flex items-center gap-4">
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
