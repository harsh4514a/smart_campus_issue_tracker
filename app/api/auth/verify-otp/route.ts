import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import type { OtpPurpose } from "@/models/Otp";
import { signToken } from "@/lib/auth";
import { deriveRoleFromEmail, deriveStudentMetadataFromEmail } from "@/lib/role-utils";
import { isOtpFormatValid, normalizeEmail, verifyOtpRecord } from "@/lib/otp-service";

const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, otp, purpose } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and OTP are required." }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPurpose = (purpose ?? "register") as OtpPurpose;

    if (!collegeEmailRegex.test(normalizedEmail)) {
      return NextResponse.json({ message: "Only college email is allowed." }, { status: 400 });
    }

    if (normalizedPurpose !== "register") {
      return NextResponse.json({ message: "Invalid OTP purpose for this endpoint." }, { status: 400 });
    }

    if (!isOtpFormatValid(otp)) {
      return NextResponse.json({ message: "OTP must be a 6-digit code." }, { status: 400 });
    }

    const verification = await verifyOtpRecord({
      email: normalizedEmail,
      otp,
      purpose: normalizedPurpose,
    });

    if (!verification.ok) {
      return NextResponse.json({ message: verification.message }, { status: verification.status });
    }

    const { otpRecord } = verification;

    // Double-check user not already registered
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json({ message: "Email is already registered." }, { status: 409 });
    }

    const derivedRole = otpRecord.role || deriveRoleFromEmail(otpRecord.email);
    const { studentId, course } = deriveStudentMetadataFromEmail(otpRecord.email);

    const user = new User({
      name: otpRecord.name,
      email: otpRecord.email,
      password: otpRecord.passwordHash,
      role: derivedRole,
      department: null,
      studentId,
      course,
    });

    await user.save();

    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
      departmentId: null,
    });

    return NextResponse.json({
      message: "Verification successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId ?? null,
        course: user.course ?? null,
      },
    });
  } catch (error) {
    console.error("Verify OTP error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}