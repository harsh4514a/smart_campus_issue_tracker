import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Otp from "@/models/Otp";
import { sendOtpEmail } from "@/lib/mailer";

const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Name, email, and password are required." }, { status: 400 });
    }

    if (!collegeEmailRegex.test(email)) {
      return NextResponse.json({ message: "Only college email is allowed." }, { status: 400 });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: "Email is already registered." }, { status: 409 });
    }

    const otp = generateOtp();
    const passwordHash = await bcrypt.hash(password, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.findOneAndUpdate(
      { email },
      { email, name, passwordHash, otp, expiresAt },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendOtpEmail(email, otp);

    return NextResponse.json({ message: "OTP sent to email." });
  } catch (error) {
    console.error("Send OTP error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}