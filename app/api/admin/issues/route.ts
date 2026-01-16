import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Issue from "@/models/Issue";

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const issues = await Issue.find()
    .populate("student", "name email")
    .populate("department")
    .sort({ createdAt: -1 });

  return NextResponse.json({ issues });
}