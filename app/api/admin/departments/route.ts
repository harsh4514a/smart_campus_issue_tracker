import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Department from "@/models/Department";

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const departments = await Department.find().sort({ name: 1 });
  return NextResponse.json({ departments });
}

export async function POST(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  try {
    const { name } = await request.json();
    if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

    const existing = await Department.findOne({ name });
    if (existing) return NextResponse.json({ message: "Department already exists" }, { status: 409 });

    const dept = await Department.create({ name });
    return NextResponse.json({ message: "Department created", department: dept }, { status: 201 });
  } catch (error) {
    console.error("Create department error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}