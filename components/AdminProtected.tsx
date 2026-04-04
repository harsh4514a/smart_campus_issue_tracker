"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminRole, loadAuth } from "@/lib/client-auth";

type AllowedAdminRole = "super_admin" | "dept_admin" | "worker";
type AccessStatus = "loading" | "allowed" | "unauthorized" | "forbidden";

const ENABLE_AUTH_DEBUG_LOGS = process.env.NODE_ENV !== "production";

function logAdminProtected(event: string, details: Record<string, unknown>) {
  if (!ENABLE_AUTH_DEBUG_LOGS) return;
  console.debug("[AdminProtected]", event, details);
}

export default function AdminProtected({
  children,
  allowedAdminRoles,
}: {
  children: React.ReactNode;
  allowedAdminRoles?: AllowedAdminRole[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<AccessStatus>("loading");
  const redirectTargetRef = useRef<string | null>(null);
  const renderCountRef = useRef(0);
  const checkCountRef = useRef(0);

  const allowedRolesKey = (allowedAdminRoles || []).slice().sort().join("|") || "all";
  const normalizedAllowedRoles = useMemo(
    () =>
      allowedRolesKey === "all"
        ? null
        : (allowedRolesKey.split("|") as AllowedAdminRole[]),
    [allowedRolesKey]
  );

  useEffect(() => {
    renderCountRef.current += 1;
    logAdminProtected("render", {
      count: renderCountRef.current,
      pathname,
      status,
      allowedRolesKey,
    });
  }, [allowedRolesKey, pathname, status]);

  useEffect(() => {
    checkCountRef.current += 1;
    logAdminProtected("check:start", {
      count: checkCountRef.current,
      pathname,
      allowedRolesKey,
    });

    const auth = loadAuth();
    const isAdmin = Boolean(auth && auth.user.role === "admin");
    const roleFromAuth = (auth?.user?.adminRole || null) as AdminRole | null;
    const inferredRole = (
      roleFromAuth || (pathname.startsWith("/dept-admin") ? "dept_admin" : "super_admin")
    ) as AllowedAdminRole;

    if (!isAdmin) {
      if (typeof window !== "undefined" && sessionStorage.getItem("isAdmin") === "true") {
        sessionStorage.removeItem("isAdmin");
      }
      setStatus("unauthorized");
      logAdminProtected("check:unauthorized", { pathname });
      return;
    }

    const roleAllowed =
      !normalizedAllowedRoles || normalizedAllowedRoles.includes(inferredRole);

    if (!roleAllowed) {
      setStatus("forbidden");
      logAdminProtected("check:forbidden", {
        pathname,
        inferredRole,
        allowed: normalizedAllowedRoles,
      });
      return;
    }

    redirectTargetRef.current = null;
    setStatus("allowed");
    logAdminProtected("check:allowed", { pathname, inferredRole });
  }, [allowedRolesKey, normalizedAllowedRoles, pathname]);

  useEffect(() => {
    if (status === "loading" || status === "allowed") return;

    const target = status === "forbidden" ? "/unauthorized" : "/admin/login";

    if (pathname === target) {
      logAdminProtected("redirect:skip-current-path", { pathname, target });
      return;
    }

    if (redirectTargetRef.current === target) {
      logAdminProtected("redirect:skip-duplicate", { pathname, target });
      return;
    }

    redirectTargetRef.current = target;
    logAdminProtected("redirect:replace", { pathname, target, status });
    router.replace(target);
  }, [pathname, router, status]);

  if (status !== "allowed") {
    return (
      <div className="flex h-full min-h-screen items-center justify-center text-gray-600">
        {status === "loading" ? "Checking access..." : "Redirecting..."}
      </div>
    );
  }

  return <>{children}</>;
}
