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

  if (!user.department) {
    return NextResponse.json(
      { message: "This account is not associated with a department." },
      { status: 400 }
    );
  }

  try {
    const issues = await Issue.find({ department: user.department })
      .populate("student", "name email")
      .populate("department")
      .sort({ createdAt: -1 });

    return NextResponse.json({ issues });
  } catch (error) {
    console.error("Fetch department issues error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}