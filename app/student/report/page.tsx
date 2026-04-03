"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { StudentSidebar } from "@/app/student/components/StudentSidebar";
import { StudentUserActions } from "@/app/student/components/StudentUserActions";
import { authFetch, clearAuth, loadAuth } from "@/lib/client-auth";
import { useToast } from "@/components/ToastProvider";
import { Info, UploadCloud } from "lucide-react";

const areaTypes = ["Classroom", "Lab", "Office", "Corridor", "Washroom", "Common Area", "Other"];
const fallbackServiceCategories = ["Cleaning", "Electrical", "IT Support", "Network / Internet", "Plumbing", "Furniture", "Other"];
const categoryExamples: Record<string, string> = {
  Cleaning: "Examples: Dirty classroom, uncleared dustbin, washroom cleanliness",
  Electrical: "Examples: Fan not working, lights off, AC power issue",
  "IT Support": "Examples: Login issue, projector not connecting, system error",
  "Network / Internet": "Examples: WiFi not working, slow internet, no connectivity",
  Plumbing: "Examples: Water leakage, tap issue, washroom pipeline problem",
  Furniture: "Examples: Broken chair, damaged desk, door problem",
};
type Department = { _id: string; name: string; type?: "Academic" | "Service" };

export default function StudentReportPage() {
  const router = useRouter();
  const pathname = usePathname();
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
    departmentId: "",
    room: "",
    area: "",
  });
  const [photoName, setPhotoName] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [customArea, setCustomArea] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const serviceCategories = useMemo(() => {
    const categories = departments
      .filter((department) => department.type === "Service")
      .map((department) => department.name.trim())
      .filter(Boolean);

    return Array.from(new Set(categories));
  }, [departments]);

  const academicDepartments = useMemo(() => {
    return departments.filter((department) => department.type === "Academic");
  }, [departments]);

  const availableCategories = useMemo(() => {
    if (serviceCategories.length > 0) return serviceCategories;
    return fallbackServiceCategories;
  }, [serviceCategories]);

  const usingFallbackCategories = !departmentsLoading && serviceCategories.length === 0;

  useEffect(() => {
    if (!auth) return;

    setDepartmentsLoading(true);
    setDepartmentsError(null);

    authFetch("/api/departments", { method: "GET" }, auth.token)
      .then((data) => {
        const allDepartments = (data.departments || []) as Department[];
        setDepartments(allDepartments);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to load departments";
        setDepartmentsError(message);
        showToast({ message, variant: "error" });
      })
      .finally(() => {
        setDepartmentsLoading(false);
      });
  }, [auth, showToast]);

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

    if (departmentsLoading) {
      showToast({ message: "Departments are still loading. Please wait.", variant: "info" });
      return;
    }

    if (academicDepartments.length === 0 || availableCategories.length === 0) {
      showToast({ message: "Issue categories are unavailable right now. Please try again shortly.", variant: "error" });
      return;
    }

    if (!form.category) {
      showToast({ message: "Please select a category.", variant: "error" });
      return;
    }

    if (!form.departmentId) {
      showToast({ message: "Please select an academic department.", variant: "error" });
      return;
    }

    const trimmedTitle = form.title.trim();
    if (trimmedTitle.length < 5 || trimmedTitle.length > 120) {
      showToast({ message: "Title must be between 5 and 120 characters.", variant: "error" });
      return;
    }

    const trimmedDescription = form.description.trim();
    if (trimmedDescription.length > 1000) {
      showToast({ message: "Description must be 1000 characters or fewer.", variant: "error" });
      return;
    }

    if (form.area === "Other" && !customArea.trim()) {
      showToast({ message: "Please specify the area.", variant: "error" });
      return;
    }

    setLoading(true);

    const areaValue = form.area === "Other" ? customArea.trim() : form.area;
    const selectedAcademicDepartment = academicDepartments.find((department) => department._id === form.departmentId);
    const location = [selectedAcademicDepartment?.name || "", form.room, areaValue]
      .filter(Boolean)
      .join(" · ") || "Not specified";

    try {
      await authFetch(
        "/api/issues",
        {
          method: "POST",
          body: JSON.stringify({
            title: trimmedTitle,
            description: trimmedDescription || undefined,
            category: form.category,
            location,
            departmentId: form.departmentId,
            imageUrl: photoPreview,
          }),
        },
        auth.token,
      );
      showToast({ message: "Issue created successfully. Redirecting...", variant: "success" });
      router.push("/student/my-issues");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit issue";
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
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur pl-16 pr-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Report an Issue</p>
              <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Fill out the form to raise a campus issue.</h1>
            </div>
            <StudentUserActions
              name={userName}
              email={userEmail}
              initials={userInitials}
              className="w-full justify-end sm:w-auto"
              onSignOut={() => {
                clearAuth();
                router.replace("/login");
              }}
            />
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide">
            <div className="mx-auto max-w-3xl">
              <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
                <form className="space-y-5 sm:space-y-6" onSubmit={onSubmit}>
                  {departmentsError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {departmentsError}
                    </div>
                  ) : null}
                  {usingFallbackCategories ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Service categories are temporarily unavailable, so default categories are shown.
                    </div>
                  ) : null}

                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <FieldLabel htmlFor="category" label="Category" required description="Select the closest category" />
                        <span
                          className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500"
                          title="Select the category that best matches your issue to ensure faster resolution"
                          aria-label="Category guidance"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <select
                        id="category"
                        value={form.category}
                        onChange={(e) => handleChange("category")(e.target.value)}
                        required
                        disabled={departmentsLoading}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="" disabled>
                          {departmentsLoading ? "Loading categories..." : "Select a category"}
                        </option>
                        {availableCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      {form.category ? (
                        <p className="text-xs text-slate-600">{categoryExamples[form.category] || `Examples: Issues related to ${form.category}`}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <FieldLabel htmlFor="title" label="Title" required  />
                      <input
                        id="title"
                        type="text"
                        value={form.title}
                        onChange={(e) => handleChange("title")(e.target.value)}
                        required
                        minLength={5}
                        maxLength={120}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Brief description of the issue"
                      />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel htmlFor="description" label="Description"  />
                      <textarea
                        id="description"
                        value={form.description}
                        onChange={(e) => handleChange("description")(e.target.value)}
                        rows={4}
                        maxLength={1000}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Provide more details about the issue..."
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <FieldLabel
                          htmlFor="department"
                          label="Department"
                          required
                          description="Select where issue occurred"
                        />
                        <select
                          id="department"
                          value={form.departmentId}
                          onChange={(e) => handleChange("departmentId")(e.target.value)}
                          required
                          disabled={departmentsLoading}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        >
                          <option value="" disabled>
                            {departmentsLoading ? "Loading departments..." : "Select academic department"}
                          </option>
                          {academicDepartments.map((department) => (
                            <option key={department._id} value={department._id}>
                              {department.name}
                            </option>
                          ))}
                        </select>
                        {academicDepartments.length === 0 ? (
                          <p className="text-xs text-rose-600">No academic departments available. Please contact admin.</p>
                        ) : null}
                      </div>
                      <TextField
                        id="room"
                        label="Room"
                        description="Enter class or room number"
                        placeholder="e.g., 101"
                        required
                        maxLength={50}
                        value={form.room}
                        onChange={handleChange("room")}
                      />
                      <div className="space-y-2">
                        <FieldLabel htmlFor="area" label="Area" required description="Select issue area" />
                        <select
                          id="area"
                          value={form.area}
                          onChange={(e) => handleChange("area")(e.target.value)}
                          required
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        >
                          <option value="" disabled>
                            Select area type
                          </option>
                          {areaTypes.map((area) => (
                            <option key={area} value={area}>
                              {area}
                            </option>
                          ))}
                        </select>
                        {form.area === "Other" && (
                          <input
                            id="customArea"
                            type="text"
                            value={customArea}
                            onChange={(e) => setCustomArea(e.target.value)}
                            required
                            maxLength={60}
                            placeholder="Specify area..."
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />
                        )}
                      </div>
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
                      href="/student/dashboard"
                      className="inline-flex w-full sm:w-auto items-center justify-center rounded-full border border-slate-200 px-8 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={loading || departmentsLoading}
                      className="inline-flex w-full sm:w-auto items-center justify-center rounded-full bg-emerald-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Submitting..." : departmentsLoading ? "Loading data..." : "Submit Issue"}
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

function handlePhotoChangeFactory(
  setPhotoName: (name: string) => void,
  setPhotoPreview: (value: string | null) => void,
  showToast: (t: { message: string; variant?: "info" | "success" | "error" }) => void
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

function TextField({ id, label, description, placeholder, value, onChange, required, maxLength }: {
  id: string;
  label: string;
  description?: string;
  placeholder?: string;
  maxLength?: number;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id} label={label} required={required} description={description} />
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
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