import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import "@/models/Department";
import { signToken } from "@/lib/auth";
import { isOtpFormatValid, normalizeEmail, verifyOtpRecord } from "@/lib/otp-service";

const collegeEmailRegex = /@charusat\.(edu|ac)\.in$/i;

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and OTP are required." }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!collegeEmailRegex.test(normalizedEmail)) {
      return NextResponse.json({ message: "Please use your college email." }, { status: 400 });
    }

    if (!isOtpFormatValid(otp)) {
      return NextResponse.json({ message: "Reset code must be a 6-digit code." }, { status: 400 });
    }

    const verification = await verifyOtpRecord({
      email: normalizedEmail,
      otp,
      purpose: "reset-password",
    });

    if (!verification.ok) {
      const message = verification.status === 404 ? "Reset code not found or expired." : verification.message;
      return NextResponse.json({ message }, { status: verification.status });
    }

    const { otpRecord } = verification;

    const user = await User.findOne({ email: normalizedEmail }).populate("department");
    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (user.isActive === false) {
      return NextResponse.json({ message: "Your account is deactivated. Contact admin." }, { status: 403 });
    }

    user.password = otpRecord.passwordHash;
    await user.save();

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
