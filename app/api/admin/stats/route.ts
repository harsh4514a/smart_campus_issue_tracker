import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";
import Issue from "@/models/Issue";

export async function GET(request: Request) {
  await connectDB();

  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  try {
    const [studentCount, facultyCount, issueCount, pendingCount] = await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "faculty" }),
      Issue.countDocuments({}),
      Issue.countDocuments({ status: "Pending" }),
    ]);

    return NextResponse.json({
      students: studentCount,
      faculty: facultyCount,
      issues: issueCount,
      pending: pendingCount,
    });
  } catch (error) {
    console.error("Admin stats error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}