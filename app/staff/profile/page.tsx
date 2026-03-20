"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { authFetch, loadAuth, saveAuth } from "@/lib/client-auth";

type ProfileFormState = {
  name: string;
  email: string;
  mobileNumber: string;
};

export default function StaffProfilePage() {
  const auth = loadAuth();
  const { showToast } = useToast();
  const [academicDepartment, setAcademicDepartment] = useState("—");
  const [serviceDepartment, setServiceDepartment] = useState("—");

  const initialState = useMemo<ProfileFormState>(() => {
    return {
      name: auth?.user?.name || "",
      email: auth?.user?.email || "",
      mobileNumber: auth?.user?.mobileNumber || "",
    };
  }, [auth?.user?.email, auth?.user?.mobileNumber, auth?.user?.name]);

  const [form, setForm] = useState<ProfileFormState>(initialState);
  const [saving, setSaving] = useState(false);

  const initials = useMemo(() => {
    const name = form.name || "Staff";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [form.name]);

  useEffect(() => {
    const currentAuth = loadAuth();
    if (!currentAuth) return;

    setAcademicDepartment(resolveDepartmentName(currentAuth.user.academicDepartment));
    setServiceDepartment(resolveDepartmentName(currentAuth.user.serviceDepartment));

    authFetch("/api/users/me", { method: "GET" }, currentAuth.token)
      .then((response) => {
        const user = response?.user;
        setForm((prev) => ({
          ...prev,
          name: user?.name || prev.name,
          email: user?.email || prev.email,
          mobileNumber: user?.mobileNumber || "",
        }));
        setAcademicDepartment(resolveDepartmentName(user?.academicDepartment));
        setServiceDepartment(resolveDepartmentName(user?.serviceDepartment));

        saveAuth({
          ...currentAuth,
          user: {
            ...currentAuth.user,
            name: user?.name || currentAuth.user.name,
            email: user?.email || currentAuth.user.email,
            mobileNumber: user?.mobileNumber || null,
            academicDepartment: user?.academicDepartment || currentAuth.user.academicDepartment || null,
            serviceDepartment: user?.serviceDepartment || currentAuth.user.serviceDepartment || null,
          },
        }, "session");
      })
      .catch(() => {
        // keep local values when fetch fails
      });
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const currentAuth = loadAuth();
    if (!currentAuth) return;

    setSaving(true);

    try {
      const response = await authFetch(
        "/api/users/me",
        {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name,
            mobileNumber: form.mobileNumber,
          }),
        },
        currentAuth.token
      );

      const updatedAuth = {
        ...currentAuth,
        user: {
          ...currentAuth.user,
          name: response?.user?.name ?? form.name,
          mobileNumber: response?.user?.mobileNumber ?? form.mobileNumber,
        },
      };

      saveAuth(updatedAuth, "session");
      showToast({
        title: "Success",
        message: "Profile updated successfully.",
        variant: "success",
      });
    } catch (err: unknown) {
      showToast({
        title: "Update failed",
        message: err instanceof Error ? err.message : "Failed to update profile",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Personal Information</h2>
              <p className="text-sm text-slate-500">Update your profile details</p>
            </div>

            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                {initials}
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">{form.name || "Staff User"}</p>
                <p className="text-sm text-slate-500">{form.email}</p>
                <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  Staff
                </span>
              </div>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
                  disabled
                />
              </Field>
              <p className="-mt-3 text-xs text-slate-400">Email cannot be changed</p>

              <Field label="Full Name">
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                  required
                />
              </Field>

              <Field label="Academic Department">
                <input
                  type="text"
                  value={academicDepartment}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
                  disabled
                />
              </Field>

              <Field label="Service Department">
                <input
                  type="text"
                  value={serviceDepartment}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
                  disabled
                />
              </Field>

              <Field label="Mobile Number">
                <input
                  type="tel"
                  value={form.mobileNumber}
                  onChange={(event) => setForm((prev) => ({ ...prev, mobileNumber: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                  placeholder="Enter mobile number"
                />
              </Field>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Account Information</h2>

            <div className="mt-4 space-y-3">
              <InfoCard label="Account Status" value="Active" helper="Your account is active" tone="green" />
              <InfoCard
                label="Access Scope"
                value={academicDepartment !== "—" || serviceDepartment !== "—" ? "Department Based" : "General"}
                helper="Access is restricted to assigned staff issues"
                tone="slate"
              />
            </div>
          </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function resolveDepartmentName(value: unknown) {
  if (!value) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "name" in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name;
    }
  }
  return "—";
}

function InfoCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "green" | "slate";
}) {
  const toneClass = tone === "green" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-xl border border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          <p className="text-xs text-slate-400">{helper}</p>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{value}</span>
      </div>
    </div>
  );
}
