import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";
import Department from "@/models/Department";

const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const staff = await User.find({ role: "staff" }).populate("department").sort({ name: 1 });
  return NextResponse.json({ staff });
}

export async function POST(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  try {
    const { name, email, password, departmentId } = await request.json();

    if (!name || !email || !password || !departmentId) {
      return NextResponse.json({ message: "Name, email, password, and departmentId are required." }, { status: 400 });
    }

    if (!collegeEmailRegex.test(email)) {
      return NextResponse.json({ message: "Only college email is allowed." }, { status: 400 });
    }

    const dept = await Department.findById(departmentId);
    if (!dept) return NextResponse.json({ message: "Department not found." }, { status: 404 });

    const existing = await User.findOne({ email });
    if (existing) return NextResponse.json({ message: "Email already registered." }, { status: 409 });

    const user = new User({ name, email, password, role: "staff", department: dept._id });
    await user.save();

    return NextResponse.json({ message: "Staff created", user }, { status: 201 });
  } catch (error) {
    console.error("Create staff error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}