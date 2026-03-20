import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Issue from "@/models/Issue";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  await connectDB();

  const authResult = await authenticateRequest(request, ["faculty", "staff"]);
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;
  const { id } = await params;

  const isValidId = Issue.db.base.Types.ObjectId.isValid(id);
  if (!isValidId) {
    return NextResponse.json({ message: "Invalid issue id." }, { status: 400 });
  }

  try {
    const issue = await Issue.findById(id)
      .populate("student", "name email")
      .populate("department", "_id name type")
      .populate("academicDepartment", "_id name type")
      .populate("serviceDepartment", "_id name type")
      .populate("assignedStaff", "_id name email");

    if (!issue) {
      return NextResponse.json({ message: "Issue not found." }, { status: 404 });
    }

    if (!issue.assignedStaff || issue.assignedStaff._id.toString() !== user._id.toString()) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ issue });
  } catch (error) {
    console.error("Fetch assigned issue detail error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
