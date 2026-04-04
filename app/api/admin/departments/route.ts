import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Department from "@/models/Department";
import { getAdminDepartmentIds, isDeptAdmin, isSuperAdmin } from "@/lib/rbac";

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const isSuper = isSuperAdmin(auth.user);
  const isDept = isDeptAdmin(auth.user);

  if (!isSuper && !isDept) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const query = isSuper ? {} : { _id: { $in: getAdminDepartmentIds(auth.user) } };
  const searchParams = new URL(request.url).searchParams;
  const requestedView = (searchParams.get("view") || "").trim().toLowerCase();
  const isLightweightView = requestedView === "issues" || requestedView === "list";

  if (isLightweightView) {
    const selectFields = requestedView === "list" ? "_id name type createdAt" : "_id name type";
    const departments = await Department.find(query)
      .select(selectFields)
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ departments });
  }

  const departments = await Department.find(query).sort({ name: 1 });

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

  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

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