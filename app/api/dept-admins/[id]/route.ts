import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac";
import User from "@/models/User";
import Department from "@/models/Department";
import { sendPasswordSetupEmail } from "@/lib/mailer";
import { signPasswordSetupToken } from "@/lib/password-setup";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type DepartmentLite = {
  _id: string;
  name: string;
  type?: "Academic" | "Service";
};

type DeptAdminUser = {
  _id: string;
  name?: string;
  email?: string;
  designation?: string | null;
  isActive?: boolean;
  createdAt?: string;
  department?: DepartmentLite | null;
  academicDepartment?: DepartmentLite | null;
  serviceDepartment?: DepartmentLite | null;
  managedDepartments?: DepartmentLite[];
};

function normalizeDepartments(user: DeptAdminUser) {
  const candidates = [
    ...(Array.isArray(user.managedDepartments) ? user.managedDepartments : []),
    user.academicDepartment,
    user.serviceDepartment,
    user.department,
  ].filter(Boolean) as DepartmentLite[];

  const seen = new Set<string>();
  const departments: DepartmentLite[] = [];

  for (const department of candidates) {
    const id = String(department._id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    departments.push({
      _id: id,
      name: department.name,
      type: department.type,
    });
  }

  return departments;
}

function toResponse(user: DeptAdminUser) {
  return {
    _id: String(user._id),
    name: user.name || "",
    email: user.email || "",
    designation: user.designation || "",
    isActive: user.isActive !== false,
    createdAt: user.createdAt || null,
    departments: normalizeDepartments(user),
  };
}

export async function PUT(request: Request, context: RouteContext) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const designation = String(body?.designation || "").trim();
    const isActive = body?.isActive !== false;
    const departmentIds = Array.isArray(body?.departmentIds)
      ? body.departmentIds.map((value: unknown) => String(value || "").trim()).filter(Boolean)
      : [];

    const uniqueDepartmentIds = Array.from(new Set(departmentIds));

    if (!name || !email) {
      return NextResponse.json({ message: "Name and email are required." }, { status: 400 });
    }

    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
    }

    if (uniqueDepartmentIds.length < 1) {
      return NextResponse.json({ message: "Select at least one department." }, { status: 400 });
    }

    const existingEmail = await User.findOne({ _id: { $ne: id }, email }).select("_id").lean();
    if (existingEmail) {
      return NextResponse.json({ message: "Email already registered." }, { status: 409 });
    }

    const existingAdmin = await User.findOne({ _id: id, role: "admin", adminRole: "dept_admin" })
      .select("_id email name")
      .lean();

    if (!existingAdmin) {
      return NextResponse.json({ message: "Department admin not found." }, { status: 404 });
    }

    const previousEmail = String(existingAdmin.email || "").trim().toLowerCase();
    const emailChanged = previousEmail !== email;

    const departments = await Department.find({
      _id: { $in: uniqueDepartmentIds },
      type: "Academic",
    }).lean();
    if (departments.length !== uniqueDepartmentIds.length) {
      return NextResponse.json(
        { message: "Only academic departments are allowed." },
        { status: 400 }
      );
    }

    const firstAcademic = departments.find((department) => department.type === "Academic") || null;

    const updateData: Record<string, unknown> = {
      name,
      email,
      designation: designation || null,
      isActive,
      managedDepartments: uniqueDepartmentIds,
      department: firstAcademic?._id || uniqueDepartmentIds[0],
      academicDepartment: firstAcademic?._id || null,
      serviceDepartment: null,
    };

    const updated = await User.findOneAndUpdate(
      { _id: id, role: "admin", adminRole: "dept_admin" },
      updateData,
      { new: true, runValidators: true }
    )
      .populate("department")
      .populate("academicDepartment")
      .populate("serviceDepartment")
      .populate("managedDepartments")
      .lean();

    if (!updated) {
      return NextResponse.json({ message: "Department admin not found." }, { status: 404 });
    }

    if (emailChanged) {
      const token = signPasswordSetupToken({ userId: id, email });
      const appBaseUrl =
        process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const setupUrl = `${appBaseUrl.replace(/\/$/, "")}/set-password?token=${encodeURIComponent(token)}`;

      await sendPasswordSetupEmail(email, name, setupUrl);
    }

    return NextResponse.json({
      message: emailChanged
        ? "Department admin updated. Password setup email sent to the updated email address."
        : "Department admin updated successfully.",
      admin: toResponse(updated as unknown as DeptAdminUser),
    });
  } catch (error) {
    console.error("Update dept admin error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  await connectDB();
  const auth = await authenticateRequest(_request, ["admin"]);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const deleted = await User.findOneAndDelete({ _id: id, role: "admin", adminRole: "dept_admin" })
      .select("_id")
      .lean();

    if (!deleted) {
      return NextResponse.json({ message: "Department admin not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Department admin deleted successfully." });
  } catch (error) {
    console.error("Delete dept admin error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
