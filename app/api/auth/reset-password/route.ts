import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Otp from "@/models/Otp";
import User from "@/models/User";
import "@/models/Department";
import { signToken } from "@/lib/auth";

const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and OTP are required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!collegeEmailRegex.test(normalizedEmail)) {
      return NextResponse.json({ message: "Please use your college email." }, { status: 400 });
    }

    const otpRecord = await Otp.findOne({ email: normalizedEmail, purpose: "reset" });
    if (!otpRecord) {
      return NextResponse.json({ message: "Reset code not found or expired." }, { status: 404 });
    }

    if (otpRecord.expiresAt.getTime() < Date.now()) {
      await otpRecord.deleteOne();
      return NextResponse.json({ message: "Reset code expired." }, { status: 400 });
    }

    if (otpRecord.otp !== otp) {
      return NextResponse.json({ message: "Invalid reset code." }, { status: 401 });
    }

    const user = await User.findOne({ email: normalizedEmail }).populate("department");
    if (!user) {
      await otpRecord.deleteOne();
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    user.password = otpRecord.passwordHash;
    await user.save();
    await otpRecord.deleteOne();

    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
      departmentId: user.department ? user.department.toString() : null,
    });

    return NextResponse.json({
      message: "Password reset successful",
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
    console.error("Reset password error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
