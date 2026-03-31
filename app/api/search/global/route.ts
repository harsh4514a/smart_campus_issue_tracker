import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Issue from "@/models/Issue";
import User from "@/models/User";
import Department from "@/models/Department";

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["student", "faculty", "staff", "admin"]);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();

  if (query.length < 2) {
    return NextResponse.json({ issues: [], students: [], staff: [] });
  }

  const rx = new RegExp(query.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i");

  const [issues, users, departments] = await Promise.all([
    Issue.find({ $or: [{ title: rx }, { description: rx }, { category: rx }] })
      .select("title status")
      .limit(8)
      .lean(),
    User.find({ $or: [{ name: rx }, { email: rx }] })
      .select("name email role")
      .limit(8)
      .lean(),
    Department.find({ name: rx }).select("name").limit(8).lean(),
  ]);

  return NextResponse.json({
    issues,
    students: users.filter((user) => user.role === "student"),
    staff: users.filter((user) => user.role === "staff" || user.role === "faculty"),
    departments,
  });
}
