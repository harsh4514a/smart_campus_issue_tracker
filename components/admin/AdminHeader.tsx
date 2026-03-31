"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Bell, Command, Search, X } from "lucide-react";
import { authFetch, loadAuth } from "@/lib/client-auth";
import { useRouter } from "next/navigation";

type AdminHeaderProps = {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

type SearchItem = {
  _id: string;
  title?: string;
  name?: string;
  email?: string;
  status?: string;
};

type SearchResponse = {
  issues: SearchItem[];
  students: SearchItem[];
  staff: SearchItem[];
  departments: SearchItem[];
};

export default function AdminHeader({ title, subtitle, actions }: AdminHeaderProps) {
  const router = useRouter();
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse>({ issues: [], students: [], staff: [], departments: [] });
  const [searchLoading, setSearchLoading] = useState(false);

  const initial = useMemo(() => {
    const base = (name || email || "A").trim();
    return base ? base[0].toUpperCase() : "A";
  }, [email, name]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    if (searchQuery.trim().length < 2) {
      setSearchResults({ issues: [], students: [], staff: [], departments: [] });
      return;
    }

    const auth = loadAuth();
    if (!auth) return;

    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await authFetch(
          `/api/search/global?query=${encodeURIComponent(searchQuery.trim())}`,
          { method: "GET" },
          auth.token
        );
        setSearchResults({
          issues: data.issues || [],
          students: data.students || [],
          staff: data.staff || [],
          departments: data.departments || [],
        });
      } catch {
        setSearchResults({ issues: [], students: [], staff: [], departments: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [searchOpen, searchQuery]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div>
        {title ? <h1 className="text-2xl font-bold text-slate-900">{title}</h1> : null}
        {subtitle ? <p className="text-slate-500 mt-1">{subtitle}</p> : null}
      </div>

      <div className="flex items-center gap-4">
        {actions ? <div className="hidden sm:block">{actions}</div> : null}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden md:inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Search className="h-4 w-4" />
          Search
          <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500">
            <Command className="h-3 w-3" />K
          </span>
        </button>
        <button
          type="button"
          className="h-10 w-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600"
          aria-label="Notifications"
          title="Send notification"
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

      {searchOpen ? (
        <div className="fixed inset-0 z-60 flex items-start justify-center bg-slate-900/45 px-4 pt-16" onClick={() => setSearchOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search issues, students, staff, departments..."
                className="flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
              {searchLoading ? <p className="text-sm text-slate-500">Searching...</p> : null}

              {!searchLoading && searchQuery.trim().length >= 2 &&
              searchResults.issues.length === 0 &&
              searchResults.students.length === 0 &&
              searchResults.staff.length === 0 &&
              searchResults.departments.length === 0 ? (
                <p className="text-sm text-slate-500">No results found.</p>
              ) : null}

              {searchResults.issues.length > 0 ? (
                <SearchSection
                  title="Issues"
                  items={searchResults.issues.map((item) => ({
                    id: item._id,
                    title: item.title || "Untitled issue",
                    subtitle: item.status || "",
                    onClick: () => {
                      router.push(`/admin/issues?issueId=${item._id}`);
                      setSearchOpen(false);
                    },
                  }))}
                />
              ) : null}

              {searchResults.students.length > 0 ? (
                <SearchSection
                  title="Students"
                  items={searchResults.students.map((item) => ({
                    id: item._id,
                    title: item.name || "Unnamed student",
                    subtitle: item.email || "",
                    onClick: () => {
                      router.push("/admin/students");
                      setSearchOpen(false);
                    },
                  }))}
                />
              ) : null}

              {searchResults.staff.length > 0 ? (
                <SearchSection
                  title="Staff"
                  items={searchResults.staff.map((item) => ({
                    id: item._id,
                    title: item.name || "Unnamed staff",
                    subtitle: item.email || "",
                    onClick: () => {
                      router.push("/admin/staff");
                      setSearchOpen(false);
                    },
                  }))}
                />
              ) : null}

              {searchResults.departments.length > 0 ? (
                <SearchSection
                  title="Departments"
                  items={searchResults.departments.map((item) => ({
                    id: item._id,
                    title: item.name || "Unnamed department",
                    subtitle: "Department",
                    onClick: () => {
                      router.push("/admin/departments");
                      setSearchOpen(false);
                    },
                  }))}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function SearchSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string; subtitle: string; onClick: () => void }>;
}) {
  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
          >
            <p className="text-sm font-medium text-slate-800">{item.title}</p>
            <p className="text-xs text-slate-500">{item.subtitle}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
