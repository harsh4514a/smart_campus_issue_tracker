"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HomeNavbar from "@/components/HomeNavbar";
import { authFetch, getRedirectPath, saveAuth } from "@/lib/client-auth";
import { useToast } from "@/components/ToastProvider";
import { Eye, EyeOff } from "lucide-react";

const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

interface ResetFormState {
  email: string;
  newPassword: string;
  confirmPassword: string;
  otp: string;
}

const emptyForm: ResetFormState = { email: "", newPassword: "", confirmPassword: "", otp: "" };

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [form, setForm] = useState<ResetFormState>({ ...emptyForm });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    formRef.current?.reset();
    setForm({ ...emptyForm });
    setOtpSent(false);
    setResendTimer(0);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (otpSent) {
      otpInputRef.current?.focus();
    }
  }, [otpSent]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const requestReset = async (isResend = false) => {
    const { email, newPassword, confirmPassword } = form;

    if (!email.trim() || !newPassword || !confirmPassword) {
      showToast({ message: "Please complete all fields", variant: "error" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!collegeEmailRegex.test(normalizedEmail)) {
      showToast({ message: "Use your official CHARUSAT email", variant: "error" });
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast({ message: "Passwords do not match", variant: "error" });
      return;
    }

    if (!passwordRegex.test(newPassword)) {
      showToast({
        message: "Password must be 8+ chars with uppercase, lowercase, number & special character",
        variant: "error",
      });
      return;
    }

    setLoading(true);
    try {
      await authFetch("/api/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password: newPassword }),
      });

      setOtpSent(true);
      setResendTimer(60);
      showToast({ message: isResend ? "Reset code resent" : "Reset code sent", variant: "success" });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Failed to send reset code", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!otpSent) {
      await requestReset();
      return;
    }

    if (form.otp.length !== 6) {
      showToast({ message: "Please enter the 6-digit code", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await authFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), otp: form.otp }),
      });

      saveAuth({ token, user });
      showToast({ message: "Password reset successful", variant: "success" });
      router.replace(getRedirectPath(user.role, user.adminRole));
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Reset failed", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-emerald-950 via-emerald-900 to-emerald-800 flex flex-col">
      <HomeNavbar actions={[{ label: "Back to login", href: "/login", variant: "primary" }]} />

      <main className="flex-1 flex items-center justify-center py-12 px-5">
        <div className="w-full max-w-lg">
          <div className="bg-emerald-900/30 backdrop-blur-xl rounded-2xl border border-emerald-700/40 shadow-2xl overflow-hidden">
            <div className="bg-linear-to-r from-emerald-700 to-teal-700 px-10 py-12 text-center text-white">
              <h1 className="text-3xl font-bold mb-3">Reset your password</h1>
              <p className="text-emerald-100/90">We will send a 6-digit code to your college email</p>
            </div>

            <div className="p-10">
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
                {!otpSent ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-emerald-200 mb-2">College Email</label>
                      <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        className="w-full px-5 py-3.5 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
                        placeholder="yourid@charusat.edu.in"
                        autoComplete="email"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-emerald-200 mb-2">New Password</label>
                      <div className="relative">
                        <input
                          name="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          value={form.newPassword}
                          onChange={handleChange}
                          className="w-full px-5 py-3.5 pr-12 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
                          placeholder="Create a strong password"
                          autoComplete="new-password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-4 flex items-center text-emerald-200 hover:text-white transition"
                          aria-label={showNewPassword ? "Hide password" : "Show password"}
                        >
                          {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-emerald-200 mb-2">Confirm Password</label>
                      <div className="relative">
                        <input
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={form.confirmPassword}
                          onChange={handleChange}
                          className="w-full px-5 py-3.5 pr-12 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
                          placeholder="Re-enter your password"
                          autoComplete="new-password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-4 flex items-center text-emerald-200 hover:text-white transition"
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <p className="text-emerald-300 mb-1">Code sent to</p>
                      <p className="text-emerald-100 font-medium text-lg">{form.email}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-emerald-200 mb-2">6-Digit Code</label>
                      <input
                        ref={otpInputRef}
                        name="otp"
                        maxLength={6}
                        value={form.otp}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setForm((prev) => ({ ...prev, otp: digitsOnly }));
                        }}
                        className="w-full px-8 py-5 text-center text-3xl tracking-[1.2em] font-mono bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-white placeholder-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
                        placeholder="••••••"
                        required
                      />
                    </div>

                    <div className="flex justify-between text-sm mt-4">
                      <span className="text-emerald-300">
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Didn't get the code?"}
                      </span>
                      <button
                        type="button"
                        onClick={() => requestReset(true)}
                        disabled={resendTimer > 0 || loading}
                        className="text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition"
                      >
                        Resend code
                      </button>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 px-6 rounded-xl font-medium text-white transition-all shadow-lg mt-2 ${loading ? "bg-emerald-800 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500"
                    }`}
                >
                  {loading ? (otpSent ? "Verifying..." : "Sending code...") : otpSent ? "Reset password" : "Send reset code"}
                </button>
              </form>

              <p className="text-center text-emerald-300 mt-10 text-sm">
                Remembered your password?{" "}
                <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-emerald-800/40 bg-emerald-950/60 backdrop-blur-md py-6 text-center text-emerald-300/80 text-sm">
        <div className="max-w-7xl mx-auto px-6">
          <p>© {new Date().getFullYear()} CampusTracker. Smart Campus Issue Tracker.</p>
        </div>
      </footer>
    </div>
  );
}
