import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Issue from "@/models/Issue";
import { requireDeptAdmin } from "@/lib/dept-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  await connectDB();
  const auth = await requireDeptAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;

  const worker = await User.findOne({
    _id: id,
    role: "staff",
    $or: [
      { department: { $in: auth.departmentIds } },
      { academicDepartment: { $in: auth.departmentIds } },
      { serviceDepartment: { $in: auth.departmentIds } },
    ],
  })
    .select("_id name email department academicDepartment serviceDepartment")
    .populate("department", "_id name")
    .populate("academicDepartment", "_id name")
    .populate("serviceDepartment", "_id name")
    .lean();

  if (!worker) {
    return NextResponse.json({ message: "Worker not found." }, { status: 404 });
  }

  const activeIssues = await Issue.find({ assignedStaff: worker._id, status: { $in: ["Pending", "In Progress"] } })
    .select("_id title status priority createdAt dueDate location student")
    .populate("student", "name")
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  const recentlyResolvedIssues = await Issue.find({ assignedStaff: worker._id, status: "Resolved" })
    .select("_id title status priority createdAt updatedAt dueDate location student")
    .populate("student", "name")
    .sort({ updatedAt: -1 })
    .limit(15)
    .lean();

  const [totalAssigned, totalResolved] = await Promise.all([
    Issue.countDocuments({ assignedStaff: worker._id }),
    Issue.countDocuments({ assignedStaff: worker._id, status: "Resolved" }),
  ]);

  const resolutionRate =
    totalAssigned > 0
      ? Math.round((totalResolved / totalAssigned) * 100)
      : null;

  return NextResponse.json({
    worker,
    activeIssues,
    recentlyResolvedIssues,
    stats: {
      totalAssigned,
      totalResolved,
      resolutionRate,
    },
  });
}
