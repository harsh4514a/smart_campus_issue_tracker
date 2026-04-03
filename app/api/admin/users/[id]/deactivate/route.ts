import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";
import { isSuperAdmin } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  await connectDB();

  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid user id." }, { status: 400 });
  }

  if (String(auth.user._id) === id) {
    return NextResponse.json({ message: "You cannot deactivate your own account." }, { status: 400 });
  }

  try {
    const user = await User.findOneAndUpdate(
      { _id: id, role: { $in: ["student", "faculty", "staff"] } },
      {
        $set: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: auth.user._id,
        },
      },
      { new: true }
    ).select("_id name email role isActive deactivatedAt deactivatedBy");

    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      message: "User deactivated successfully",
      user,
    });
  } catch (error) {
    console.error("Deactivate user error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
