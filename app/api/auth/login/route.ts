import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import "@/models/Department"; 
import { signToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    const user = await User.findOne({ email }).populate("department");
    if (!user) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
      departmentId: user.department ? user.department.toString() : null,
    });

    return NextResponse.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    console.error("Login error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}