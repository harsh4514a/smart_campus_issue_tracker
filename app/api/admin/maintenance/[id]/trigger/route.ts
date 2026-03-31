import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import MaintenanceTask from "@/models/MaintenanceTask";
import { runDueMaintenanceTasks } from "@/lib/maintenance";
import { getAdminDepartmentIds, isDeptAdmin, isSuperAdmin } from "@/lib/rbac";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const isSuper = isSuperAdmin(auth.user);
  const isDept = isDeptAdmin(auth.user);
  const scopeDepartmentIds = getAdminDepartmentIds(auth.user);

  if (!isSuper && !isDept) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const task = await MaintenanceTask.findById(id);
  if (!task) {
    return NextResponse.json({ message: "Maintenance task not found." }, { status: 404 });
  }

  if (!isSuper && !scopeDepartmentIds.includes(String(task.department || ""))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  task.nextDueDate = new Date(Date.now() - 1000);
  await task.save();
  await runDueMaintenanceTasks();

  return NextResponse.json({ message: "Maintenance task triggered." });
}
