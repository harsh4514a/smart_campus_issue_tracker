"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import HomeNavbar from "@/components/HomeNavbar";
import { getRedirectPath, loadAuth } from "@/lib/client-auth";
import Link from "next/link";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const auth = loadAuth();
    if (auth?.user?.role) {
      router.replace(getRedirectPath(auth.user.role));
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-linear-to-b from-emerald-950 via-emerald-900 to-emerald-800 text-white">
      <HomeNavbar />

      {/* Hero Section */}
      <section className="pt-20 pb-32 text-center px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
            Smart Campus Issue Tracker
          </h1>
          <p className="text-xl text-emerald-100/90 mb-10 max-w-2xl mx-auto">
            Report, track, and resolve campus issues efficiently. From maintenance requests to IT support, we’ve got you covered.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-4 bg-white text-emerald-900 font-semibold rounded-lg hover:bg-emerald-50 transition shadow-lg text-lg"
            >
              Report an Issue →
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 bg-emerald-700/30 hover:bg-emerald-600/40 border border-emerald-500/40 text-white font-medium rounded-lg transition backdrop-blur-sm"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Why CampusTrack Section */}
      <section className="bg-white/5 backdrop-blur-sm border-t border-emerald-700/30 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Why CampusTrack?</h2>
            <p className="text-lg text-emerald-100/80 max-w-3xl mx-auto">
              Streamline campus maintenance and support with our comprehensive issue tracking system.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                icon: "📝",
                title: "Easy Reporting",
                desc: "Report campus issues in seconds with our intuitive form.",
              },
              {
                icon: "⏱️",
                title: "Real-time Tracking",
                desc: "Track the status of your issues from submission to resolution.",
              },
              {
                icon: "🤝",
                title: "Efficient Collaboration",
                desc: "Staff and departments work together to resolve issues quickly.",
              },
              {
                icon: "🔒",
                title: "Secure & Reliable",
                desc: "Your data is protected with enterprise-grade security.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-md border border-emerald-600/30 rounded-xl p-6 text-center hover:border-emerald-400/50 transition"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-emerald-100/70 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-linear-to-b from-transparent to-emerald-950/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
            {[
              { value: "500+", label: "Issues Resolved" },
              { value: "24h", label: "Avg Response Time" },
              { value: "98%", label: "Satisfaction Rate" },
              { value: "6", label: "Departments" },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-5xl md:text-6xl font-bold text-emerald-400 mb-2">
                  {stat.value}
                </div>
                <p className="text-emerald-100/70">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 text-center px-6 bg-white/5 border-t border-emerald-700/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-emerald-100/80 mb-10">
            Join our campus community and help make our environment better for everyone.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center px-10 py-5 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-semibold rounded-xl transition shadow-xl"
          >
            Create Your Account →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center text-emerald-200/60 border-t border-emerald-800/40 bg-emerald-950/40">
        <p>© {new Date().getFullYear()} CampusTrack. Smart Campus Issue Tracker.</p>
      </footer>
    </div>
  );
}




// "use client";

// import { useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { getRedirectPath, loadAuth } from "@/lib/client-auth";
// import Link from "next/link";

// export default function Home() {
//   const router = useRouter();

//   useEffect(() => {
//     const auth = loadAuth();
//     if (auth) {
//       router.replace(getRedirectPath(auth.user.role));
//     }
//   }, [router]);

//   return (
//     <div className="min-h-screen flex flex-col">

//       {/* ================= HERO SECTION ================= */}
//       <header className="relative bg-gradient-to-r from-[#0f3d3e] to-[#123b52] text-white">
//         <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
//           <div className="flex items-center gap-2 font-semibold">
//             <span className="h-8 w-8 flex items-center justify-center rounded bg-white/10">🏫</span>
//             CampusTrack
//           </div>
//           <div className="flex items-center gap-4">
//             <Link href="/login" className="text-sm text-white/80 hover:text-white">
//               Sign in
//             </Link>
//             <Link
//               href="/register"
//               className="bg-white text-gray-900 px-4 py-2 rounded-md text-sm font-semibold"
//             >
//               Get Started
//             </Link>
//           </div>
//         </div>

//         <div className="max-w-7xl mx-auto px-6 py-24 text-center">
//           <h1 className="text-4xl md:text-5xl font-bold leading-tight">
//             Smart Campus <br /> Issue Tracker
//           </h1>
//           <p className="mt-4 max-w-2xl mx-auto text-white/80">
//             Report, track, and resolve campus issues efficiently.
//             From maintenance requests to IT support, we’ve got you covered.
//           </p>

//           <div className="mt-8 flex justify-center gap-4">
//             <Link
//               href="/register"
//               className="bg-white text-gray-900 px-6 py-3 rounded-md font-semibold"
//             >
//               Report an Issue →
//             </Link>
//             <Link
//               href="/login"
//               className="bg-white/10 border border-white/20 px-6 py-3 rounded-md font-semibold"
//             >
//               Sign in
//             </Link>
//           </div>
//         </div>
//       </header>

//       {/* ================= FEATURES ================= */}
//       <section className="bg-white py-20">
//         <div className="max-w-7xl mx-auto px-6 text-center">
//           <h2 className="text-2xl font-semibold">Why CampusTrack?</h2>
//           <p className="mt-2 text-gray-500">
//             Streamline campus maintenance and support with our issue tracking system.
//           </p>

//           <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
//             {[
//               {
//                 title: "Easy Reporting",
//                 desc: "Report campus issues in seconds with our intuitive form.",
//                 icon: "📝",
//               },
//               {
//                 title: "Real-time Tracking",
//                 desc: "Track the status of issues from submission to resolution.",
//                 icon: "⏱️",
//               },
//               {
//                 title: "Efficient Collaboration",
//                 desc: "Staff and departments work together to resolve issues quickly.",
//                 icon: "🤝",
//               },
//               {
//                 title: "Secure & Reliable",
//                 desc: "Your data is protected with enterprise-grade security.",
//                 icon: "🔒",
//               },
//             ].map((item) => (
//               <div
//                 key={item.title}
//                 className="bg-white border rounded-xl p-6 shadow-sm text-left"
//               >
//                 <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-lg">
//                   {item.icon}
//                 </div>
//                 <h3 className="mt-4 font-semibold">{item.title}</h3>
//                 <p className="mt-2 text-sm text-gray-500">{item.desc}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ================= STATS ================= */}
//       <section className="bg-gray-50 py-16">
//         <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
//           <div>
//             <div className="text-2xl font-bold text-teal-600">500+</div>
//             <p className="text-sm text-gray-500">Issues Resolved</p>
//           </div>
//           <div>
//             <div className="text-2xl font-bold text-teal-600">24h</div>
//             <p className="text-sm text-gray-500">Avg Response Time</p>
//           </div>
//           <div>
//             <div className="text-2xl font-bold text-teal-600">98%</div>
//             <p className="text-sm text-gray-500">Satisfaction Rate</p>
//           </div>
//           <div>
//             <div className="text-2xl font-bold text-teal-600">6</div>
//             <p className="text-sm text-gray-500">Departments</p>
//           </div>
//         </div>
//       </section>

//       {/* ================= CTA ================= */}
//       <section className="bg-white py-20 text-center">
//         <h2 className="text-2xl font-semibold">Ready to Get Started?</h2>
//         <p className="mt-2 text-gray-500">
//           Join our campus community and help make our environment better for everyone.
//         </p>
//         <Link
//           href="/register"
//           className="inline-flex items-center mt-6 bg-teal-600 text-white px-6 py-3 rounded-md font-semibold"
//         >
//           Create Your Account →
//         </Link>
//       </section>

//       {/* ================= FOOTER ================= */}
//       <footer className="bg-gray-50 py-6 text-center text-sm text-gray-500">
//         © 2025 CampusTrack. Smart Campus Issue Tracker.
//       </footer>
//     </div>
//   );
// }
