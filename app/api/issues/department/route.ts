import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import "@/models/Department"; // register Department for populate
import { authenticateRequest } from "@/lib/auth";

export async function GET(request: Request) {
  await connectDB();

  const authResult = await authenticateRequest(request, ["faculty", "staff"]);
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;

  try {
    const issues = await Issue.find({ assignedStaff: user._id })
      .populate("student", "name email")
      .populate("department", "_id name type")
      .populate("academicDepartment", "_id name type")
      .populate("serviceDepartment", "_id name type")
      .populate("assignedStaff", "_id name email")
      .sort({ createdAt: -1 });

    return NextResponse.json({ issues });
  } catch (error) {
    console.error("Fetch department issues error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}