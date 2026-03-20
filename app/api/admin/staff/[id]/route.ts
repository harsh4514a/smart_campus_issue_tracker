import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";
import Department from "@/models/Department";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await context.params;
    const { name, email, departmentId, academicDepartmentId, serviceDepartmentId } = await request.json();

    if (!name || !email) {
      return NextResponse.json({ message: "Name and email are required." }, { status: 400 });
    }

    const normalizedAcademicDepartmentId =
      typeof academicDepartmentId === "string" && academicDepartmentId.trim().length > 0
        ? academicDepartmentId
        : null;
    const normalizedServiceDepartmentId =
      typeof serviceDepartmentId === "string" && serviceDepartmentId.trim().length > 0
        ? serviceDepartmentId
        : null;
    const normalizedDepartmentId =
      typeof departmentId === "string" && departmentId.trim().length > 0
        ? departmentId
        : null;

    if (!normalizedAcademicDepartmentId && !normalizedServiceDepartmentId && !normalizedDepartmentId) {
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

    if (normalizedAcademicDepartmentId) {
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

    const existingStaff = await User.findOne({ _id: id, role: "staff" }).select("_id").lean();
    if (!existingStaff) {
      return NextResponse.json({ message: "Staff member not found." }, { status: 404 });
    }

    await User.collection.updateOne(
      { _id: existingStaff._id },
      {
        $set: {
          name: String(name).trim(),
          email: normalizedEmail,
          department: serviceDept?._id || academicDept?._id || null,
          academicDepartment: academicDept?._id || null,
          serviceDepartment: serviceDept?._id || null,
        },
      }
    );

    const staff = await User.findById(existingStaff._id)
      .populate("department")
      .populate("academicDepartment")
      .populate("serviceDepartment");

    return NextResponse.json({ message: "Staff member updated", staff });
  } catch (error) {
    console.error("Update staff error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  await connectDB();
  const auth = await authenticateRequest(_request, ["admin"]);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await context.params;
    const staff = await User.findOneAndDelete({ _id: id, role: "staff" });

    if (!staff) {
      return NextResponse.json({ message: "Staff member not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Staff member deleted" });
  } catch (error) {
    console.error("Delete staff error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
