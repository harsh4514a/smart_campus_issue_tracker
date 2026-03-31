import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";
import Department from "@/models/Department";
import { isSuperAdmin } from "@/lib/rbac";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
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

    if (!academicDept && !serviceDept && normalizedDepartmentId) {
      const legacyDepartment = await Department.findById(normalizedDepartmentId);
      if (!legacyDepartment) {
        return NextResponse.json({ message: "Department not found." }, { status: 404 });
      }
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

    const existingUser = await User.findOne({
      _id: { $ne: id },
      email: normalizedEmail,
    });

    if (existingUser) {
      return NextResponse.json({ message: "Email already registered." }, { status: 409 });
    }

    const existingAccount = await User.findOne({
      _id: id,
      role: "staff",
    })
      .select("_id email")
      .lean();

    if (!existingAccount) {
      return NextResponse.json({ message: "Account not found." }, { status: 404 });
    }

    const previousEmail = String(existingAccount.email || "").trim().toLowerCase();
    const emailChanged = previousEmail !== normalizedEmail;

    await User.collection.updateOne(
      { _id: existingAccount._id },
      {
        $set: {
          name: String(name).trim(),
          email: normalizedEmail,
          role: "staff",
          adminRole: null,
          department: serviceDept?._id || academicDept?._id || null,
          academicDepartment: academicDept?._id || null,
          serviceDepartment: serviceDept?._id || null,
          managedDepartments: managedAcademicDeptIds,
        },
      }
    );

    const staff = await User.findById(existingAccount._id)
      .populate("department")
      .populate("academicDepartment")
      .populate("serviceDepartment")
      .populate("managedDepartments");

    if (emailChanged) {
      const [{ signPasswordSetupToken }, { sendPasswordSetupEmail }] = await Promise.all([
        import("@/lib/password-setup"),
        import("@/lib/mailer"),
      ]);
      const token = signPasswordSetupToken({
        userId: String(existingAccount._id),
        email: normalizedEmail,
        purpose: "staff-password-setup",
      });
      const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const setupUrl = `${appBaseUrl.replace(/\/$/, "")}/set-password?token=${encodeURIComponent(token)}`;
      await sendPasswordSetupEmail(normalizedEmail, String(name).trim(), setupUrl);
    }

    return NextResponse.json({
      message: emailChanged
        ? "Staff member updated. Password setup email sent to the updated email address."
        : "Staff member updated",
      staff,
    });
  } catch (error) {
    console.error("Update staff error", error);
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
    const staff = await User.findOneAndDelete({
      _id: id,
      role: "staff",
    });

    if (!staff) {
      return NextResponse.json({ message: "Staff member not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Staff member deleted" });
  } catch (error) {
    console.error("Delete staff error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
