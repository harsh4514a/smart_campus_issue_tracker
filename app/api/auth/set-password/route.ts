import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { verifyPasswordSetupToken } from "@/lib/password-setup";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

export async function POST(request: Request) {
  try {
    await connectDB();
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ message: "Token and password are required." }, { status: 400 });
    }

    if (!passwordRegex.test(String(password))) {
      return NextResponse.json(
        { message: "Password must be 8+ chars with uppercase, lowercase, number, and special character." },
        { status: 400 }
      );
    }

    let decoded: { userId: string; email: string; purpose: "dept-admin-password-setup" | "staff-password-setup" };
    try {
      decoded = verifyPasswordSetupToken(String(token));
    } catch {
      return NextResponse.json({ message: "Invalid or expired setup link." }, { status: 400 });
    }

    const roleFilter =
      decoded.purpose === "dept-admin-password-setup"
        ? { role: "admin", adminRole: "dept_admin" }
        : { role: "staff" };

    const user = await User.findOne({
      _id: decoded.userId,
      email: decoded.email,
      ...roleFilter,
    });

    if (!user) {
      return NextResponse.json({ message: "Account not found for this setup link." }, { status: 404 });
    }

    user.password = String(password);
    await user.save();

    return NextResponse.json({ message: "Password set successfully. You can now log in." });
  } catch (error) {
    console.error("Set password error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
