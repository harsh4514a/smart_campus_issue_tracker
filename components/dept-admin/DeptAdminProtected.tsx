"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadAuth } from "@/lib/client-auth";

export default function DeptAdminProtected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = loadAuth();
    const isAdmin = typeof window !== "undefined" && sessionStorage.getItem("isAdmin") === "true";

    if (!auth || !isAdmin || auth.user.role !== "admin") {
      router.replace("/admin/login");
      return;
    }

    if (auth.user.adminRole !== "dept_admin") {
      router.replace("/unauthorized");
      return;
    }

    const assignedDepartmentIds = [
      auth.user.department?._id,
      auth.user.academicDepartment?._id,
      auth.user.serviceDepartment?._id,
    ].filter(Boolean);

    if (assignedDepartmentIds.length === 0) {
      router.replace("/unauthorized");
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">Checking access...</div>
    );
  }

  return <>{children}</>;
}
