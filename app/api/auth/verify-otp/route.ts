import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Otp from "@/models/Otp";
import { signToken } from "@/lib/auth";
import { deriveRoleFromEmail, deriveStudentMetadataFromEmail } from "@/lib/role-utils";

const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and OTP are required." }, { status: 400 });
    }

    if (!collegeEmailRegex.test(email)) {
      return NextResponse.json({ message: "Only college email is allowed." }, { status: 400 });
    }

    const otpRecord = await Otp.findOne({
      email,
      $or: [{ purpose: "register" }, { purpose: { $exists: false } }],
    });
    if (!otpRecord) {
      return NextResponse.json({ message: "OTP not found or expired." }, { status: 404 });
    }

    if (otpRecord.expiresAt.getTime() < Date.now()) {
      await otpRecord.deleteOne();
      return NextResponse.json({ message: "OTP expired." }, { status: 400 });
    }

    if (otpRecord.otp !== otp) {
      return NextResponse.json({ message: "Invalid OTP." }, { status: 401 });
    }

    // Double-check user not already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await otpRecord.deleteOne();
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
    await otpRecord.deleteOne();

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