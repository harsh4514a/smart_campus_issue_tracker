import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac";
import User from "@/models/User";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const email = String(params.get("email") || "").trim().toLowerCase();
  const excludeId = String(params.get("excludeId") || "").trim();

  if (!email || !emailRegex.test(email)) {
    return NextResponse.json({ exists: false });
  }

  const query: Record<string, unknown> = { email };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existing = await User.findOne(query).select("_id").lean();
  return NextResponse.json({ exists: Boolean(existing) });
}
