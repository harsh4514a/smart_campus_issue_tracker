import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Department from "@/models/Department";
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

  try {
    const { id } = await context.params;
    const { name, type } = await request.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }

    if (type !== "Academic" && type !== "Service") {
      return NextResponse.json({ message: "Type must be Academic or Service" }, { status: 400 });
    }

    const normalizedName = name.trim();

    const existing = await Department.findOne({
      _id: { $ne: id },
      name: normalizedName,
    });

    if (existing) {
      return NextResponse.json({ message: "Department already exists" }, { status: 409 });
    }

    const department = await Department.findByIdAndUpdate(
      id,
      { name: normalizedName, type },
      { new: true }
    );

    if (!department) {
      return NextResponse.json({ message: "Department not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Department updated", department });
  } catch (error) {
    console.error("Update department error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  await connectDB();
  const auth = await authenticateRequest(_request, ["admin"]);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const department = await Department.findByIdAndDelete(id);

    if (!department) {
      return NextResponse.json({ message: "Department not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Department deleted" });
  } catch (error) {
    console.error("Delete department error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
