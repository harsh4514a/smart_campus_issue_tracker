import jwt from "jsonwebtoken";
import User, { IUser, UserRole } from "@/models/User";
import connectDB from "@/lib/db";

export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
  departmentId?: string | null;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Please set the JWT_SECRET environment variable.");
}

const jwtSecret = JWT_SECRET as string;

const DEMO_EMAILS = new Set(
  [
    process.env.DEMO_STUDENT_EMAIL || "demo.student@charusat.edu.in",
    process.env.DEMO_STAFF_EMAIL || "demo.worker@charusat.ac.in",
    process.env.DEMO_ADMIN_EMAIL || "demo.admin@campustracker.com",
  ].map((email) => email.trim().toLowerCase())
);

export function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
}

export async function authenticateRequest(
  request: Request,
  allowedRoles?: UserRole[]
): Promise<{ user: IUser } | Response> {
  await connectDB();

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, jwtSecret) as jwt.JwtPayload & AuthTokenPayload;

    if (allowedRoles && !allowedRoles.includes(decoded.role)) {
      return new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
    }

    const user = await User.findById(decoded.userId)
      .populate("department")
      .populate("academicDepartment")
      .populate("serviceDepartment");

    if (!user) {
      return new Response(JSON.stringify({ message: "User not found" }), { status: 401 });
    }

    const method = request.method.toUpperCase();
    const isReadOnlyMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";
    const isDemoUser = Boolean(user.isDemoUser) || DEMO_EMAILS.has(String(user.email || "").trim().toLowerCase());
    if (isDemoUser && !isReadOnlyMethod) {
      return new Response(JSON.stringify({ message: "Demo account is view-only." }), { status: 403 });
    }

    return { user };
  } catch {
    return new Response(JSON.stringify({ message: "Invalid or expired token" }), { status: 401 });
  }
}