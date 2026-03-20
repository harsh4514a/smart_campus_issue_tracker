import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["student", "faculty", "staff", "admin"]);
  if (auth instanceof Response) return auth;

  const user = auth.user;
  return NextResponse.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department ?? null,
      academicDepartment: user.academicDepartment ?? null,
      serviceDepartment: user.serviceDepartment ?? null,
      studentId: user.studentId ?? null,
      institute: user.institute ?? null,
      course: user.course ?? null,
      mobileNumber: user.mobileNumber ?? null,
    },
  });
}

export async function PATCH(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["student", "faculty", "staff", "admin"]);
  if (auth instanceof Response) return auth;

  try {
    const { name, studentId, institute, course, mobileNumber } = await request.json();
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    auth.user.name = name.trim();
    auth.user.studentId = typeof studentId === "string" ? studentId.trim() || null : auth.user.studentId ?? null;
    auth.user.institute = typeof institute === "string" ? institute.trim() || null : auth.user.institute ?? null;
    auth.user.course = typeof course === "string" ? course.trim() || null : auth.user.course ?? null;
    auth.user.mobileNumber =
      typeof mobileNumber === "string" ? mobileNumber.trim() || null : auth.user.mobileNumber ?? null;
    await auth.user.save();

    return NextResponse.json({
      message: "Profile updated",
      user: {
        id: auth.user._id,
        name: auth.user.name,
        email: auth.user.email,
        role: auth.user.role,
        department: auth.user.department ?? null,
        academicDepartment: auth.user.academicDepartment ?? null,
        serviceDepartment: auth.user.serviceDepartment ?? null,
        studentId: auth.user.studentId ?? null,
        institute: auth.user.institute ?? null,
        course: auth.user.course ?? null,
        mobileNumber: auth.user.mobileNumber ?? null,
      },
    });
  } catch (error) {
    console.error("Update profile error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
