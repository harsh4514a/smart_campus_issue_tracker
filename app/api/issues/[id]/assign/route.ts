import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import Department from "@/models/Department";
import { authenticateRequest } from "@/lib/auth";

interface Params {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: Params) {
  await connectDB();

  const authResult = await authenticateRequest(request, ["admin"]);
  if (authResult instanceof Response) return authResult;

  const { id } = params;

  try {
    const { departmentId, status } = await request.json();

    if (!departmentId) {
      return NextResponse.json({ message: "departmentId is required." }, { status: 400 });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return NextResponse.json({ message: "Department not found." }, { status: 404 });
    }

    const issue = await Issue.findById(id);
    if (!issue) {
      return NextResponse.json({ message: "Issue not found." }, { status: 404 });
    }

    issue.department = department._id;
    if (status && ["Pending", "In Progress", "Resolved"].includes(status)) {
      issue.status = status;
    }

    await issue.save();

    return NextResponse.json({ message: "Issue assigned", issue });
  } catch (error) {
    console.error("Assign issue error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}