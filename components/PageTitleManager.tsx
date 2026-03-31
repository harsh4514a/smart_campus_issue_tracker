"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { loadAuth } from "@/lib/client-auth";

function toTitleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveRoleLabel() {
  const auth = loadAuth();
  if (!auth?.user) return "Guest";

  if (auth.user.role === "admin") {
    if (auth.user.adminRole === "super_admin") return "Super Admin";
    if (auth.user.adminRole === "dept_admin") return "Department Admin";
    if (auth.user.adminRole === "worker") return "Worker Admin";
    return "Admin";
  }

  if (auth.user.role === "staff") return "Staff";
  if (auth.user.role === "faculty") return "Faculty";
  return "Student";
}

function resolvePageLabel(pathname: string) {
  if (!pathname || pathname === "/") return "Home";

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Home";

  const [root, section] = segments;

  if (root === "admin") {
    return section ? `Admin ${toTitleCase(section)}` : "Admin Dashboard";
  }

  if (root === "dept-admin") {
    return section ? `Department Admin ${toTitleCase(section)}` : "Department Admin Dashboard";
  }

  if (root === "staff") {
    return section ? `Staff ${toTitleCase(section)}` : "Staff Dashboard";
  }

  if (root === "student") {
    return section ? `Student ${toTitleCase(section)}` : "Student Dashboard";
  }

  return toTitleCase(segments[segments.length - 1]);
}

export default function PageTitleManager() {
  const pathname = usePathname();

  useEffect(() => {
    const roleLabel = resolveRoleLabel();
    const pageLabel = resolvePageLabel(pathname || "/");
    document.title = `${pageLabel} | ${roleLabel} | CampusTracker`;
  }, [pathname]);

  return null;
}
