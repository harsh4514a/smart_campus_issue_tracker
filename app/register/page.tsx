// "use client";

// import { FormEvent, useEffect, useRef, useState } from "react";
// import Image from "next/image";
// import { useRouter } from "next/navigation";
// import { authFetch, getRedirectPath, saveAuth } from "@/lib/client-auth";
// import Link from "next/link";
// import { useToast } from "@/components/ToastProvider";

// const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;
// const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

// export default function RegisterPage() {
//   const router = useRouter();
//   const formRef = useRef<HTMLFormElement>(null);
//   const otpInputRef = useRef<HTMLInputElement>(null);
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [otp, setOtp] = useState("");
//   const [otpSent, setOtpSent] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [resendTimer, setResendTimer] = useState(0);
//   const { showToast } = useToast();

//   useEffect(() => {
//     const timer = setTimeout(() => {
//       formRef.current?.reset();
//       setName("");
//       setEmail("");
//       setPassword("");
//       setOtp("");
//       setOtpSent(false);
//       setResendTimer(0);
//     }, 50);

//     return () => clearTimeout(timer);
//   }, []);

//   useEffect(() => {
//     if (resendTimer <= 0) return;
//     const interval = setInterval(() => {
//       setResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
//     }, 1000);
//     return () => clearInterval(interval);
//   }, [resendTimer]);

//   useEffect(() => {
//     if (otpSent) {
//       otpInputRef.current?.focus();
//     }
//   }, [otpSent]);

//   const requestOtp = async (isResend = false) => {
//     const trimmedName = name.trim();
//     const normalizedEmail = email.trim().toLowerCase();

//     if (!trimmedName || !normalizedEmail || !password.trim()) {
//       showToast({ message: "Please fill out all fields before requesting an OTP.", variant: "error" });
//       return;
//     }

//     if (!collegeEmailRegex.test(normalizedEmail)) {
//       showToast({ message: "Please use your official college email (charusat.edu/ac.in).", variant: "error" });
//       return;
//     }

//     if (!passwordRegex.test(password)) {
//       showToast({
//         message: "Password must be 8+ chars with uppercase, lowercase, number, and special character.",
//         variant: "error",
//       });
//       return;
//     }

//     setLoading(true);
//     try {
//       await authFetch("/api/auth/send-otp", {
//         method: "POST",
//         body: JSON.stringify({ name: trimmedName, email: normalizedEmail, password }),
//       });
//       setName(trimmedName);
//       setEmail(normalizedEmail);
//       if (!otpSent) {
//         setOtpSent(true);
//         setOtp("");
//       }
//       showToast({
//         message: isResend ? "OTP resent! Please check your email." : "OTP sent! Please check your email.",
//         variant: "success",
//       });
//       setResendTimer(15);
//       otpInputRef.current?.focus();
//     } catch (err: unknown) {
//       const message = err instanceof Error ? err.message : "Failed to send OTP";
//       showToast({ message, variant: "error" });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const onSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     if (!otpSent) {
//       await requestOtp();
//       return;
//     }

//     const sanitizedOtp = otp.trim();
//     if (sanitizedOtp.length !== 6) {
//       showToast({ message: "Please enter the 6-digit OTP sent to your email.", variant: "error" });
//       return;
//     }

//     const normalizedEmail = email.trim().toLowerCase();

//     setLoading(true);
//     try {
//       const data = await authFetch("/api/auth/verify-otp", {
//         method: "POST",
//         body: JSON.stringify({ email: normalizedEmail, otp: sanitizedOtp }),
//       });
//       saveAuth({ token: data.token, user: data.user });
//       showToast({ message: "Account verified successfully!", variant: "success" });
//       router.replace(getRedirectPath(data.user.role));
//     } catch (err: unknown) {
//       const message = err instanceof Error ? err.message : "OTP verification failed";
//       showToast({ message, variant: "error" });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleResendOtp = async () => {
//     if (!otpSent || resendTimer > 0 || loading) return;
//     await requestOtp(true);
//   };

//   return (
//     <div className="relative min-h-screen flex items-center justify-center px-4 py-8 overflow-hidden">
//       {/* Updated background pattern */}
//       <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
//         <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-fuchsia-300 opacity-30 blur-[120px]"></div>
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

//         <div className={`flex items-center justify-center px-6 bg-white ${otpSent ? "py-9" : "py-10"}`}>
//           <div className="w-full max-w-md lg:min-h-130 flex flex-col justify-center">
//             <div className={`space-y-2 ${otpSent ? "mb-1" : "mb-6"}`}>
//               <p className="text-sm text-gray-500">Get started</p>
//               <h1 className="text-2xl font-semibold text-gray-900">Create your account</h1>
//               <p className="text-sm text-gray-500">Use your college email to receive the OTP and finish signup.</p>
//             </div>

