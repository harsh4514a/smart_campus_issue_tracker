"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getRedirectPath, saveAuth } from "@/lib/client-auth";
import Link from "next/link";
import HomeNavbar from "@/components/HomeNavbar";
import { useToast } from "@/components/ToastProvider";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      showToast({ message: "Please enter email and password", variant: "error" });
      return;
    }

    setLoading(true);

    try {
      const data = await authFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      saveAuth({ token: data.token, user: data.user });
      showToast({ message: "Login successful! Redirecting...", variant: "success" });
      router.replace(getRedirectPath(data.user.role));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      showToast({ message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-emerald-950 via-emerald-900 to-emerald-800 flex flex-col">
      <HomeNavbar actions={[{ label: "Create account", href: "/register", variant: "primary" }]} />

      {/* Login Form */}
      <main className="flex-1 flex items-center justify-center py-12 px-5">
        <div className="w-full max-w-lg">
          <div className="bg-emerald-900/30 backdrop-blur-xl rounded-2xl border border-emerald-700/40 shadow-2xl overflow-hidden">
            {/* Card header */}
            <div className="bg-linear-to-r from-emerald-700 to-teal-700 px-10 py-12 text-center text-white">
              <h1 className="text-3xl font-bold mb-3">Welcome Back</h1>
              <p className="text-emerald-100/90">
                Sign in to CampusTrack • Use your college email
              </p>
            </div>

            {/* Form */}
            <div className="p-10">
              <form onSubmit={handleSubmit} className="space-y-6" autoComplete="on">
                <div>
                  <label className="block text-sm font-medium text-emerald-200 mb-2">
                    College Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-5 py-3.5 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
                    placeholder="yourid@charusat.edu.in"
                    required
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-emerald-200 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-5 py-3.5 pr-14 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
                      placeholder="Enter your Password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-emerald-100 hover:text-white transition filter-[drop-shadow(0_1px_1px_rgba(0,0,0,0.55))]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 px-6 rounded-xl font-medium text-white transition-all shadow-lg mt-2
                    ${loading
                      ? "bg-emerald-800 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-500"
                    }`}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>

              <div className="mt-8 text-center space-y-3 text-sm">
                <p className="text-emerald-300">
                  New here?{" "}
                  <Link href="/register" className="text-cyan-400 hover:text-cyan-300 font-medium">
                    Create an account
                  </Link>
                </p>
                <p>
                  <Link href="/forgot-password" className="text-emerald-300 hover:text-emerald-100">
                    Forgot password?
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer - same as Register */}
      <footer className="border-t border-emerald-800/40 bg-emerald-950/60 backdrop-blur-md py-6 text-center text-emerald-300/80 text-sm">
        <div className="max-w-7xl mx-auto px-6">
          <p>© {new Date().getFullYear()} CampusTrack. Smart Campus Issue Tracker.</p>
        </div>
      </footer>
    </div>
  );
}