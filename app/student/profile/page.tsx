"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { StudentSidebar } from "@/app/student/components/StudentSidebar";
import { StudentUserActions } from "@/app/student/components/StudentUserActions";
import { useToast } from "@/components/ToastProvider";
import { authFetch, clearAuth, loadAuth, saveAuth } from "@/lib/client-auth";

export default function StudentProfilePage() {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useMemo(() => loadAuth(), []);
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(
    auth?.user.name?.trim() || auth?.user.email || "Student"
  );
  const userEmail = auth?.user.email || "student@example.com";
  const userRole = auth?.user.role || "student";
  const showStudentIdField = userRole !== "faculty";
  const userInitials = getInitials(displayName);
  const userRoleLabel = formatRoleLabel(userRole);
  const defaultStudentId = (auth?.user.studentId || getStudentIdFromEmail(userEmail)).toUpperCase();
  const defaultCourse = (auth?.user.course || getCourseFromEmail(userEmail)).toUpperCase();
  const [studentId, setStudentId] = useState(defaultStudentId);
  const [institute, setInstitute] = useState(auth?.user.institute || "");
  const [course, setCourse] = useState(defaultCourse.toUpperCase());
  const [mobileNumber, setMobileNumber] = useState(auth?.user.mobileNumber || "");

  const [fullName, setFullName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [baselineProfile, setBaselineProfile] = useState(() => ({
    name: normalizeName(displayName),
    studentId: defaultStudentId.trim().toUpperCase(),
    institute: (auth?.user.institute || "").trim(),
    course: defaultCourse.trim().toUpperCase(),
    mobileNumber: normalizeMobile(auth?.user.mobileNumber || ""),
  }));

  const normalizedCurrentProfile = useMemo(() => ({
    name: normalizeName(fullName),
    studentId: studentId.trim().toUpperCase(),
    institute: institute.trim(),
    course: course.trim().toUpperCase(),
    mobileNumber: normalizeMobile(mobileNumber),
  }), [course, fullName, institute, mobileNumber, studentId]);

  const hasProfileChanges = useMemo(() => {
    if (normalizedCurrentProfile.name !== baselineProfile.name) return true;
    if (normalizedCurrentProfile.institute !== baselineProfile.institute) return true;
    if (normalizedCurrentProfile.course !== baselineProfile.course) return true;
    if (normalizedCurrentProfile.mobileNumber !== baselineProfile.mobileNumber) return true;
    if (showStudentIdField && normalizedCurrentProfile.studentId !== baselineProfile.studentId) return true;
    return false;
  }, [baselineProfile, normalizedCurrentProfile, showStudentIdField]);

  useEffect(() => {
    if (!auth) return;

    authFetch("/api/users/me", { method: "GET" }, auth.token)
      .then((response) => {
        const user = response?.user;
        if (!user) return;

        const liveName = user.name?.trim() || auth.user.name?.trim() || auth.user.email || "Student";
        const liveStudentId = (user.studentId || getStudentIdFromEmail(user.email || userEmail)).toUpperCase();
        const liveCourse = (user.course || getCourseFromEmail(user.email || userEmail)).toUpperCase();
        const liveInstitute = user.institute || "";
        const liveMobile = user.mobileNumber || "";

        setDisplayName(liveName);
        setFullName(liveName);
        setStudentId(liveStudentId);
        setInstitute(liveInstitute);
        setCourse(liveCourse);
        setMobileNumber(liveMobile);
        setBaselineProfile({
          name: normalizeName(liveName),
          studentId: liveStudentId,
          institute: liveInstitute.trim(),
          course: liveCourse,
          mobileNumber: normalizeMobile(liveMobile),
        });

        saveAuth({
          ...auth,
          user: {
            ...auth.user,
            name: liveName,
            studentId: liveStudentId || null,
            institute: liveInstitute || null,
            course: liveCourse || null,
            mobileNumber: liveMobile || null,
          },
        });
      })
      .catch(() => {
        // Keep locally available values if live fetch fails.
      });
  }, [auth, userEmail]);

  const handleSave = async () => {
    if (!auth) {
      showToast({ message: "Authentication expired. Please log in again.", variant: "error" });
      return;
    }

    const trimmedName = fullName.trim().replace(/\s+/g, " ");
    if (!trimmedName) {
      showToast({ message: "Full name cannot be empty.", variant: "error" });
      return;
    }

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      showToast({ message: "Full name must be between 2 and 80 characters.", variant: "error" });
      return;
    }

    if (!hasProfileChanges) {
      showToast({ message: "No profile changes to save.", variant: "info" });
      return;
    }

    const trimmedStudentId = studentId.trim().toUpperCase();
    const trimmedInstitute = institute.trim();
    const trimmedCourse = course.trim().toUpperCase();
    const trimmedMobile = mobileNumber.trim();
    const normalizedMobile = normalizeMobile(trimmedMobile);

    setSaving(true);

    if (trimmedInstitute.length > 120) {
      showToast({ message: "Institute name is too long.", variant: "error" });
      setSaving(false);
      return;
    }

    if (normalizedMobile && !/^\+?[0-9]{10,15}$/.test(normalizedMobile)) {
      showToast({ message: "Enter a valid mobile number (10 to 15 digits).", variant: "error" });
      setSaving(false);
      return;
    }

    const payload: {
      name: string;
      institute: string;
      course: string;
      mobileNumber: string;
      studentId?: string;
    } = {
      name: trimmedName,
      institute: trimmedInstitute,
      course: trimmedCourse,
      mobileNumber: normalizedMobile,
    };

    if (showStudentIdField) {
      payload.studentId = trimmedStudentId;
    }

    try {
      const response = await authFetch(
        "/api/users/me",
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        auth.token
      );

      const updatedName = response?.user?.name || trimmedName;
      const updatedStudentId = response?.user?.studentId ?? trimmedStudentId;
      const updatedInstitute = response?.user?.institute ?? trimmedInstitute;
      const updatedCourse = response?.user?.course ?? trimmedCourse;
      const updatedMobile = response?.user?.mobileNumber ?? normalizedMobile;
      setDisplayName(updatedName);
      setFullName(updatedName);
      setStudentId((updatedStudentId || trimmedStudentId).toUpperCase());
      setInstitute(updatedInstitute || "");
      setCourse((updatedCourse || trimmedCourse).toUpperCase());
      setMobileNumber(updatedMobile || "");
      setBaselineProfile({
        name: normalizeName(updatedName),
        studentId: (updatedStudentId || trimmedStudentId).toUpperCase(),
        institute: (updatedInstitute || "").trim(),
        course: (updatedCourse || trimmedCourse).toUpperCase(),
        mobileNumber: normalizeMobile(updatedMobile || ""),
      });
      saveAuth({
        ...auth,
        user: {
          ...auth.user,
          name: updatedName,
          studentId: updatedStudentId || null,
          institute: updatedInstitute || null,
          course: updatedCourse || null,
          mobileNumber: updatedMobile || null,
        },
      });
      showToast({ message: "Profile updated successfully.", variant: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile.";
      showToast({ message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    clearAuth();
    router.replace("/login");
  };

  const memberSince = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Protected allowedRoles={["student", "faculty"]}>
      <div className="min-h-screen bg-slate-50 flex">
        <StudentSidebar
          pathname={pathname}
          userName={displayName}
          initials={userInitials}
          roleLabel={userRoleLabel}
        />

        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur pl-16 pr-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Profile</h1>
              <p className="text-sm text-slate-500">Manage your account settings</p>
            </div>
            <StudentUserActions
              name={displayName}
              email={userEmail}
              initials={userInitials}
              className="w-full justify-end sm:w-auto"
              onSignOut={handleSignOut}
            />
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
              <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Personal Information</h2>
                    <p className="text-sm text-slate-500">Update your profile details</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col items-start gap-3 sm:mt-6 sm:flex-row sm:items-center sm:gap-4">
                  <div className="h-14 w-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-semibold">
                    {userInitials}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{displayName}</p>
                    <p className="text-sm text-slate-500">{userEmail}</p>
                    <span className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="profile-email" className="text-sm font-medium text-slate-700">Email</label>
                    <input
                      id="profile-email"
                      type="email"
                      value={userEmail}
                      disabled
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                    />
                    <p className="mt-1 text-xs text-slate-400">Email cannot be changed</p>
                  </div>

                  <div>
                    <label htmlFor="profile-full-name" className="text-sm font-medium text-slate-700">Full Name</label>
                    <input
                      id="profile-full-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={saving}
                      maxLength={80}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  {showStudentIdField ? (
                    <div>
                      <label htmlFor="profile-student-id" className="text-sm font-medium text-slate-700">Student ID</label>
                      <input
                        id="profile-student-id"
                        type="text"
                        value={studentId}
                        disabled
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                      />
                    </div>
                  ) : null}

                  <div>
                    <label htmlFor="profile-institute" className="text-sm font-medium text-slate-700">Institute</label>
                    <input
                      id="profile-institute"
                      type="text"
                      value={institute}
                      onChange={(e) => setInstitute(e.target.value)}
                      disabled={saving}
                      maxLength={120}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="profile-course" className="text-sm font-medium text-slate-700">Course</label>
                    <input
                      id="profile-course"
                      type="text"
                      value={course}
                      disabled
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="profile-mobile" className="text-sm font-medium text-slate-700">Mobile Number</label>
                    <input
                      id="profile-mobile"
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      disabled={saving}
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={16}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !hasProfileChanges}
                    className="inline-flex w-full sm:w-auto justify-center items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : hasProfileChanges ? "Save Changes" : "No Changes"}
                  </button>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-semibold text-slate-900">Account Information</h2>
                <div className="mt-5 space-y-4">
                  <div className="flex flex-col items-start gap-2 rounded-2xl border border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Account Status</p>
                      <p className="text-xs text-slate-500">Your account is active</p>
                    </div>
                    <span className="self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:self-auto">Active</span>
                  </div>
                  <div className="flex flex-col items-start gap-2 rounded-2xl border border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Member Since</p>
                      <p className="text-xs text-slate-500">{memberSince}</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </Protected>
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

function getStudentIdFromEmail(email: string) {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return "";
  return email.slice(0, atIndex).toUpperCase();
}

function getCourseFromEmail(email: string) {
  const atIndex = email.indexOf("@");
  const localPart = atIndex > 0 ? email.slice(0, atIndex).toLowerCase() : email.toLowerCase();
  if (localPart.includes("cs")) return "CSE";
  if (localPart.includes("ce")) return "CE";
  if (localPart.includes("it")) return "IT";
  return "";
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeMobile(value: string) {
  return value.replace(/\s+/g, "").trim();
}
