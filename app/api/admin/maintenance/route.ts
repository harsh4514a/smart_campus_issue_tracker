import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import MaintenanceTask from "@/models/MaintenanceTask";
import User from "@/models/User";
import { runDueMaintenanceTasks } from "@/lib/maintenance";
import { getAdminDepartmentIds, isDeptAdmin, isSuperAdmin } from "@/lib/rbac";

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  await runDueMaintenanceTasks();

  const isSuper = isSuperAdmin(auth.user);
  const isDept = isDeptAdmin(auth.user);
  const scopeDepartmentIds = getAdminDepartmentIds(auth.user);

  if (!isSuper && !isDept) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const query = isSuper ? {} : { department: { $in: scopeDepartmentIds } };

  const tasks = await MaintenanceTask.find(query)
    .populate("department", "name")
    .populate("assignedWorker", "name email")
    .sort({ nextDueDate: 1 });

  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const isSuper = isSuperAdmin(auth.user);
  const isDept = isDeptAdmin(auth.user);
  const scopeDepartmentIds = getAdminDepartmentIds(auth.user);

  if (!isSuper && !isDept) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const { title, departmentId, assignedWorkerId, frequency, nextDueDate, notes } = await request.json();

    if (!title || !departmentId || !frequency || !nextDueDate) {
      return NextResponse.json({ message: "title, department, frequency and nextDueDate are required." }, { status: 400 });
    }

    if (!isSuper && !scopeDepartmentIds.includes(String(departmentId))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (assignedWorkerId) {
      const assignedWorker = await User.findOne({ _id: assignedWorkerId, role: "staff" })
        .select("department academicDepartment serviceDepartment")
        .lean();

      if (!assignedWorker) {
        return NextResponse.json({ message: "Assigned worker not found." }, { status: 404 });
      }

      if (!isSuper) {
        const workerDepartmentIds = [
          assignedWorker.department,
          assignedWorker.academicDepartment,
          assignedWorker.serviceDepartment,
        ]
          .filter(Boolean)
          .map((value) => String(value));

        if (!workerDepartmentIds.some((id) => scopeDepartmentIds.includes(id))) {
          return NextResponse.json({ message: "Assigned worker is outside your department scope." }, { status: 403 });
        }
      }
    }

    const task = await MaintenanceTask.create({
      title: String(title).trim(),
      department: departmentId,
      assignedWorker: assignedWorkerId || null,
      frequency,
      nextDueDate: new Date(nextDueDate),
      notes: notes ? String(notes).trim() : null,
      status: new Date(nextDueDate).getTime() < Date.now() ? "Overdue" : "Upcoming",
    });

    return NextResponse.json({ message: "Maintenance task created", task }, { status: 201 });
  } catch (error) {
    console.error("Create maintenance task error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
