import User, { type UserRole } from "@/models/User";

const DEMO_STUDENT_EMAIL = (process.env.DEMO_STUDENT_EMAIL || "demo.student@charusat.edu.in").trim().toLowerCase();
const DEMO_STUDENT_PASSWORD = process.env.DEMO_STUDENT_PASSWORD || "DemoStudent@123";

const DEMO_STAFF_EMAIL = (process.env.DEMO_STAFF_EMAIL || "demo.worker@charusat.ac.in").trim().toLowerCase();
const DEMO_STAFF_PASSWORD = process.env.DEMO_STAFF_PASSWORD || "DemoWorker@123";

const DEMO_ADMIN_EMAIL = (process.env.DEMO_ADMIN_EMAIL || "demo.admin@CampusTrackerer.com").trim().toLowerCase();
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || "DemoAdmin@123";

type DemoSeed = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
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
};

export async function ensureDemoUsers() {
  for (const seed of DEMO_SEEDS) {
    const existing = await User.findOne({ email: seed.email });

    if (!existing) {
      await User.create({
        name: seed.name,
        email: seed.email,
        password: seed.password,
        role: seed.role,
        department: null,
        academicDepartment: null,
        serviceDepartment: null,
        isDemoUser: true,
      });
      continue;
    }

    let requiresSave = false;

    if (existing.role !== seed.role) {
      existing.role = seed.role;
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
