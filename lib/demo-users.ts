import mongoose from "mongoose";
import User, { type AdminRole, type UserRole } from "@/models/User";
import Department from "@/models/Department";

const DEMO_STUDENT_EMAIL = (process.env.DEMO_STUDENT_EMAIL || "demo.student@charusat.edu.in").trim().toLowerCase();
const DEMO_STUDENT_PASSWORD = process.env.DEMO_STUDENT_PASSWORD || "DemoStudent@123";

const DEMO_STAFF_EMAIL = (process.env.DEMO_STAFF_EMAIL || "demo.worker@charusat.ac.in").trim().toLowerCase();
const DEMO_STAFF_PASSWORD = process.env.DEMO_STAFF_PASSWORD || "DemoWorker@123";

const DEMO_ADMIN_EMAIL = (process.env.DEMO_ADMIN_EMAIL || "demo.admin@CampusTrackerer.com").trim().toLowerCase();
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || "DemoAdmin@123";

const DEMO_DEPT_ADMIN_EMAIL =
  (process.env.DEMO_DEPT_ADMIN_EMAIL || "demo.deptadmin@charusat.ac.in").trim().toLowerCase();
const DEMO_DEPT_ADMIN_PASSWORD = process.env.DEMO_DEPT_ADMIN_PASSWORD || "DemoDeptAdmin@123";

type DemoSeed = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  adminRole?: AdminRole | null;
  requiresDepartmentScope?: boolean;
};

const DEMO_SEEDS: DemoSeed[] = [
  {
    name: "Demo Student",
    email: DEMO_STUDENT_EMAIL,
    password: DEMO_STUDENT_PASSWORD,
    role: "student",
  },
  {
    name: "Demo Worker",
    email: DEMO_STAFF_EMAIL,
    password: DEMO_STAFF_PASSWORD,
    role: "staff",
  },
  {
    name: "Demo Admin",
    email: DEMO_ADMIN_EMAIL,
    password: DEMO_ADMIN_PASSWORD,
    role: "admin",
    adminRole: "super_admin",
  },
  {
    name: "Demo Department Admin",
    email: DEMO_DEPT_ADMIN_EMAIL,
    password: DEMO_DEPT_ADMIN_PASSWORD,
    role: "admin",
    adminRole: "dept_admin",
    requiresDepartmentScope: true,
  },
];

export const DEMO_CREDENTIALS = {
  student: {
    email: DEMO_STUDENT_EMAIL,
    password: DEMO_STUDENT_PASSWORD,
  },
  worker: {
    email: DEMO_STAFF_EMAIL,
    password: DEMO_STAFF_PASSWORD,
  },
  admin: {
    email: DEMO_ADMIN_EMAIL,
    password: DEMO_ADMIN_PASSWORD,
  },
  deptAdmin: {
    email: DEMO_DEPT_ADMIN_EMAIL,
    password: DEMO_DEPT_ADMIN_PASSWORD,
  },
};

function normalizeId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();

  if (typeof value === "object" && value !== null && "_id" in value) {
    return normalizeId((value as { _id?: unknown })._id);
  }

  return String(value);
}

function normalizeIdArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const ids = values
    .map((value) => normalizeId(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(ids));
}

async function resolveScopedDepartmentId() {
  const academicDepartment = await Department.findOne({ type: "Academic" }).select("_id").lean<{ _id: unknown }>();
  if (academicDepartment?._id) {
    return String(academicDepartment._id);
  }

  const fallbackDepartment = await Department.findOne({}).select("_id").lean<{ _id: unknown }>();
  if (fallbackDepartment?._id) {
    return String(fallbackDepartment._id);
  }

  return null;
}

export async function ensureDemoUsers() {
  const scopedDepartmentId = await resolveScopedDepartmentId();

  for (const seed of DEMO_SEEDS) {
    const departmentIds =
      seed.requiresDepartmentScope && scopedDepartmentId
        ? [scopedDepartmentId]
        : [];
    const primaryDepartmentId = departmentIds[0] || null;

    const existing = await User.findOne({ email: seed.email });

    if (!existing) {
      await User.create({
        name: seed.name,
        email: seed.email,
        password: seed.password,
        role: seed.role,
        adminRole: seed.adminRole ?? null,
        department: primaryDepartmentId,
        academicDepartment: primaryDepartmentId,
        serviceDepartment: null,
        managedDepartments: departmentIds,
        isActive: true,
        deactivatedAt: null,
        deactivatedBy: null,
        emailNotificationsEnabled: false,
        isDemoUser: true,
      });
      continue;
    }

    let requiresSave = false;

    if (existing.role !== seed.role) {
      existing.role = seed.role;
      requiresSave = true;
    }

    if ((existing.adminRole ?? null) !== (seed.adminRole ?? null)) {
      existing.adminRole = seed.adminRole ?? null;
      requiresSave = true;
    }

    if (existing.isActive === false) {
      existing.isActive = true;
      requiresSave = true;
    }

    if (existing.deactivatedAt !== null) {
      existing.deactivatedAt = null;
      requiresSave = true;
    }

    if (existing.deactivatedBy !== null) {
      existing.deactivatedBy = null;
      requiresSave = true;
    }

    if (existing.emailNotificationsEnabled !== false) {
      existing.emailNotificationsEnabled = false;
      requiresSave = true;
    }

    if (!existing.isDemoUser) {
      existing.isDemoUser = true;
      requiresSave = true;
    }

    if (existing.name !== seed.name) {
      existing.name = seed.name;
      requiresSave = true;
    }

    const currentDepartmentId = normalizeId(existing.department);
    if (currentDepartmentId !== primaryDepartmentId) {
      existing.department = primaryDepartmentId
        ? new mongoose.Types.ObjectId(primaryDepartmentId)
        : null;
      requiresSave = true;
    }

    const currentAcademicDepartmentId = normalizeId(existing.academicDepartment);
    if (currentAcademicDepartmentId !== primaryDepartmentId) {
      existing.academicDepartment = primaryDepartmentId
        ? new mongoose.Types.ObjectId(primaryDepartmentId)
        : null;
      requiresSave = true;
    }

    if (normalizeId(existing.serviceDepartment) !== null) {
      existing.serviceDepartment = null;
      requiresSave = true;
    }

    const currentManagedDepartments = normalizeIdArray(existing.managedDepartments);
    const managedDepartmentsMatch =
      currentManagedDepartments.length === departmentIds.length &&
      departmentIds.every((id) => currentManagedDepartments.includes(id));

    if (!managedDepartmentsMatch) {
      existing.managedDepartments = departmentIds.map((id) => new mongoose.Types.ObjectId(id));
      requiresSave = true;
    }

    const passwordMatches = await existing.comparePassword(seed.password);
    if (!passwordMatches) {
      existing.password = seed.password;
      requiresSave = true;
    }

    if (requiresSave) {
      await existing.save();
    }
  }
}
