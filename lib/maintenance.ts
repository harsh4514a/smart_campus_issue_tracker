import Issue from "@/models/Issue";
import MaintenanceTask from "@/models/MaintenanceTask";
import { calculateDueDateByPriority } from "@/lib/sla";
import User from "@/models/User";

function getNextDueDate(frequency: "Weekly" | "Monthly" | "Quarterly" | "Yearly", fromDate: Date) {
  const next = new Date(fromDate);

  if (frequency === "Weekly") {
    next.setDate(next.getDate() + 7);
  } else if (frequency === "Monthly") {
    next.setMonth(next.getMonth() + 1);
  } else if (frequency === "Quarterly") {
    next.setMonth(next.getMonth() + 3);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }

  return next;
}

export async function runDueMaintenanceTasks() {
  const now = new Date();
  const tasks = await MaintenanceTask.find({ nextDueDate: { $lte: now } });
  const fallbackUser = await User.findOne({ role: "admin" }).select("_id").lean();

  for (const task of tasks) {
    if (!fallbackUser?._id) {
      continue;
    }

    await Issue.create({
      title: task.title,
      description: task.notes || "Auto-generated from scheduled maintenance task",
      category: "Maintenance",
      location: "Campus",
      status: "Pending",
      student: fallbackUser._id,
      department: task.department,
      serviceDepartment: task.department,
      assignedStaff: task.assignedWorker,
      priority: "Medium",
      dueDate: calculateDueDateByPriority("Medium"),
      tags: ["Scheduled Maintenance"],
      recurring: false,
    });

    task.lastRunAt = now;
    task.nextDueDate = getNextDueDate(task.frequency, now);
    task.status = task.nextDueDate < now ? "Overdue" : "Upcoming";
    await task.save();
  }

  return tasks.length;
}
