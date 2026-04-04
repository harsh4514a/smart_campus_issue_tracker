import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Issue from "@/models/Issue";
import { getDepartmentScopedIssueFilter } from "@/lib/rbac";

const ISSUE_SELECT_FULL =
  "title description imageUrl attachments resolutionAttachments category status location createdAt updatedAt dueDate priority recurring student department academicDepartment serviceDepartment assignedStaff";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const isValidId = Issue.db.base.Types.ObjectId.isValid(id);
  if (!isValidId) {
    return NextResponse.json({ message: "Invalid issue id." }, { status: 400 });
  }

  const issueFilter = getDepartmentScopedIssueFilter(auth.user);

  const issue = await Issue.findOne({
    _id: id,
    ...issueFilter,
  })
    .select(ISSUE_SELECT_FULL)
    .populate("student", "name email department academicDepartment course")
    .populate("assignedStaff", "_id name email")
    .populate("department", "_id name type")
    .populate("academicDepartment", "_id name type")
    .populate("serviceDepartment", "_id name type")
    .lean();

  if (!issue) {
    return NextResponse.json({ message: "Issue not found." }, { status: 404 });
  }

  return NextResponse.json({ issue });
}
