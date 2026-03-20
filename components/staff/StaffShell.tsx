"use client";

import StaffHeader from "@/components/staff/StaffHeader";
import StaffSidebar from "@/components/staff/StaffSidebar";

type StaffShellProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

export default function StaffShell({ children, title, subtitle }: StaffShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <StaffSidebar />
      <div className="min-w-0 flex-1 lg:ml-64">
        <StaffHeader title={title} subtitle={subtitle} />
        <main className="p-5">{children}</main>
      </div>
    </div>
  );
}
