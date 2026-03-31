import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Issue from "@/models/Issue";
import { getDepartmentScopedIssueFilter } from "@/lib/rbac";

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const issueFilter = getDepartmentScopedIssueFilter(auth.user);

  const issues = await Issue.find(issueFilter)
    .populate({
      path: "student",
      select: "name email department academicDepartment course",
      populate: [
        { path: "department", select: "_id name type" },
        { path: "academicDepartment", select: "_id name type" },
      ],
    })
    .populate("department")
    .populate("academicDepartment")
    .populate("serviceDepartment")
    .populate("assignedStaff", "name email")
    .sort({ createdAt: -1 });

  return NextResponse.json({ issues });
}