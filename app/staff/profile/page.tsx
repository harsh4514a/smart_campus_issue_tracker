"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, Lock, ShieldCheck, Timer } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { authFetch, loadAuth, saveAuth } from "@/lib/client-auth";
import { getSlaMeta } from "@/components/staff/issue-utils";
import { useStaffIssues } from "@/components/staff/useStaffIssues";

type ProfileFormState = {
  name: string;
  email: string;
  mobileNumber: string;
  avatarUrl: string;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function StaffProfilePage() {
  const auth = loadAuth();
  const { showToast } = useToast();
  const { issues } = useStaffIssues({ enablePolling: false });

  const [academicDepartment, setAcademicDepartment] = useState("-");
  const [serviceDepartment, setServiceDepartment] = useState("-");
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const initialState = useMemo<ProfileFormState>(() => {
    return {
      name: auth?.user?.name || "",
      email: auth?.user?.email || "",
      mobileNumber: auth?.user?.mobileNumber || "",
      avatarUrl: auth?.user?.avatarUrl || "",
    };
  }, [auth?.user?.avatarUrl, auth?.user?.email, auth?.user?.mobileNumber, auth?.user?.name]);

  const [form, setForm] = useState<ProfileFormState>(initialState);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const initials = useMemo(() => {
    const name = form.name || "Staff";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [form.name]);

  const performance = useMemo(() => {
    const totalAssigned = issues.length;
    const resolved = issues.filter((issue) => issue.status === "Resolved").length;
    const active = issues.filter((issue) => issue.status !== "Resolved" && issue.status !== "Rejected").length;
    const overdueOpen = issues.filter((issue) => issue.status !== "Resolved" && getSlaMeta(issue).isOverdue).length;
    const resolvedWithinSla = issues.filter(
      (issue) => issue.status === "Resolved" && !getSlaMeta(issue).isOverdue
    ).length;

    const slaCompliance = resolved > 0 ? Math.round((resolvedWithinSla / resolved) * 100) : 100;

    return {
      totalAssigned,
      resolved,
      active,
      overdueOpen,
      slaCompliance,
    };
  }, [issues]);

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
          avatarUrl: user?.avatarUrl || "",
        }));
        setAcademicDepartment(resolveDepartmentName(user?.academicDepartment));
        setServiceDepartment(resolveDepartmentName(user?.serviceDepartment));

        saveAuth(
          {
            ...currentAuth,
            user: {
              ...currentAuth.user,
              name: user?.name || currentAuth.user.name,
              email: user?.email || currentAuth.user.email,
              avatarUrl: user?.avatarUrl || currentAuth.user.avatarUrl || null,
              mobileNumber: user?.mobileNumber || null,
              academicDepartment: user?.academicDepartment || currentAuth.user.academicDepartment || null,
              serviceDepartment: user?.serviceDepartment || currentAuth.user.serviceDepartment || null,
            },
          },
          "session"
        );
      })
      .catch(() => {
        // Keep local values when fetch fails.
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
            avatarUrl: form.avatarUrl,
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
          avatarUrl: response?.user?.avatarUrl ?? form.avatarUrl,
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

  const onAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError("Please upload a valid image file.");
      return;
    }

    const maxSizeMb = 1;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setAvatarError(`Avatar must be smaller than ${maxSizeMb} MB.`);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((prev) => ({ ...prev, avatarUrl: dataUrl }));
      setAvatarError(null);
    } catch {
      setAvatarError("Failed to read image. Please try another file.");
    }
  };

  const onChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const currentAuth = loadAuth();
    if (!currentAuth) return;

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showToast({ title: "Missing fields", message: "Please fill all password fields.", variant: "error" });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      showToast({
        title: "Weak password",
        message: "New password must be at least 8 characters.",
        variant: "error",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast({ title: "Password mismatch", message: "Confirm password does not match.", variant: "error" });
      return;
    }

    setChangingPassword(true);
    try {
      await authFetch(
        "/api/users/change-password",
        {
          method: "POST",
          body: JSON.stringify(passwordForm),
        },
        currentAuth.token
      );

      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showToast({ title: "Password changed", message: "Your password has been updated.", variant: "success" });
    } catch (err: unknown) {
      showToast({
        title: "Password update failed",
        message: err instanceof Error ? err.message : "Failed to change password",
        variant: "error",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const isDemoUser = auth?.user?.isDemoUser === true;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Personal Information</h2>
          <p className="text-sm text-slate-500">Update your profile details</p>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-emerald-100 text-lg font-semibold text-emerald-700">
              {form.avatarUrl ? (
                <Image src={form.avatarUrl} alt="Profile avatar" width={80} height={80} className="h-full w-full object-cover" unoptimized />
              ) : (
                initials
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
              <Camera className="h-3.5 w-3.5" />
              <input type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} />
            </label>
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">{form.name || "Staff User"}</p>
            <p className="text-sm text-slate-500">{form.email}</p>
            <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Staff
            </span>
            {avatarError ? <p className="mt-1 text-xs text-rose-600">{avatarError}</p> : null}
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
        <h2 className="text-xl font-semibold text-slate-900">Performance Snapshot</h2>
        <p className="text-sm text-slate-500">Operational metrics based on your assigned issues</p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Resolved" value={String(performance.resolved)} tone="green" />
          <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="On-time Completion" value={`${performance.slaCompliance}%`} tone="teal" />
          <StatCard icon={<Timer className="h-4 w-4" />} label="Open Issues" value={String(performance.active)} tone="amber" />
          <StatCard icon={<Lock className="h-4 w-4" />} label="Overdue Open" value={String(performance.overdueOpen)} tone="rose" />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Change Password</h2>
        <p className="text-sm text-slate-500">Use a strong password and keep your account secure</p>

        {isDemoUser ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Demo accounts are view-only. Password changes are disabled.
          </p>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={onChangePassword}>
            <Field label="Current Password">
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                required
              />
            </Field>

            <Field label="New Password">
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                required
              />
            </Field>

            <Field label="Confirm New Password">
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                required
              />
            </Field>

            <button
              type="submit"
              disabled={changingPassword}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {changingPassword ? "Updating..." : "Change Password"}
            </button>
          </form>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Account Information</h2>

        <div className="mt-4 space-y-3">
          <InfoCard label="Account Status" value="Active" helper="Your account is active" tone="green" />
          <InfoCard
            label="Access Scope"
            value={academicDepartment !== "-" || serviceDepartment !== "-" ? "Department Based" : "General"}
            helper="Access is restricted to assigned staff issues"
            tone="slate"
          />
          <InfoCard
            label="Assigned Issues"
            value={String(performance.totalAssigned)}
            helper="Total issues currently mapped to your account"
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
  if (!value) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "name" in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name;
    }
  }
  return "-";
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "green" | "teal" | "amber" | "rose";
}) {
  const toneClass: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass[tone]}`}>
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none">{value}</p>
    </div>
  );
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };

    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