//             <form
//               ref={formRef}
//               className={otpSent ? "space-y-2" : "space-y-4"}
//               onSubmit={onSubmit}
//               autoComplete="off"
//             >
//               <div>
//                 <label className="block text-sm font-medium text-gray-700">Name</label>
//                 <input
//                   className="mt-1 w-full rounded-lg border border-gray-450 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
//                   value={name}
//                   onChange={(e) => setName(e.target.value)}
//                   name="name"
//                   autoComplete="name"
//                   placeholder="Your full name"
//                   required
//                   disabled={otpSent}
//                   readOnly={otpSent}
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium text-gray-700">College Email</label>
//                 <input
//                   type="email"
//                   className="mt-1 w-full rounded-lg border border-gray-450 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
//                   value={email}
//                   onChange={(e) => setEmail(e.target.value)}
//                   placeholder="user@charusat.edu.in"
//                   name="email"
//                   autoComplete="email"
//                   required
//                   disabled={otpSent}
//                   readOnly={otpSent}
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
//                   placeholder="Create a strong password"
//                   required
//                   disabled={otpSent}
//                   readOnly={otpSent}
//                 />
//               </div>

//               {otpSent && (
//                 <div className="space-y-1 -mt-2">
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700">OTP</label>
//                     <input
//                       className="mt-1 w-full rounded-lg border border-gray-450 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition tracking-widest text-center"
//                       value={otp}
//                       onChange={(e) => {
//                         const sanitized = e.target.value.replace(/\D/g, "").slice(0, 6);
//                         setOtp(sanitized);
//                       }}
//                       name="otp"
//                       inputMode="numeric"
//                       pattern="[0-9]{6}"
//                       minLength={6}
//                       maxLength={6}
//                       autoComplete="one-time-code"
//                       placeholder="Enter the 6-digit code"
//                       required
//                       title="Please enter the 6-digit OTP sent to your email"
//                     />
//                     <p className="mt-1 text-xs text-gray-500">OTP sent to {email.trim() || email}. Check your inbox (and spam) for the code.</p>
//                   </div>
//                   <div className="flex items-center justify-between text-xs text-gray-600">
//                     <span>
//                       {resendTimer > 0
//                         ? `You can resend in ${resendTimer}s`
//                         : "Didn’t receive the code?"}
//                     </span>
//                     <button
//                       type="button"
//                       onClick={handleResendOtp}
//                       disabled={resendTimer > 0 || loading}
//                       className="text-blue-600 cursor-pointer font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
//                     >
//                       Resend OTP
//                     </button>
//                   </div>
//                 </div>
//               )}

//               <button
//                 type="submit"
//                 className="w-full rounded-lg bg-blue-600 text-white py-3 font-semibold cursor-pointer hover:bg-blue-700 transition disabled:opacity-60"
//                 disabled={
//                   loading || (otpSent ? otp.trim().length !== 6 : false)
//                 }
//               >
//                 {loading
//                   ? otpSent
//                     ? "Verifying..."
//                     : "Sending OTP..."
//                   : otpSent
//                   ? "Verify & Create account"
//                   : "Send OTP"}
//               </button>
//             </form>

//             <div className="mt-6 text-sm text-gray-600">
//               Already registered? <Link href="/login" className="text-blue-600 hover:underline">Login</Link>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }


"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getRedirectPath, saveAuth } from "@/lib/client-auth";
import Link from "next/link";
import HomeNavbar from "@/components/HomeNavbar";
import { useToast } from "@/components/ToastProvider";
import { Eye, EyeOff } from "lucide-react";

const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

interface RegisterFormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  otp: string;
}

const emptyForm: RegisterFormState = { name: "", email: "", password: "", confirmPassword: "", otp: "" };

