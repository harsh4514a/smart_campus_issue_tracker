import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  await connectDB();
  const auth = await authenticateRequest(_request, ["admin"]);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await context.params;
    const student = await User.findOneAndDelete({ _id: id, role: "student" });

    if (!student) {
      return NextResponse.json({ message: "Student not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Student deleted." });
  } catch (error) {
    console.error("Delete student error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
