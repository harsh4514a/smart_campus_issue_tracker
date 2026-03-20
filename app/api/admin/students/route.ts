import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const students = await User.find({ role: "student" })
    .select("name email course institute department createdAt")
    .populate("department", "name type")
    .sort({ createdAt: -1 });

  return NextResponse.json({ students });
}
