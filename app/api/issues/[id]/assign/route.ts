import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import Department from "@/models/Department";
import User from "@/models/User";
import { authenticateRequest } from "@/lib/auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  await connectDB();

  const authResult = await authenticateRequest(request, ["admin"]);
  if (authResult instanceof Response) return authResult;
  const { id } = await params;

  try {
    const { departmentId, academicDepartmentId, serviceDepartmentId, staffId, priority, status } = await request.json();

    const normalizedAcademicDepartmentId =
      typeof academicDepartmentId === "string" && academicDepartmentId.trim().length > 0
        ? academicDepartmentId
        : null;
    const normalizedServiceDepartmentId =
      typeof serviceDepartmentId === "string" && serviceDepartmentId.trim().length > 0
        ? serviceDepartmentId
        : null;
    const normalizedDepartmentId =
      typeof departmentId === "string" && departmentId.trim().length > 0
        ? departmentId
        : null;

    if (!normalizedAcademicDepartmentId && !normalizedServiceDepartmentId && !normalizedDepartmentId) {
      return NextResponse.json({ message: "At least one department selection is required." }, { status: 400 });
    }

    const normalizedStaffId = typeof staffId === "string" && staffId.trim().length > 0 ? staffId : null;
    if (!normalizedStaffId) {
      return NextResponse.json({ message: "staffId is required." }, { status: 400 });
    }

    const normalizedPriority =
      typeof priority === "string" && ["Low", "Medium", "High", "Urgent"].includes(priority)
        ? priority
        : null;

    if (!normalizedPriority) {
      return NextResponse.json({ message: "priority is required." }, { status: 400 });
    }

    let academicDept = null;
    let serviceDept = null;

    if (normalizedAcademicDepartmentId) {
      const selectedAcademicDepartment = await Department.findById(normalizedAcademicDepartmentId);
      if (!selectedAcademicDepartment) {
        return NextResponse.json({ message: "Academic department not found." }, { status: 404 });
      }

      if (selectedAcademicDepartment.type === "Academic") {
        academicDept = selectedAcademicDepartment;
      } else if (selectedAcademicDepartment.type === "Service") {
        serviceDept = selectedAcademicDepartment;
      } else {
        academicDept = selectedAcademicDepartment;
      }
    }

    if (normalizedServiceDepartmentId) {
      const selectedServiceDepartment = await Department.findById(normalizedServiceDepartmentId);
      if (!selectedServiceDepartment) {
        return NextResponse.json({ message: "Service department not found." }, { status: 404 });
      }

      if (selectedServiceDepartment.type === "Service") {
        serviceDept = selectedServiceDepartment;
      } else if (selectedServiceDepartment.type === "Academic") {
        academicDept = selectedServiceDepartment;
      } else {
        serviceDept = selectedServiceDepartment;
      }
    }

    if (!academicDept && !serviceDept && normalizedDepartmentId) {
      const legacyDepartment = await Department.findById(normalizedDepartmentId);
      if (!legacyDepartment) {
        return NextResponse.json({ message: "Department not found." }, { status: 404 });
      }

      if (legacyDepartment.type === "Academic") {
        academicDept = legacyDepartment;
      } else if (legacyDepartment.type === "Service") {
        serviceDept = legacyDepartment;
      } else {
        serviceDept = legacyDepartment;
      }
    }

    if (!academicDept && !serviceDept) {
      return NextResponse.json({ message: "Unable to map selected departments." }, { status: 400 });
    }

    const assignedStaff = await User.findOne({ _id: normalizedStaffId, role: "staff" }).lean();
    if (!assignedStaff) {
      return NextResponse.json({ message: "Staff member not found." }, { status: 404 });
    }

    const selectedDepartmentIds = [academicDept?._id?.toString(), serviceDept?._id?.toString()].filter(Boolean);
    const staffDepartmentIds = [
      assignedStaff.academicDepartment?.toString(),
      assignedStaff.serviceDepartment?.toString(),
      assignedStaff.department?.toString(),
    ].filter(Boolean);

    const isStaffInSelectedDepartments = selectedDepartmentIds.some((departmentIdValue) =>
      staffDepartmentIds.includes(departmentIdValue)
    );

    if (!isStaffInSelectedDepartments) {
      return NextResponse.json(
        { message: "Selected staff member is not assigned to the selected department(s)." },
        { status: 400 }
      );
    }

    const issue = await Issue.findById(id).select("_id");
    if (!issue) {
      return NextResponse.json({ message: "Issue not found." }, { status: 404 });
    }

    const updateData: {
      academicDepartment: unknown;
      serviceDepartment: unknown;
      department: unknown;
      assignedStaff: unknown;
      priority: string;
      status?: string;
    } = {
      academicDepartment: academicDept?._id || null,
      serviceDepartment: serviceDept?._id || null,
      department: serviceDept?._id || academicDept?._id || null,
      assignedStaff: assignedStaff._id,
      priority: normalizedPriority,
    };

    if (status && ["Pending", "In Progress", "Resolved", "Rejected"].includes(status)) {
      updateData.status = status;
    }

    await Issue.collection.updateOne({ _id: issue._id }, { $set: updateData });

    const updatedIssue = await Issue.findById(issue._id)
      .populate("student", "name email")
      .populate("department")
      .populate("academicDepartment")
      .populate("serviceDepartment")
      .populate("assignedStaff", "name email");

    return NextResponse.json({ message: "Issue assigned", issue: updatedIssue });
  } catch (error) {
    console.error("Assign issue error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}