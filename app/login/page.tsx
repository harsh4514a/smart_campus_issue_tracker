// "use client";

// import { FormEvent, useLayoutEffect, useRef, useState } from "react";
// import Image from "next/image";
// import { useRouter } from "next/navigation";
// import { authFetch, getRedirectPath, saveAuth } from "@/lib/client-auth";
// import Link from "next/link";
// import { useToast } from "@/components/ToastProvider";


// export default function LoginPage() {
//   const router = useRouter();
//   const formRef = useRef<HTMLFormElement>(null);
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);
//   const { showToast } = useToast();

//   useLayoutEffect(() => {
//     formRef.current?.reset();
//     setEmail("");
//     setPassword("");
//     formRef.current?.querySelectorAll("input").forEach((input) => {
//       input.value = "";
//     });
//   }, []);

//   const onSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     try {
//       const data = await authFetch("/api/auth/login", {
//         method: "POST",
//         body: JSON.stringify({ email, password }),
//       });
//       saveAuth({ token: data.token, user: data.user });
//       showToast({ message: "Login successful. Redirecting...", variant: "success" });
//       router.replace(getRedirectPath(data.user.role));
//     } catch (err: unknown) {
//       const message = err instanceof Error ? err.message : "Login failed";
//       showToast({ message, variant: "error" });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="relative min-h-screen flex items-center justify-center px-4 py-8 overflow-hidden">
//       <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
//         <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-fuchsia-300 opacity-30 blur-[120px]" />
//         <div className="absolute -bottom-20 -right-10 -z-10 h-72 w-72 rounded-full bg-blue-300 opacity-20 blur-[140px]" />
//       </div>
//       <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-2xl shadow-xl border border-gray-100 bg-white">
//         <div className="relative h-65 lg:h-full">
//           <Image
//             src="/images/loginpage_image.png"
//             alt="Campus illustration"
//             fill
//             priority
//             className="object-cover brightness-[0.82] contrast-110"
//           />
//           <div className="absolute inset-0 bg-linear-to-tr from-black/70 via-black/45 to-black/10" />
//           <div className="absolute inset-0 bg-white/5 mix-blend-screen" />
//           <div className="absolute inset-0 flex flex-col items-center justify-center px-6 sm:px-8 text-center text-white gap-6">
//             <div className="space-y-4 max-w-md drop-shadow-[0_15px_35px_rgba(0,0,0,0.45)]">
//               <div className="flex items-center justify-center gap-2 text-md font-semibold bg-[#F3F4F6]/95 border border-white/30 rounded-full px-4 py-2 text-[#0F4C81] shadow-lg mx-auto w-fit">
//                 <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 border border-white/30">🏫</span>
//                 <span className="text-base sm:text-lg">Campus Tracker</span>
//               </div>
//               <h1 className="text-4xl font-semibold leading-tight">Better Campus,Together.</h1>
//               <p className="text-lg text-white/90">
//                 Report maintenance issues, track repairs, and help us keep our university facilities world-class.
//               </p>
//             </div>
//           </div>
//         </div>

//         <div className="flex items-center justify-center px-6 py-10 bg-white">
//           <div className="w-full max-w-md lg:min-h-130 flex flex-col justify-center">
//             <div className="space-y-2 mb-6">
//               <p className="text-sm text-gray-500">Welcome back</p>
//               <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
//               <p className="text-sm text-gray-500">Enter your email and password to access your account.</p>
//             </div>

//             <form ref={formRef} className="space-y-4" onSubmit={onSubmit} autoComplete="off">
//               <input
//                 type="text"
//                 className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
//                 autoComplete="username"
//                 tabIndex={-1}
//               />
//               <input
//                 type="password"
//                 className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
//                 autoComplete="current-password"
//                 tabIndex={-1}
//               />
//               <div>
//                 <label className="block text-sm font-medium text-gray-700">Email</label>
//                 <input
//                   type="email"
//                   className="mt-1 w-full rounded-lg border border-gray-450 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
//                   value={email}
//                   onChange={(e) => setEmail(e.target.value)}
//                   name="email"
//                   autoComplete="email"
//                   placeholder="e.g. student@charusat.edu.in"
//                   required
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium text-gray-700">Password</label>
//                 <input
//                   type="password"
//                   className="mt-1 w-full rounded-lg border border-gray-450 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   name="password"
//                   autoComplete="new-password"
//                   placeholder="Your password"
//                   required
//                 />
//               </div>
//               <button
//                 type="submit"
//                 className="w-full rounded-lg bg-blue-600 text-white py-3 font-semibold hover:bg-blue-700 transition disabled:opacity-60"
//                 disabled={loading}
//               >
//                 {loading ? "Signing in..." : "Sign in"}
//               </button>
//             </form>

//             <div className="mt-6 text-sm text-gray-600">
//               New here? <Link href="/register" className="text-blue-600 hover:underline">Create an account</Link>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }






"use client";

import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authFetch, getRedirectPath, saveAuth } from "@/lib/client-auth";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";

export default function LoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Make sure form starts completely empty and clears on each visit to /login
  useLayoutEffect(() => {
    if (pathname !== "/login") return;

    const clearFields = () => {
      formRef.current?.reset();
      setEmail("");
      setPassword("");
      formRef.current?.querySelectorAll("input").forEach((input) => {
        if (input.type === "email" || input.type === "password") {
          input.value = "";
        }
      });
    };

    clearFields();
    const raf = requestAnimationFrame(clearFields);
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

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
      {/* Header - same as Register page */}
      <header className="border-b border-emerald-700/60 bg-emerald-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xl">
              C
            </div>
            <span className="text-xl font-semibold text-white group-hover:text-emerald-100 transition-colors">CampusTrack</span>
          </Link>

          <Link
            href="/register"
            className="px-6 py-2.5 bg-emerald-700/40 hover:bg-emerald-600/50 text-white rounded-lg font-medium transition backdrop-blur-sm border border-emerald-500/30"
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* Main Content */}
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
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
                <input
                  type="text"
                  className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
                  autoComplete="username"
                  tabIndex={-1}
                />
                <input
                  type="password"
                  className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
                  autoComplete="current-password"
                  tabIndex={-1}
                />
                <div>
                  <label className="block text-sm font-medium text-emerald-200 mb-2">
                    College Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-5 py-3.5 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
                    placeholder="yourname@charusat.edu.in"
                    required
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-emerald-200 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-3.5 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
                    placeholder="••••••••••••"
                    required
                    autoComplete="off"
                  />
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