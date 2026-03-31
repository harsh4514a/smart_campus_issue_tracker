import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { sendOtpEmail } from "@/lib/mailer";
import { deriveRoleFromEmail } from "@/lib/role-utils";
import { createOtpRecord, normalizeEmail } from "@/lib/otp-service";

const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

export async function POST(request: Request) {
  let hashPromiseRef: Promise<string> | null = null;
  try {
    await connectDB();

    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Name, email, and password are required." }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!collegeEmailRegex.test(normalizedEmail)) {
      return NextResponse.json({ message: "Only college email is allowed." }, { status: 400 });
    }

    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character." },
        { status: 400 }
      );
    }

    const hashPromise = bcrypt.hash(password, 10);
    hashPromiseRef = hashPromise;
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      await hashPromise;
      return NextResponse.json({ message: "Email is already registered." }, { status: 409 });
    }

    const passwordHash = await hashPromise;
    const role = deriveRoleFromEmail(normalizedEmail);
    const otp = await createOtpRecord({
      email: normalizedEmail,
      purpose: "register",
      name,
      passwordHash,
      role,
    });

    await sendOtpEmail(normalizedEmail, otp);

    return NextResponse.json({ message: "OTP sent to email." });
  } catch (error) {
    if (hashPromiseRef) {
      await hashPromiseRef.catch(() => null);
    }
    console.error("Send OTP error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}