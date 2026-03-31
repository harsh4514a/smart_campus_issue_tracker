"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { StudentSidebar } from "@/app/student/components/StudentSidebar";
import { StudentUserActions } from "@/app/student/components/StudentUserActions";
import { authFetch, clearAuth, loadAuth } from "@/lib/client-auth";
import { useToast } from "@/components/ToastProvider";

const categories = ["Cleaning", "Electrical", "IT Support", "Network / Internet", "Plumbing", "Furniture"];

type IssueDetail = {
  _id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  imageUrl?: string | null;
  status?: string;
  dueDate?: string;
};

export default function StudentIssueEditPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const issueId = params?.id as string;

  const auth = useMemo(() => loadAuth(), []);
  const { showToast } = useToast();
  const userName = auth?.user.name?.trim() || auth?.user.email || "Student";
  const userInitials = getInitials(userName);
  const userEmail = auth?.user.email || "student@example.com";
  const userRoleLabel = formatRoleLabel(auth?.user.role);

  const [form, setForm] = useState({
    category: "",
    title: "",
    description: "",
    building: "",
    room: "",
    area: "",
  });
  const [photoName, setPhotoName] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingIssue, setLoadingIssue] = useState(true);
  const [currentIssue, setCurrentIssue] = useState<IssueDetail | null>(null);

  useEffect(() => {
    if (!auth || !issueId) return;

    setLoadingIssue(true);
    authFetch(`/api/issues/${issueId}`, { method: "GET" }, auth.token)
      .then((data) => {
        const issue = data.issue as IssueDetail | undefined;
        if (!issue) {
          showToast({ message: "Issue not found.", variant: "error" });
          return;
        }

        setCurrentIssue(issue);

        const { building, room, area } = parseIssueLocation(issue.location);
        setForm({
          category: issue.category,
          title: issue.title,
          description: issue.description,
          building,
          room,
          area,
        });
        if (issue.imageUrl) {
          setPhotoPreview(issue.imageUrl);
          setPhotoName("Existing image");
        }
      })
      .catch((err) => {
        showToast({ message: err instanceof Error ? err.message : "Failed to load issue.", variant: "error" });
      })
      .finally(() => setLoadingIssue(false));
  }, [auth, issueId, showToast]);

  const overdueText = useMemo(() => {
    if (!currentIssue?.dueDate) return null;
    if (currentIssue.status === "Resolved") return null;

    const due = new Date(currentIssue.dueDate).getTime();
    if (Number.isNaN(due) || Date.now() <= due) return null;

    const overdueMs = Date.now() - due;
    const dayMs = 24 * 60 * 60 * 1000;
    if (overdueMs >= dayMs) {
      const days = Math.floor(overdueMs / dayMs);
      return `${days} day${days > 1 ? "s" : ""}`;
    }

    const hours = Math.max(1, Math.floor(overdueMs / (60 * 60 * 1000)));
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }, [currentIssue?.dueDate, currentIssue?.status]);

  const handleChange = (field: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoChange = handlePhotoChangeFactory(setPhotoName, setPhotoPreview, showToast);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!auth) {
      showToast({ message: "Authentication expired. Please log in.", variant: "error" });
      return;
    }

    setLoading(true);

    const location = [form.building, form.room, form.area].filter(Boolean).join(" · ") || "Not specified";

    try {
      await authFetch(
        `/api/issues/${issueId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description.trim(),
            category: form.category,
            location,
            imageUrl: photoPreview,
          }),
        },
        auth.token
      );
      showToast({ message: "Issue updated successfully.", variant: "success" });
      router.push("/student/my-issues");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update issue";
      showToast({ message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
  <Protected allowedRoles={["student", "faculty"]}>
      <div className="min-h-screen bg-slate-50 flex">
        <StudentSidebar
          pathname={pathname}
          userName={userName}
          initials={userInitials}
          roleLabel={userRoleLabel}
        />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur px-6 py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Edit Issue</p>
              <h1 className="text-2xl font-semibold text-slate-900">Update the details for your reported issue.</h1>
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
              <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
                {overdueText ? (
                  <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    This issue is overdue by {overdueText}.
                  </div>
                ) : null}

                {loadingIssue ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 w-40 rounded bg-slate-200" />
                    <div className="h-10 w-full rounded-2xl bg-slate-100" />
                    <div className="h-10 w-full rounded-2xl bg-slate-100" />
                    <div className="h-24 w-full rounded-2xl bg-slate-100" />
                  </div>
                ) : (
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
                        <FieldLabel htmlFor="description" label="Description" description="Provide more details about the issue" />
                        <textarea
                          id="description"
                          value={form.description}
                          onChange={(e) => handleChange("description")(e.target.value)}
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
                          <span className="font-medium text-slate-700">Click to upload or drag and drop</span>
                          <span className="text-xs text-slate-400">PNG, JPG up to 5MB</span>
                          <input
                            id="photo"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
                          />
                        </label>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
                          {photoName ? `Selected file: ${photoName}` : "No file chosen"}
                        </div>
                        {photoPreview && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold text-slate-500 mb-2">Preview</p>
                            <Image
                              src={photoPreview}
                              alt="Issue preview"
                              width={800}
                              height={400}
                              className="max-h-56 w-full rounded-xl object-cover"
                              unoptimized
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <Link
                        href="/student/my-issues"
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 px-8 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </Link>
                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
    </Protected>
  );
}

function handlePhotoChangeFactory(
  setPhotoName: (name: string) => void,
  setPhotoPreview: (value: string | null) => void,
  showToast: (t: { title?: string; message: string; variant?: "info" | "success" | "error"; durationMs?: number }) => void
) {
  return (file: File | null) => {
    if (!file) {
      setPhotoName("");
      setPhotoPreview(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast({ message: "Image must be smaller than 5MB.", variant: "error" });
      return;
    }

    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };
}

function FieldLabel({
  htmlFor,
  label,
  description,
  required,
}: {
  htmlFor: string;
  label: string;
  description?: string;
  required?: boolean;
}) {
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

function TextField({
  id,
  label,
  placeholder,
  value,
  onChange,
  required,
}: {
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

function formatRoleLabel(role?: string) {
  if (!role) return "Student";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function parseIssueLocation(location?: string) {
  const normalized = String(location || "").trim();
  if (!normalized || normalized.toLowerCase() === "not specified") {
    return { building: "", room: "", area: "" };
  }

  const splitBy = (delimiter: string) =>
    normalized
      .split(delimiter)
      .map((part) => part.trim())
      .filter(Boolean);

  const dotParts = splitBy(" · ");
  if (dotParts.length >= 3) {
    const [building, room, ...rest] = dotParts;
    return { building, room, area: rest.join(" ") };
  }

  if (dotParts.length === 2) {
    return { building: dotParts[0], room: dotParts[1], area: "" };
  }

  const pipeParts = splitBy("|");
  if (pipeParts.length >= 2) {
    const [building, room, ...rest] = pipeParts;
    return { building, room, area: rest.join(" ") };
  }

  const commaParts = splitBy(",");
  if (commaParts.length >= 2) {
    const [building, room, ...rest] = commaParts;
    return { building, room, area: rest.join(" ") };
  }

  return { building: normalized, room: "", area: "" };
}
