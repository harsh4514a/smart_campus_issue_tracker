"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { StudentSidebar } from "@/app/student/components/StudentSidebar";
import { StudentUserActions } from "@/app/student/components/StudentUserActions";
import { authFetch, clearAuth, loadAuth } from "@/lib/client-auth";
import { AlertCircle, UploadCloud } from "lucide-react";

const categories = ["Maintenance", "Electrical", "Plumbing", "Cleanliness", "Security", "Other"];

type StatusState = { type: "success" | "error"; message: string } | null;

export default function StudentReportPage() {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useMemo(() => loadAuth(), []);
  const userName = auth?.user.name?.trim() || auth?.user.email || "Student";
  const userInitials = getInitials(userName);
  const userEmail = auth?.user.email || "student@example.com";

  const [form, setForm] = useState({
    category: "",
    title: "",
    description: "",
    building: "",
    room: "",
    area: "",
  });
  const [photoName, setPhotoName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusState>(auth ? null : { type: "error", message: "Please sign in again." });

  const handleChange = (field: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!auth) {
      setStatus({ type: "error", message: "Authentication expired. Please log in." });
      return;
    }

    setLoading(true);
    setStatus(null);

    const location = [form.building, form.room, form.area].filter(Boolean).join(" · ") || "Not specified";

    try {
      await authFetch(
        "/api/issues",
        {
          method: "POST",
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description.trim(),
            category: form.category,
            location,
          }),
        },
        auth.token,
      );
      setStatus({ type: "success", message: "Issue submitted successfully. Redirecting..." });
      router.push("/student/issues");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit issue";
      setStatus({ type: "error", message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Protected allowedRoles={["student", "faculty"]}>
      <div className="min-h-screen bg-slate-50 flex">
        <StudentSidebar pathname={pathname} userName={userName} initials={userInitials} />
        <div className="flex-1 flex flex-col">
          <header className="border-b border-slate-200 bg-white px-6 py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Report an Issue</p>
              <h1 className="text-2xl font-semibold text-slate-900">Fill out the form to raise a campus issue.</h1>
            </div>
            <StudentUserActions
              name={userName}
              email={userEmail}
              initials={userInitials}
              onSignOut={() => {
                clearAuth();
                router.replace("/login");
              }}
            />
          </header>

          <main className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            <div className="mx-auto max-w-3xl">
              {status && <StatusBanner status={status} />}
              <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
                <form className="space-y-6" onSubmit={onSubmit}>
                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <FieldLabel htmlFor="category" label="Category" required description="Select the closest category" />
                      <select
                        id="category"
                        value={form.category}
                        onChange={(e) => handleChange("category")(e.target.value)}
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="" disabled>
                          Select a category
                        </option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel htmlFor="title" label="Title" required description="Brief description of the issue" />
                      <input
                        id="title"
                        type="text"
                        value={form.title}
                        onChange={(e) => handleChange("title")(e.target.value)}
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Brief description of the issue"
                      />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel htmlFor="description" label="Description" required description="Provide more details about the issue" />
                      <textarea
                        id="description"
                        value={form.description}
                        onChange={(e) => handleChange("description")(e.target.value)}
                        required
                        rows={4}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Provide more details about the issue..."
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <TextField
                        id="building"
                        label="Building"
                        placeholder="e.g., Science Block"
                        required
                        value={form.building}
                        onChange={handleChange("building")}
                      />
                      <TextField
                        id="room"
                        label="Room"
                        placeholder="e.g., Room 101"
                        value={form.room}
                        onChange={handleChange("room")}
                      />
                      <TextField
                        id="area"
                        label="Area"
                        placeholder="e.g., Hallway"
                        value={form.area}
                        onChange={handleChange("area")}
                      />
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-900">Photo (optional)</p>
                      <label
                        htmlFor="photo"
                        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 hover:border-emerald-200 hover:bg-white"
                      >
                        <UploadCloud className="mb-3 text-slate-400" size={28} />
                        <span className="font-medium text-slate-700">Click to upload or drag and drop</span>
                        <span className="text-xs text-slate-400">PNG, JPG up to 5MB</span>
                        <input
                          id="photo"
                          type="file"
                          className="hidden"
                          onChange={(e) => setPhotoName(e.target.files?.[0]?.name || "")}
                        />
                      </label>
                      <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
                        {photoName ? `Selected file: ${photoName}` : "No file chosen"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Link
                      href="/student/dashboard"
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 px-8 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Submitting..." : "Submit Issue"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </main>
        </div>
      </div>
    </Protected>
  );
}

function StatusBanner({ status }: { status: StatusState }) {
  if (!status) return null;
  const palette =
    status.type === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-800"
      : "border-red-100 bg-red-50 text-red-700";
  return (
    <div className={`mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${palette}`}>
      <AlertCircle size={18} />
      <span>{status.message}</span>
    </div>
  );
}

function FieldLabel({ htmlFor, label, description, required }: { htmlFor: string; label: string; description?: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-900">
        {label}
        {required && <span className="text-emerald-600"> *</span>}
      </label>
      {description && <p className="text-xs text-slate-500">{description}</p>}
    </div>
  );
}

function TextField({ id, label, placeholder, value, onChange, required }: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id} label={label} required={required} />
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        placeholder={placeholder}
      />
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}