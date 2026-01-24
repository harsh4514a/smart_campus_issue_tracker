import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Otp from "@/models/Otp";
import { sendOtpEmail } from "@/lib/mailer";
import { deriveRoleFromEmail } from "@/lib/role-utils";

const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  let hashPromiseRef: Promise<string> | null = null;
  try {
    await connectDB();

    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Name, email, and password are required." }, { status: 400 });
    }

    if (!collegeEmailRegex.test(email)) {
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
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      await hashPromise;
      return NextResponse.json({ message: "Email is already registered." }, { status: 409 });
    }

    const otp = generateOtp();
    const passwordHash = await hashPromise;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const role = deriveRoleFromEmail(email);

    const upsertOtpPromise = Otp.findOneAndUpdate(
      { email, $or: [{ purpose: "register" }, { purpose: { $exists: false } }] },
      { email, name, passwordHash, otp, expiresAt, purpose: "register", role },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    await Promise.all([upsertOtpPromise, sendOtpEmail(email, otp)]);

    return NextResponse.json({ message: "OTP sent to email." });
  } catch (error) {
    if (hashPromiseRef) {
      await hashPromiseRef.catch(() => null);
    }
    console.error("Send OTP error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}