"use client";

import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";

type AdminShellProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
};

export default function AdminShell({ children, title, subtitle, headerActions }: AdminShellProps) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <AdminSidebar />
      <div className="flex-1 min-w-0">
        <AdminHeader title={title} subtitle={subtitle} actions={headerActions} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
