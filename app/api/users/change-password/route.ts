import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["student", "faculty", "staff", "admin"]);
  if (auth instanceof Response) return auth;

  try {
    const { currentPassword, newPassword, confirmPassword } = await request.json();

    if (typeof currentPassword !== "string" || currentPassword.length === 0) {
      return NextResponse.json({ message: "Current password is required." }, { status: 400 });
    }

    if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.` },
        { status: 400 }
      );
    }

    if (typeof confirmPassword !== "string" || newPassword !== confirmPassword) {
      return NextResponse.json({ message: "Password confirmation does not match." }, { status: 400 });
    }

    const isCurrentPasswordValid = await auth.user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ message: "Current password is incorrect." }, { status: 401 });
    }

    const isSamePassword = await auth.user.comparePassword(newPassword);
    if (isSamePassword) {
      return NextResponse.json({ message: "New password must be different from current password." }, { status: 400 });
    }

    auth.user.password = newPassword;
    await auth.user.save();

    return NextResponse.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
