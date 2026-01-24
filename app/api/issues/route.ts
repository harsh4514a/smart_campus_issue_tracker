import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import Department from "@/models/Department";
import { authenticateRequest } from "@/lib/auth";

export async function POST(request: Request) {
  await connectDB();

  const authResult = await authenticateRequest(request, ["student", "faculty"]);
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;

  try {
    const { title, description, category, location, departmentId } = await request.json();

    if (!title || !description || !category || !location) {
      return NextResponse.json({ message: "All fields are required." }, { status: 400 });
    }

    let department = null;
    if (departmentId) {
      const isValidId = typeof departmentId === "string" && Department.db.base.Types.ObjectId.isValid(departmentId);
      if (!isValidId) {
        return NextResponse.json({ message: "Invalid departmentId format." }, { status: 400 });
      }

      department = await Department.findById(departmentId);
      if (!department) {
        return NextResponse.json({ message: "Department not found." }, { status: 404 });
      }
    }

    const issue = await Issue.create({
      title,
      description,
      category,
      location,
      status: "Pending",
      student: user._id,
      department: department ? department._id : null,
    });

    return NextResponse.json({ message: "Issue created", issue }, { status: 201 });
  } catch (error) {
    console.error("Create issue error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}