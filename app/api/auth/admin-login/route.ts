import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import "@/models/Department";
import { signToken } from "@/lib/auth";
import { DEMO_CREDENTIALS, ensureDemoUsers } from "@/lib/demo-users";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@campustracker.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    await connectDB();
    await ensureDemoUsers();

    const isMainAdminLogin = normalizedEmail === ADMIN_EMAIL && String(password) === ADMIN_PASSWORD;
    const isDemoAdminLogin =
      normalizedEmail === DEMO_CREDENTIALS.admin.email && String(password) === DEMO_CREDENTIALS.admin.password;

    if (!isMainAdminLogin && !isDemoAdminLogin) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    if (isDemoAdminLogin) {
      const demoAdminUser = await User.findOne({ email: DEMO_CREDENTIALS.admin.email })
        .populate("department")
        .populate("academicDepartment")
        .populate("serviceDepartment");

      if (!demoAdminUser || demoAdminUser.role !== "admin") {
        return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
      }

      const token = signToken({
        userId: demoAdminUser._id.toString(),
        role: "admin",
        departmentId: null,
      });

      return NextResponse.json({
        message: "Login successful",
        token,
        user: {
          id: demoAdminUser._id,
          name: demoAdminUser.name,
          email: demoAdminUser.email,
          role: demoAdminUser.role,
          isDemoUser: Boolean(demoAdminUser.isDemoUser),
          department: demoAdminUser.department,
          studentId: demoAdminUser.studentId ?? null,
          institute: demoAdminUser.institute ?? null,
          course: demoAdminUser.course ?? null,
          mobileNumber: demoAdminUser.mobileNumber ?? null,
        },
      });
    }

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
    } else if (adminUser.isDemoUser) {
      adminUser.isDemoUser = false;
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
        isDemoUser: Boolean(adminUser.isDemoUser),
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
