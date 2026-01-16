import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    await connectDB();

    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Name, email, and password are required." }, { status: 400 });
    }

    const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;
    if (!collegeEmailRegex.test(email)) {
      return NextResponse.json({ message: "Only college email is allowed." }, { status: 400 });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ message: "Email is already registered." }, { status: 409 });
    }

    const user = new User({ name, email, password, role: "student", department: null });
    await user.save();

    return NextResponse.json(
      {
        message: "Registration successful",
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}