import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import "@/models/Department"; 
import { signToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, password } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    const user = await User.findOne({ email: normalizedEmail })
      .populate("department")
      .populate("academicDepartment")
      .populate("serviceDepartment");
    if (!user) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    // Admin account must authenticate only through /api/auth/admin-login.
    if (user.role === "admin") {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
      departmentId: user.department ? user.department.toString() : null,
    });

    return NextResponse.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        academicDepartment: user.academicDepartment,
        serviceDepartment: user.serviceDepartment,
        studentId: user.studentId ?? null,
        institute: user.institute ?? null,
        course: user.course ?? null,
        mobileNumber: user.mobileNumber ?? null,
      },
    });
  } catch (error) {
    console.error("Login error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}