import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";
import Department from "@/models/Department";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const staff = await User.find({ role: "staff" })
    .populate("department")
    .populate("academicDepartment")
    .populate("serviceDepartment")
    .sort({ name: 1 });
  return NextResponse.json({ faculty: staff });
}

export async function POST(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  try {
    const { name, email, password, departmentId, academicDepartmentId, serviceDepartmentId } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Name, email, and password are required." }, { status: 400 });
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

  const user = new User({
      name,
      email: normalizedEmail,
      password,
      role: "staff",
      department: serviceDept?._id || academicDept?._id || null,
      academicDepartment: academicDept?._id || null,
      serviceDepartment: serviceDept?._id || null,
    });
    await user.save();

    return NextResponse.json({ message: "Staff member created", user }, { status: 201 });
  } catch (error) {
    console.error("Create staff error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}