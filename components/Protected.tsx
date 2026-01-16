"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRedirectPath, loadAuth, UserRole } from "@/lib/client-auth";

export default function Protected({ allowedRoles, children }: { allowedRoles: UserRole[]; children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth) {
      router.replace("/login");
      return;
    }
    const role = auth.user.role as UserRole;
    if (!allowedRoles.includes(role)) {
      router.replace(getRedirectPath(role));
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, [allowedRoles, router]);

  if (!ready) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center text-gray-600">
        Checking access...
      </div>
    );
  }

  return <>{children}</>;
}