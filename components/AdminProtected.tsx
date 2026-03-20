"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { loadAuth } from "@/lib/client-auth";

export default function AdminProtected({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const hasAccess = useSyncExternalStore(
    () => () => {},
    () => {
      const isAdminFlag = sessionStorage.getItem("isAdmin") === "true";
      const auth = loadAuth();
      return isAdminFlag && !!auth && auth.user.role === "admin";
    },
    () => false
  );

  useEffect(() => {
    if (hasAccess) {
      return;
    }

    const redirectTimer = window.setTimeout(() => {
      const isAdminFlag = sessionStorage.getItem("isAdmin") === "true";
      const auth = loadAuth();
      const stillUnauthorized = !isAdminFlag || !auth || auth.user.role !== "admin";

      if (stillUnauthorized) {
        router.replace("/admin/login");
      }
    }, 150);

    return () => {
      window.clearTimeout(redirectTimer);
    };
  }, [hasAccess, router]);

  if (!hasAccess) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center text-gray-600">
        Checking access...
      </div>
    );
  }

  return <>{children}</>;
}
