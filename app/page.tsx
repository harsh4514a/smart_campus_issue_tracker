"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRedirectPath, loadAuth } from "@/lib/client-auth";
import Link from "next/link";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const auth = loadAuth();
    if (auth) {
      router.replace(getRedirectPath(auth.user.role));
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-xl bg-white shadow rounded-xl p-8 text-center space-y-4">
        <h1 className="text-3xl font-semibold">Smart Campus Issue Tracker</h1>
        <p className="text-gray-600">Report and track campus issues with role-based dashboards.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link className="rounded bg-blue-600 text-white px-5 py-3 font-semibold" href="/login">Login</Link>
          <Link className="rounded bg-gray-100 text-gray-800 px-5 py-3 font-semibold" href="/register">Register</Link>
        </div>
      </div>
    </div>
  );
}
