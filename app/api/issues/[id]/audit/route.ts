import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import AuditLog from "@/models/AuditLog";
import Issue from "@/models/Issue";
import { canAdminAccessIssue } from "@/lib/rbac";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  await connectDB();
  const auth = await authenticateRequest(request, ["student", "faculty", "staff", "admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const issue = await Issue.findById(id).select("student assignedStaff").lean();
  if (!issue) return NextResponse.json({ message: "Issue not found." }, { status: 404 });

  const currentUserId = String(auth.user._id);
  const isAdmin = auth.user.role === "admin";
  const isOwner = String(issue.student || "") === currentUserId;
  const isAssigned = String(issue.assignedStaff || "") === currentUserId;

  if (isAdmin && !canAdminAccessIssue(auth.user, issue)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!isAdmin && !isOwner && !isAssigned) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const logs = await AuditLog.find({ issueId: id }).sort({ timestamp: -1 }).lean();
  return NextResponse.json({ logs });
}
