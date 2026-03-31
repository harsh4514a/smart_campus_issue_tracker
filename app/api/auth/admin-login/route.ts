import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import "@/models/Department";
import { signToken } from "@/lib/auth";
import { DEMO_CREDENTIALS, ensureDemoUsers } from "@/lib/demo-users";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "harshpatel1753@gmail.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function resolveNonPrimaryAdminRole(role: unknown): "super_admin" | "dept_admin" | "worker" {
  if (role === "super_admin" || role === "dept_admin" || role === "worker") {
    return role;
  }
  // Never escalate unknown admin roles to super_admin.
  return "worker";
}

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

    if (isDemoAdminLogin) {
      const demoAdminUser = await User.findOne({ email: DEMO_CREDENTIALS.admin.email })
        .populate("department")
        .populate("academicDepartment")
        .populate("serviceDepartment");

      if (!demoAdminUser || demoAdminUser.role !== "admin") {
        return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
      }

      if (demoAdminUser.isActive === false) {
        return NextResponse.json({ message: "Account is inactive. Please contact super admin." }, { status: 403 });
      }

      const token = signToken({
        userId: demoAdminUser._id.toString(),
        role: "admin",
        adminRole: demoAdminUser.adminRole ?? "super_admin",
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
          adminRole: demoAdminUser.adminRole ?? "super_admin",
          emailNotificationsEnabled: demoAdminUser.emailNotificationsEnabled !== false,
          isDemoUser: Boolean(demoAdminUser.isDemoUser),
          department: demoAdminUser.department,
          studentId: demoAdminUser.studentId ?? null,
          institute: demoAdminUser.institute ?? null,
          course: demoAdminUser.course ?? null,
          mobileNumber: demoAdminUser.mobileNumber ?? null,
        },
      });
    }

    // Allow any persisted admin user (including dept_admin/worker) to log in.
    if (!isMainAdminLogin) {
      const adminUser = await User.findOne({ email: normalizedEmail, role: "admin" })
        .populate("department")
        .populate("academicDepartment")
        .populate("serviceDepartment");

      if (!adminUser) {
        return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
      }

      if (adminUser.isActive === false) {
        return NextResponse.json({ message: "Account is inactive. Please contact super admin." }, { status: 403 });
      }

      const isMatch = await adminUser.comparePassword(String(password));
      if (!isMatch) {
        return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
      }

      const resolvedAdminRole = resolveNonPrimaryAdminRole(adminUser.adminRole);

      const token = signToken({
        userId: adminUser._id.toString(),
        role: "admin",
        adminRole: resolvedAdminRole,
        departmentId: adminUser.department ? String(adminUser.department) : null,
      });

      return NextResponse.json({
        message: "Login successful",
        token,
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          adminRole: resolvedAdminRole,
          emailNotificationsEnabled: adminUser.emailNotificationsEnabled !== false,
          isDemoUser: Boolean(adminUser.isDemoUser),
          department: adminUser.department,
          academicDepartment: adminUser.academicDepartment,
          serviceDepartment: adminUser.serviceDepartment,
          studentId: adminUser.studentId ?? null,
          institute: adminUser.institute ?? null,
          course: adminUser.course ?? null,
          mobileNumber: adminUser.mobileNumber ?? null,
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
        adminRole: "super_admin",
        emailNotificationsEnabled: true,
        department: null,
      });
      adminUser = await User.findById(adminUser._id).populate("department");
    } else {
      let shouldSave = false;

      if (adminUser.role !== "admin") {
        adminUser.role = "admin";
        shouldSave = true;
      }

      // Primary admin credentials must always map to super_admin.
      if (adminUser.adminRole !== "super_admin") {
        adminUser.adminRole = "super_admin";
        shouldSave = true;
      }

      if (adminUser.department) {
        adminUser.department = null;
        shouldSave = true;
      }

      if (adminUser.isDemoUser) {
        adminUser.isDemoUser = false;
        shouldSave = true;
      }

      if (shouldSave) {
        await adminUser.save();
      }
    }

    if (!adminUser) {
      return NextResponse.json({ message: "Failed to create admin user." }, { status: 500 });
    }

    const token = signToken({
      userId: adminUser._id.toString(),
      role: "admin",
      adminRole: "super_admin",
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
        adminRole: "super_admin",
        emailNotificationsEnabled: adminUser.emailNotificationsEnabled !== false,
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
