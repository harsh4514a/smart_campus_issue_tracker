"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Bell } from "lucide-react";
import { loadAuth } from "@/lib/client-auth";

type AdminHeaderProps = {
  title?: string;
  subtitle?: string;
};

export default function AdminHeader({ title, subtitle }: AdminHeaderProps) {
  const authSnapshot = useSyncExternalStore(
    () => () => {},
    () => {
      const auth = loadAuth();
      const name = auth?.user?.name || "";
      const email = auth?.user?.email || "";
      return `${name}|||${email}`;
    },
    () => "|||"
  );
  const [rawName, rawEmail] = authSnapshot.split("|||");
  const name = rawName || null;
  const email = rawEmail || null;

  const initial = useMemo(() => {
    const base = (name || email || "A").trim();
    return base ? base[0].toUpperCase() : "A";
  }, [email, name]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div>
        {title ? <h1 className="text-2xl font-bold text-slate-900">{title}</h1> : null}
        {subtitle ? <p className="text-slate-500 mt-1">{subtitle}</p> : null}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="h-10 w-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4 text-gray-600" />
        </button>
        <div
          className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center justify-center"
          aria-label={name ? `Signed in as ${name}` : "Signed in"}
          title={name || email || "Admin"}
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
