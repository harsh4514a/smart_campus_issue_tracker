"use client";

import DeptAdminHeader from "@/components/dept-admin/DeptAdminHeader";
import DeptAdminSidebar from "@/components/dept-admin/DeptAdminSidebar";

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export default function DeptAdminShell({ children, title, subtitle, actions }: Props) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <DeptAdminSidebar />
      <div className="min-w-0 flex-1 lg:ml-64">
        <DeptAdminHeader title={title} subtitle={subtitle} actions={actions} />
        <main className="p-5">{children}</main>
      </div>
    </div>
  );
}
