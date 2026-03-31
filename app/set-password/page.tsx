"use client";

import { Suspense } from "react";
import { FormEvent, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import HomeNavbar from "@/components/HomeNavbar";
import { authFetch } from "@/lib/client-auth";
import { useToast } from "@/components/ToastProvider";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordPageContent />
    </Suspense>
  );
}

function SetPasswordPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

  const token = useMemo(() => params.get("token") || "", [params]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!token) {
      showToast({ message: "Setup token is missing.", variant: "error" });
      return;
    }

    if (!passwordRegex.test(password)) {
      showToast({
        message: "Password must be 8+ chars with uppercase, lowercase, number, and special character.",
        variant: "error",
      });
      return;
    }

    if (password !== confirmPassword) {
      showToast({ message: "Passwords do not match.", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      await authFetch("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });

      showToast({ message: "Password set successfully. Please login.", variant: "success" });
      router.replace("/login");
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Unable to set password.", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-emerald-950 via-emerald-900 to-emerald-800 flex flex-col">
      <HomeNavbar actions={[{ label: "Back to login", href: "/login", variant: "primary" }]} />

      <main className="flex-1 flex items-center justify-center py-12 px-5">
        <div className="w-full max-w-lg rounded-2xl border border-emerald-700/40 bg-emerald-900/30 p-8 shadow-2xl backdrop-blur-xl">
          <h1 className="text-3xl font-bold text-white">Set Your Password</h1>
          <p className="mt-2 text-emerald-200">Create a secure password to activate your account.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-emerald-200">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-emerald-600/50 bg-emerald-950/60 px-4 py-3 text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                placeholder="Enter strong password"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-emerald-200">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-emerald-600/50 bg-emerald-950/60 px-4 py-3 text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                placeholder="Re-enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 px-5 py-3.5 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-800"
            >
              {loading ? "Setting password..." : "Set Password"}
            </button>
          </form>

          <p className="mt-6 text-sm text-emerald-200">
            Already set your password? <Link href="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
