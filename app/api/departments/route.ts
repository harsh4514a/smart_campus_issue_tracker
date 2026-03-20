import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Department from "@/models/Department";

export async function GET(request: Request) {
  await connectDB();

  const auth = await authenticateRequest(request, ["student", "faculty", "staff", "admin"]);
  if (auth instanceof Response) return auth;

  const departments = await Department.find().sort({ name: 1 });
  return NextResponse.json({ departments });
}