export default function RegisterPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [form, setForm] = useState<RegisterFormState>({ ...emptyForm });
  const formRef = useRef<HTMLFormElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const passwordStrength = useMemo(() => {
    const pwd = form.password;
    if (!pwd) {
      return {
        score: 0,
        label: "Use 8+ chars with upper, lower, number & symbol",
        color: "text-emerald-200/80",
        barColor: "bg-emerald-200/40",
      };
    }

    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score > 5) score = 5;

    if (score <= 2) {
      return {
        score: (score / 5) * 100,
        label: "Strength: Weak — add length & variety",
        color: "text-rose-300",
        barColor: "bg-rose-400",
      };
    }

    if (score === 3 || score === 4) {
      return {
        score: (score / 5) * 100,
        label: "Strength: Good — almost there",
        color: "text-amber-300",
        barColor: "bg-amber-400",
      };
    }

    return {
      score: 100,
      label: "Strength: Strong ✔",
      color: "text-emerald-300",
      barColor: "bg-emerald-400",
    };
  }, [form.password]);

  const matchIndicator = useMemo(() => {
    if (!form.confirmPassword) {
      return null;
    }

    if (form.confirmPassword === form.password) {
      return {
        message: "Passwords match",
        color: "text-emerald-300",
      };
    }

    return {
      message: "Passwords do not match yet",
      color: "text-rose-300",
    };
  }, [form.confirmPassword, form.password]);

  useEffect(() => {
    formRef.current?.reset();
    setForm({ ...emptyForm });
    setOtpSent(false);
    setResendTimer(0);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => {
      setResendTimer((p) => Math.max(0, p - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const requestOtp = async (isResend = false) => {
    const { name, email, password, confirmPassword } = form;

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      showToast({ message: "Please fill in all fields", variant: "error" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!collegeEmailRegex.test(normalizedEmail)) {
      showToast({ message: "Use your official CHARUSAT email (@charusat.edu.in / @charusat.ac.in)", variant: "error" });
      return;
    }

    if (password !== confirmPassword) {
      showToast({ message: "Passwords do not match", variant: "error" });
      return;
    }

    if (!passwordRegex.test(password)) {
      showToast({
        message: "Password must be 8+ characters with uppercase, lowercase, number & special character",
        variant: "error",
      });
      return;
    }

    setLoading(true);
    try {
      await authFetch("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: normalizedEmail, password }),
      });

      setOtpSent(true);
      setResendTimer(60);
      showToast({
        message: isResend ? "New OTP sent!" : "OTP sent — check your email",
        variant: "success",
      });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Failed to send OTP",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!otpSent) {
      await requestOtp();
      return;
    }

    if (form.otp.length !== 6) {
      showToast({ message: "Please enter the 6-digit OTP", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await authFetch("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          otp: form.otp,
        }),
      });

      saveAuth({ token, user });
      showToast({ message: "Account created successfully!", variant: "success" });
      router.replace(getRedirectPath(user.role));
      setForm({ ...emptyForm });
      setOtpSent(false);
      setResendTimer(0);
      setShowPassword(false);
      setShowConfirmPassword(false);
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Verification failed",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-emerald-950 via-emerald-900 to-emerald-800 flex flex-col">
      <HomeNavbar actions={[{ label: "Sign in", href: "/login", variant: "ghost" }]} />
      

      {/* Register Form - centered */}
      <main className="flex-1 flex items-center justify-center py-12 px-5">
        <div className="w-full max-w-lg">
          <div className="bg-emerald-900/30 backdrop-blur-xl rounded-2xl border border-emerald-700/40 shadow-2xl overflow-hidden">
            {/* Card header */}
            <div className="bg-linear-to-r from-emerald-700 to-teal-700 px-10 py-12 text-center text-white">
              <h1 className="text-3xl font-bold mb-3">Create Your Account</h1>
              <p className="text-emerald-100/90">
                Join CampusTrack • Use your college email only
              </p>
            </div>

            {/* Form content */}
            <div className="p-10">
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
                {!otpSent ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-emerald-200 mb-2">
                        Full Name
                      </label>
                      <input
                        name="name"
                        autoComplete="name"
                        value={form.name}
                        onChange={handleChange}
                        className="w-full px-5 py-3.5 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
                        placeholder="Enter your full name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-emerald-200 mb-2">
                        College Email
                      </label>
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={handleChange}
                        className="w-full px-5 py-3.5 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
                        placeholder="yourid@charusat.edu.in"
                        required
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
                          autoComplete="new-password"
                          value={form.password}
                          onChange={handleChange}
                          className="w-full px-5 py-3.5 pr-12 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
                          placeholder="Enter Strong Password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-4 flex items-center text-emerald-200 hover:text-white transition"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                          <span
                            className={`block h-full ${passwordStrength.barColor}`}
                            style={{ width: `${passwordStrength.score}%` }}
                          />
                        </div>
                        <p className={`text-sm ${passwordStrength.color}`}>{passwordStrength.label}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-emerald-200 mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={form.confirmPassword}
                          onChange={handleChange}
                          className="w-full px-5 py-3.5 pr-12 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-white placeholder-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
                          placeholder="Re-enter your password"
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
                      {matchIndicator && (
                        <p className={`mt-2 text-sm ${matchIndicator.color}`}>
                          {matchIndicator.message}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <p className="text-emerald-300 mb-1">Code sent to</p>
                      <p className="text-emerald-100 font-medium text-lg">{form.email}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-emerald-200 mb-2">
                        6-Digit OTP
                      </label>
                      <input
                        name="otp"
                        maxLength={6}
                        value={form.otp}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          setForm((p) => ({ ...p, otp: val }));
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
                        onClick={() => requestOtp(true)}
                        disabled={resendTimer > 0 || loading}
                        className="text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition"
                      >
                        Resend OTP
                      </button>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 px-6 rounded-xl font-medium text-white transition-all shadow-lg mt-2
                    ${loading
                      ? "bg-emerald-800 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-500"
                    }`}
                >
                  {loading
                    ? otpSent
                      ? "Verifying..."
                      : "Sending OTP..."
                    : otpSent
                      ? "Create Account"
                      : "Send Verification Code"}
                </button>
              </form>

              <p className="text-center text-emerald-300 mt-10 text-sm">
                Already have an account?{" "}
                <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-emerald-800/40 bg-emerald-950/60 backdrop-blur-md py-6 text-center text-emerald-300/80 text-sm">
        <div className="max-w-7xl mx-auto px-6">
          <p>© {new Date().getFullYear()} CampusTrack. Smart Campus Issue Tracker.</p>

        </div>
      </footer>
    </div>
  );
}


