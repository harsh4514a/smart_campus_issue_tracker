import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Issue from "@/models/Issue";
import Department from "@/models/Department";
import { requireDeptAdmin } from "@/lib/dept-admin";
import { getOrSetCache } from "@/lib/server-cache";

export async function GET(request: Request) {
  await connectDB();
  const auth = await requireDeptAdmin(request);
  if (auth instanceof Response) return auth;

  const params = new URL(request.url).searchParams;
  const search = (params.get("search") || "").trim();
  const departmentId = (params.get("departmentId") || "all").trim();
  const sort = (params.get("sort") || "name").trim();
  const cacheKey = `dept-admin:workers:${auth.user._id}:${[...auth.departmentIds].sort().join(",")}:${search}:${departmentId}:${sort}`;

  const cachedResponse = await getOrSetCache(cacheKey, 15_000, async () => {
    const scopedDepartmentIds =
      departmentId !== "all" && auth.departmentIds.includes(departmentId)
        ? [departmentId]
        : auth.departmentIds;

    if (scopedDepartmentIds.length === 0) {
      return { workers: [], departments: [] };
    }

    const workerFilter: Record<string, unknown> = {
      role: "staff",
      $or: [
        { department: { $in: scopedDepartmentIds } },
        { academicDepartment: { $in: scopedDepartmentIds } },
        { serviceDepartment: { $in: scopedDepartmentIds } },
      ],
    };

    if (search) {
      workerFilter.$and = [
        {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        },
      ];
    }

    const workers = await User.find(workerFilter)
      .select("_id name email designation department academicDepartment serviceDepartment managedDepartments")
      .populate("department", "_id name type")
      .populate("academicDepartment", "_id name type")
      .populate("serviceDepartment", "_id name type")
      .populate("managedDepartments", "_id name type")
      .sort({ name: 1 })
      .lean();

    const workerIds = workers.map((worker) => worker._id);

    const [activeCounts, pendingCounts, resolvedCounts, lastActiveRows] = await Promise.all([
      Issue.aggregate([
        { $match: { assignedStaff: { $in: workerIds }, status: { $nin: ["Resolved", "Rejected"] } } },
        { $group: { _id: "$assignedStaff", count: { $sum: 1 } } },
      ]),
      Issue.aggregate([
        { $match: { assignedStaff: { $in: workerIds }, status: "Pending" } },
        { $group: { _id: "$assignedStaff", count: { $sum: 1 } } },
      ]),
      Issue.aggregate([
        { $match: { assignedStaff: { $in: workerIds }, status: "Resolved" } },
        { $group: { _id: "$assignedStaff", count: { $sum: 1 } } },
      ]),
      Issue.aggregate([
        { $match: { assignedStaff: { $in: workerIds } } },
        { $group: { _id: "$assignedStaff", lastActiveAt: { $max: "$updatedAt" } } },
      ]),
    ]);

    const activeMap = new Map(activeCounts.map((row) => [String(row._id), Number(row.count)]));
    const pendingMap = new Map(pendingCounts.map((row) => [String(row._id), Number(row.count)]));
    const resolvedMap = new Map(resolvedCounts.map((row) => [String(row._id), Number(row.count)]));
    const lastActiveMap = new Map(lastActiveRows.map((row) => [String(row._id), row.lastActiveAt]));

    const data = workers.map((worker) => {
      const id = String(worker._id);
      const activeIssues = activeMap.get(id) || 0;
      const pendingIssues = pendingMap.get(id) || 0;
      const resolvedCount = resolvedMap.get(id) || 0;
      const loadStatus = activeIssues >= 6 ? "Overloaded" : activeIssues >= 3 ? "Moderate" : "Available";
      const lastActiveAt = lastActiveMap.get(id) ? new Date(lastActiveMap.get(id)).toISOString() : null;

      return {
        _id: id,
        name: worker.name,
        email: worker.email,
        designation: worker.designation || null,
        department: worker.department || null,
        academicDepartment: worker.academicDepartment || null,
        serviceDepartment: worker.serviceDepartment || null,
        managedDepartments: Array.isArray(worker.managedDepartments) ? worker.managedDepartments : [],
        activeIssues,
        pendingIssues,
        resolvedCount,
        loadStatus,
        lastActiveAt,
      };
    });

    if (sort === "load_asc") {
      data.sort((a, b) => a.activeIssues - b.activeIssues || a.name.localeCompare(b.name));
    } else if (sort === "load_desc") {
      data.sort((a, b) => b.activeIssues - a.activeIssues || a.name.localeCompare(b.name));
    } else {
      data.sort((a, b) => a.name.localeCompare(b.name));
    }

    const departments = await Department.find({ _id: { $in: auth.departmentIds } })
      .select("_id name type")
      .sort({ name: 1 })
      .lean();

    return { workers: data, departments };
  });

  return NextResponse.json(cachedResponse);
}
