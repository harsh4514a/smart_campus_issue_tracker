import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { sendOtpEmail } from "@/lib/mailer";
import { createOtpRecord, normalizeEmail } from "@/lib/otp-service";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and new password are required." }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
    }

    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { message: "Password must be 8+ chars with uppercase, lowercase, number, and special character." },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return NextResponse.json({ message: "No account found with that email." }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = await createOtpRecord({
      email: normalizedEmail,
      purpose: "reset-password",
      name: user.name,
      passwordHash,
      role: user.role,
    });

    await sendOtpEmail(normalizedEmail, otp);

    return NextResponse.json({ message: "Password reset code sent to your email." });
  } catch (error) {
    console.error("Request password reset error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
