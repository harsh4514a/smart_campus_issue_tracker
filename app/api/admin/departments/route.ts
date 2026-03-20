import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Department from "@/models/Department";

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const departments = await Department.find().sort({ name: 1 });

  const departmentsNeedingType = departments.filter(
    (department) => department.type !== "Academic" && department.type !== "Service"
  );

  if (departmentsNeedingType.length > 0) {
    await Promise.all(
      departmentsNeedingType.map((department) => {
        department.type = "Service";
        return department.save();
      })
    );
  }

  const hasLegacyDescription = departments.some((department) =>
    Object.prototype.hasOwnProperty.call((department as { toObject: () => Record<string, unknown> }).toObject(), "description")
  );

  if (hasLegacyDescription) {
    await Department.collection.updateMany(
      { description: { $exists: true } },
      { $unset: { description: "" } }
    );
  }

  return NextResponse.json({ departments });
}

export async function POST(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  try {
    const { name, type } = await request.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }

    if (type !== "Academic" && type !== "Service") {
      return NextResponse.json({ message: "Type must be Academic or Service" }, { status: 400 });
    }

    const normalizedName = name.trim();

    const existing = await Department.findOne({ name: normalizedName });
    if (existing) return NextResponse.json({ message: "Department already exists" }, { status: 409 });

    const dept = await Department.create({
      name: normalizedName,
      type,
    });
    return NextResponse.json({ message: "Department created", department: dept }, { status: 201 });
  } catch (error) {
    console.error("Create department error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}