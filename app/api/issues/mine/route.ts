import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import "@/models/Department"; // register Department for populate
import { authenticateRequest } from "@/lib/auth";

export async function GET(request: Request) {
  await connectDB();

  const authResult = await authenticateRequest(request, ["student", "faculty"]);
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;

  try {
    const issues = await Issue.find({ student: user._id })
      .populate("department")
      .sort({ createdAt: -1 });

    return NextResponse.json({ issues });
  } catch (error) {
    console.error("Fetch my issues error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}