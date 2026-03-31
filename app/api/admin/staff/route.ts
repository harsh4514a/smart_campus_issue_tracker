import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";
import Department from "@/models/Department";
import { getAdminDepartmentIds, isDeptAdmin, isSuperAdmin } from "@/lib/rbac";
import { sendPasswordSetupEmail } from "@/lib/mailer";
import { signPasswordSetupToken } from "@/lib/password-setup";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const isSuper = isSuperAdmin(auth.user);
  const isDept = isDeptAdmin(auth.user);

  if (!isSuper && !isDept) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const includeAdminRoles = new URL(request.url).searchParams.get("includeAdminRoles") === "1";

  const query: Record<string, unknown> = isSuper
    ? includeAdminRoles
      ? {
          $or: [
            { role: "staff" },
            { role: "admin", adminRole: { $in: ["dept_admin", "worker"] } },
          ],
        }
      : { role: "staff" }
    : {
        role: "staff",
        $or: [
          { department: { $in: getAdminDepartmentIds(auth.user) } },
          { academicDepartment: { $in: getAdminDepartmentIds(auth.user) } },
          { serviceDepartment: { $in: getAdminDepartmentIds(auth.user) } },
        ],
      };

  if (process.env.NODE_ENV === "production") {
    query.isDemoUser = { $ne: true };
  }

  const staff = await User.find(query)
    .populate("department")
    .populate("academicDepartment")
    .populate("serviceDepartment")
    .populate("managedDepartments")
    .sort({ name: 1 });
  return NextResponse.json({ faculty: staff });
}

export async function POST(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const { name, email, departmentId, academicDepartmentId, academicDepartmentIds, serviceDepartmentId } = await request.json();

    if (!name || !email) {
      return NextResponse.json({ message: "Name and email are required." }, { status: 400 });
    }

    const normalizedAcademicDepartmentId =
      typeof academicDepartmentId === "string" && academicDepartmentId.trim().length > 0
        ? academicDepartmentId
        : null;
    const normalizedAcademicDepartmentIds = Array.isArray(academicDepartmentIds)
      ? academicDepartmentIds
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
    const normalizedServiceDepartmentId =
      typeof serviceDepartmentId === "string" && serviceDepartmentId.trim().length > 0
        ? serviceDepartmentId
        : null;
    const normalizedDepartmentId =
      typeof departmentId === "string" && departmentId.trim().length > 0
        ? departmentId
        : null;

    if (
      !normalizedAcademicDepartmentId &&
      normalizedAcademicDepartmentIds.length === 0 &&
      !normalizedServiceDepartmentId &&
      !normalizedDepartmentId
    ) {
      return NextResponse.json(
        { message: "At least one department selection is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
    }

    let academicDept = null;
    let serviceDept = null;
    const managedAcademicDeptIds: string[] = [];

    const mergedAcademicIds = Array.from(
      new Set([
        ...normalizedAcademicDepartmentIds,
        ...(normalizedAcademicDepartmentId ? [normalizedAcademicDepartmentId] : []),
      ])
    );

    if (mergedAcademicIds.length > 0) {
      const selectedAcademicDepartments = await Department.find({ _id: { $in: mergedAcademicIds } });
      if (selectedAcademicDepartments.length !== mergedAcademicIds.length) {
        return NextResponse.json({ message: "One or more academic departments not found." }, { status: 404 });
      }

      for (const selectedDepartment of selectedAcademicDepartments) {
        if (selectedDepartment.type === "Service") {
          serviceDept = serviceDept || selectedDepartment;
          continue;
        }

        managedAcademicDeptIds.push(String(selectedDepartment._id));
      }

      if (managedAcademicDeptIds.length > 0) {
        academicDept = selectedAcademicDepartments.find((department) => String(department._id) === managedAcademicDeptIds[0]) || null;
      }
    }

    if (normalizedAcademicDepartmentId && mergedAcademicIds.length === 0) {
      const selectedAcademicDepartment = await Department.findById(normalizedAcademicDepartmentId);
      if (!selectedAcademicDepartment) {
        return NextResponse.json({ message: "Academic department not found." }, { status: 404 });
      }

      if (selectedAcademicDepartment.type === "Academic") {
        academicDept = selectedAcademicDepartment;
      } else if (selectedAcademicDepartment.type === "Service") {
        serviceDept = selectedAcademicDepartment;
      } else {
        academicDept = selectedAcademicDepartment;
      }
    }

    if (normalizedServiceDepartmentId) {
      const selectedServiceDepartment = await Department.findById(normalizedServiceDepartmentId);
      if (!selectedServiceDepartment) {
        return NextResponse.json({ message: "Service department not found." }, { status: 404 });
      }

      if (selectedServiceDepartment.type === "Service") {
        serviceDept = selectedServiceDepartment;
      } else if (selectedServiceDepartment.type === "Academic") {
        academicDept = selectedServiceDepartment;
      } else {
        serviceDept = selectedServiceDepartment;
      }
    }

    let legacyDepartment = null;
    if (!academicDept && !serviceDept && normalizedDepartmentId) {
      legacyDepartment = await Department.findById(normalizedDepartmentId);
      if (!legacyDepartment) return NextResponse.json({ message: "Department not found." }, { status: 404 });
      if (legacyDepartment.type === "Academic") {
        academicDept = legacyDepartment;
      } else if (legacyDepartment.type === "Service") {
        serviceDept = legacyDepartment;
      }
    }

    if (!academicDept && !serviceDept) {
      return NextResponse.json(
        { message: "Unable to map selected departments. Please reselect departments and try again." },
        { status: 400 }
      );
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return NextResponse.json({ message: "Email already registered." }, { status: 409 });

    const temporaryPassword = `${randomBytes(24).toString("hex")}Aa1!`;

    const user = new User({
      name,
      email: normalizedEmail,
      password: temporaryPassword,
      role: "staff",
      adminRole: null,
      department: serviceDept?._id || academicDept?._id || null,
      academicDepartment: academicDept?._id || null,
      serviceDepartment: serviceDept?._id || null,
      managedDepartments: managedAcademicDeptIds,
    });
    await user.save();

    const token = signPasswordSetupToken({
      userId: String(user._id),
      email: normalizedEmail,
      purpose: "staff-password-setup",
    });
    const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const setupUrl = `${appBaseUrl.replace(/\/$/, "")}/set-password?token=${encodeURIComponent(token)}`;
    await sendPasswordSetupEmail(normalizedEmail, name, setupUrl);

    return NextResponse.json(
      { message: "Staff member created. Email sent for password setup.", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create staff error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}