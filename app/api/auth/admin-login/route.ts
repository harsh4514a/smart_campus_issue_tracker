import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import "@/models/Department";
import { signToken } from "@/lib/auth";

const ADMIN_EMAIL = "admin@campustracker.com";
const ADMIN_PASSWORD = "admin123";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    if (String(email).trim().toLowerCase() !== ADMIN_EMAIL || String(password) !== ADMIN_PASSWORD) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    await connectDB();

    let adminUser = await User.findOne({ email: ADMIN_EMAIL }).populate("department");

    if (!adminUser) {
      adminUser = await User.create({
        name: "Admin",
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: "admin",
        department: null,
      });
      adminUser = await User.findById(adminUser._id).populate("department");
    } else if (adminUser.role !== "admin") {
      adminUser.role = "admin";
      await adminUser.save();
    }

    if (!adminUser) {
      return NextResponse.json({ message: "Failed to create admin user." }, { status: 500 });
    }

    const token = signToken({
      userId: adminUser._id.toString(),
      role: "admin",
      departmentId: null,
    });

    return NextResponse.json({
      message: "Login successful",
      token,
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        department: adminUser.department,
        studentId: adminUser.studentId ?? null,
        institute: adminUser.institute ?? null,
        course: adminUser.course ?? null,
        mobileNumber: adminUser.mobileNumber ?? null,
      },
    });
  } catch (error) {
    console.error("Admin login error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
