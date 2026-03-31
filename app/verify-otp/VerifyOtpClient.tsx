"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch, getRedirectPath, saveAuth } from "@/lib/client-auth";

export default function VerifyOtpClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initialEmail = params.get("email") || "";
    setEmail(initialEmail);
  }, [params]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const data = await authFetch("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });
      saveAuth({ token: data.token, user: data.user });
      router.replace(getRedirectPath(data.user.role, data.user.adminRole));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-semibold mb-4">Verify OTP</h1>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">OTP</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-blue-600 text-white py-2 font-semibold hover:bg-blue-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify & Create Account"}
          </button>
          {status && <p className="text-sm text-red-600">{status}</p>}
        </form>
      </div>
    </div>
  );
}
