import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac";
import User from "@/models/User";
import Department from "@/models/Department";
import { randomBytes } from "crypto";
import { sendPasswordSetupEmail } from "@/lib/mailer";
import { signPasswordSetupToken } from "@/lib/password-setup";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function parsePage(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const search = (searchParams.get("search") || "").trim();
  const department = (searchParams.get("department") || "").trim();
  const status = (searchParams.get("status") || "all").trim().toLowerCase();
  const page = parsePage(searchParams.get("page"), 1);
  const limit = Math.min(parsePage(searchParams.get("limit"), 10), 50);
  const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
  const sortOrderRaw = (searchParams.get("sortOrder") || "desc").trim().toLowerCase();
  const sortOrder = sortOrderRaw === "asc" ? 1 : -1;

  const baseQuery: Record<string, unknown> = {
    role: "admin",
    adminRole: "dept_admin",
  };

  if (search) {
    baseQuery.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (status === "active") {
    baseQuery.isActive = true;
  } else if (status === "inactive") {
    baseQuery.isActive = false;
  }

  if (department) {
    const departmentScope = [
      { managedDepartments: department },
      { academicDepartment: department },
      { serviceDepartment: department },
      { department },
    ];

    if (Array.isArray(baseQuery.$or)) {
      baseQuery.$and = [{ $or: baseQuery.$or }, { $or: departmentScope }];
      delete baseQuery.$or;
    } else {
      baseQuery.$or = departmentScope;
    }
  }

  const sortFieldMap: Record<string, string> = {
    name: "name",
    email: "email",
    designation: "designation",
    status: "isActive",
    createdAt: "createdAt",
  };

  const sortField = sortFieldMap[sortBy] || "createdAt";
  const sortQuery: Record<string, 1 | -1> = { [sortField]: sortOrder as 1 | -1 };

  const [total, adminsRaw, statsRaw] = await Promise.all([
    User.countDocuments(baseQuery),
    User.find(baseQuery)
      .populate("department")
      .populate("academicDepartment")
      .populate("serviceDepartment")
      .populate("managedDepartments")
      .sort(sortQuery)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.aggregate([
      { $match: { role: "admin", adminRole: "dept_admin" } },
      {
        $group: {
          _id: "$isActive",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const admins = (adminsRaw as unknown as DeptAdminUser[]).map(toResponse);

  const stats = {
    total: 0,
    active: 0,
    inactive: 0,
  };

  for (const row of statsRaw as Array<{ _id: boolean | null; count: number }>) {
    stats.total += row.count;
    if (row._id === false) {
      stats.inactive += row.count;
    } else {
      stats.active += row.count;
    }
  }

  return NextResponse.json({
    admins,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    stats,
  });
}

export async function POST(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
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
      return NextResponse.json(
        { message: "Name and email are required." },
        { status: 400 }
      );
    }

    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
    }

    if (uniqueDepartmentIds.length < 1) {
      return NextResponse.json(
        { message: "Select at least one department." },
        { status: 400 }
      );
    }

    const existing = await User.findOne({ email }).select("_id").lean();
    if (existing) {
      return NextResponse.json({ message: "Email already registered." }, { status: 409 });
    }

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

    const temporaryPassword = `${randomBytes(24).toString("hex")}Aa1!`;

    const user = new User({
      name,
      email,
      password: temporaryPassword,
      role: "admin",
      adminRole: "dept_admin",
      isActive,
      designation: designation || null,
      managedDepartments: uniqueDepartmentIds,
      department: firstAcademic?._id || uniqueDepartmentIds[0],
      academicDepartment: firstAcademic?._id || null,
      serviceDepartment: null,
    });

    await user.save();

    const token = signPasswordSetupToken({ userId: String(user._id), email });
    const appBaseUrl =
      process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const setupUrl = `${appBaseUrl.replace(/\/$/, "")}/set-password?token=${encodeURIComponent(token)}`;

    await sendPasswordSetupEmail(email, name, setupUrl);

    const created = await User.findById(user._id)
      .populate("department")
      .populate("academicDepartment")
      .populate("serviceDepartment")
      .populate("managedDepartments")
      .lean();

    return NextResponse.json(
      {
        message: "Department admin created successfully. Email sent for password setup.",
        admin: toResponse(created as unknown as DeptAdminUser),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create dept admin error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
