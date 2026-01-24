import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Otp from "@/models/Otp";
import { sendOtpEmail } from "@/lib/mailer";

const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and new password are required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!collegeEmailRegex.test(normalizedEmail)) {
      return NextResponse.json({ message: "Please use your college email." }, { status: 400 });
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
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const upsertOtpPromise = Otp.findOneAndUpdate(
      { email: normalizedEmail, purpose: "reset" },
      { email: normalizedEmail, name: user.name, passwordHash, otp, expiresAt, purpose: "reset", role: user.role },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    await Promise.all([upsertOtpPromise, sendOtpEmail(normalizedEmail, otp)]);

    return NextResponse.json({ message: "Password reset code sent to your email." });
  } catch (error) {
    console.error("Request password reset error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
