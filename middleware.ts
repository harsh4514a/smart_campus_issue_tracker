import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const jwtSecret = process.env.JWT_SECRET;

const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/admin-login",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/request-password-reset",
  "/api/auth/reset-password",
];

const ROLE_RULES: { pattern: RegExp; roles: Array<"student" | "faculty" | "staff" | "admin"> }[] = [
  { pattern: /^\/api\/issues$/, roles: ["student", "faculty"] },
  { pattern: /^\/api\/issues\/mine/, roles: ["student", "faculty"] },
  { pattern: /^\/api\/issues\/department/, roles: ["faculty", "staff"] },
  { pattern: /^\/api\/issues\/[^/]+\/assign/, roles: ["admin"] },
  { pattern: /^\/api\/issues\/[^/]+\/status/, roles: ["faculty", "staff", "admin"] },
  { pattern: /^\/api\/admin\//, roles: ["admin"] },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const rule = ROLE_RULES.find((entry) => entry.pattern.test(pathname));
  if (!rule) {
    return NextResponse.next();
  }

  if (!jwtSecret) {
    return NextResponse.json({ message: "JWT secret not configured" }, { status: 500 });
  }

  const secretKey = new TextEncoder().encode(jwtSecret);

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];

  try {
  const { payload } = await jwtVerify(token, secretKey);
  const role = payload.role as "student" | "faculty" | "staff" | "admin" | undefined;

    if (!role || !rule.roles.includes(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.next();
  } catch {
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
  }
}

export const config = {
  matcher: ["/api/:path*"],
};