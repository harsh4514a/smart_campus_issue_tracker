"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import Protected from "@/components/Protected";
import StaffShell from "@/components/staff/StaffShell";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const { title, subtitle } = useMemo(() => getStaffMeta(pathname), [pathname]);

  return (
    <Protected allowedRoles={["staff"]}>
      <StaffShell title={title} subtitle={subtitle}>
        {children}
      </StaffShell>
    </Protected>
  );
}

function getStaffMeta(pathname: string) {
  if (pathname.startsWith("/staff/issues/")) {
    return {
      title: "Issue Details",
      subtitle: "Review and update assigned issue",
    };
  }

  if (pathname === "/staff/issues") {
    return {
      title: "Department Issues",
      subtitle: "View and manage all issues assigned to your department",
    };
  }

  if (pathname === "/staff/notifications") {
    return {
      title: "Notifications",
      subtitle: "Stay updated on issue activity and priorities",
    };
  }

  if (pathname === "/staff/profile") {
    return {
      title: "Profile",
      subtitle: "Manage your account information",
    };
  }

  return {
    title: "Staff Dashboard",
    subtitle: "Manage issues assigned to your department",
  };
}
