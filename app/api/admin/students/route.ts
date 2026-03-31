import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";
import { isSuperAdmin } from "@/lib/rbac";

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const studentQuery: Record<string, unknown> = { role: { $in: ["student", "faculty"] } };
  if (process.env.NODE_ENV === "production") {
    studentQuery.isDemoUser = { $ne: true };
  }

  const students = await User.find(studentQuery)
    .select("name email role course institute department academicDepartment createdAt isDemoUser isActive")
    .populate("department", "name type")
    .populate("academicDepartment", "name type")
    .sort({ createdAt: -1 });

  const normalizedStudents = students.map((student) => {
    const plain = student.toObject();
    return {
      ...plain,
      department: plain.department || plain.academicDepartment || null,
    };
  });

  return NextResponse.json({ students: normalizedStudents });
}
