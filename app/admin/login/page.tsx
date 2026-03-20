"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveAuth } from "@/lib/client-auth";

const ADMIN_EMAIL = "admin@campustracker.com";
const ADMIN_PASSWORD = "admin123";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("isAdmin") === "true") {
      router.replace("/admin/dashboard");
    }
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (normalizedEmail !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        setError("Invalid credentials.");
        return;
      }

      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || "Invalid credentials.");
        return;
      }

      saveAuth({ token: data.token, user: data.user }, "session");
      sessionStorage.setItem("isAdmin", "true");
      router.replace("/admin/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-b from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:14px_24px]" />
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[320px] w-[320px] rounded-full bg-blue-400/20 blur-[120px]" />
      <div className="absolute -bottom-24 -right-16 -z-10 h-[360px] w-[360px] rounded-full bg-indigo-400/15 blur-[140px]" />

      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="px-7 pt-7 pb-6 bg-linear-to-r from-blue-600/20 to-indigo-600/20 border-b border-white/10">
            <p className="text-xs font-medium tracking-wide text-white/65">Campus Tracker</p>
            <h1 className="mt-1 text-2xl font-semibold text-white tracking-tight">Admin sign in</h1>
            <p className="mt-2 text-sm text-white/70">Use your admin credentials to continue.</p>
          </div>

          <div className="p-7">
            <form className="space-y-5" onSubmit={onSubmit} autoComplete="on">

              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-white/80">
                  Email
                </label>
                <input
                  id="admin-email"
                  name="email"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder-white/35 outline-none transition shadow-sm focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/15"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-white/80">
                  Password
                </label>
                <input
                  id="admin-password"
                  name="password"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder-white/35 outline-none transition shadow-sm focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/15"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 text-white px-4 py-3 font-semibold transition shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={submitting}
              >
                {submitting ? "Signing in..." : "Sign in"}
              </button>

              <div className="flex items-center justify-center pt-1">
                <div className="h-px w-full bg-white/10" />
              </div>

              <div className="text-center text-sm text-white/70">
                <Link className="hover:underline" href="/">
                  Back to home
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
