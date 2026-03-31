"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminRole, loadAuth } from "@/lib/client-auth";

type AllowedAdminRole = "super_admin" | "dept_admin" | "worker";

export default function AdminProtected({
  children,
  allowedAdminRoles,
}: {
  children: React.ReactNode;
  allowedAdminRoles?: AllowedAdminRole[];
}) {
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    const checkAccess = () => {
      const isAdminFlag = sessionStorage.getItem("isAdmin") === "true";
      const auth = loadAuth();
      const currentRole = (auth?.user.adminRole || null) as AdminRole | null;
      const roleAllowed =
        !allowedAdminRoles || (currentRole ? allowedAdminRoles.includes(currentRole as AllowedAdminRole) : false);
      const stillUnauthorized = !isAdminFlag || !auth || auth.user.role !== "admin";

      if (stillUnauthorized) {
        setHasAccess(false);
        setCheckingAccess(false);
        router.replace("/admin/login");
      } else if (!roleAllowed) {
        setHasAccess(false);
        setCheckingAccess(false);
        router.replace("/unauthorized");
      } else {
        setHasAccess(true);
        setCheckingAccess(false);
      }
    };

    checkAccess();

    const onStorage = () => checkAccess();
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [allowedAdminRoles, router]);

  if (checkingAccess || !hasAccess) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center text-gray-600">
        Checking access...
      </div>
    );
  }

  return <>{children}</>;
}
