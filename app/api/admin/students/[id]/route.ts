import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";
import { isSuperAdmin } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  await connectDB();
  const auth = await authenticateRequest(_request, ["admin"]);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const student = await User.findOneAndUpdate(
      { _id: id, role: { $in: ["student", "faculty"] } },
      {
        $set: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: auth.user._id,
        },
      },
      { new: true }
    );

    if (!student) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "User deactivated successfully" });
  } catch (error) {
    console.error("Deactivate student error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
