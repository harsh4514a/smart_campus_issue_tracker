import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import User from "@/models/User";
import { buildDepartmentScopeFilter, requireDeptAdmin } from "@/lib/dept-admin";
import { getFromCache, setInCache } from "@/lib/server-cache";

const ISSUE_LIST_SELECT =
  "title category tags priority status createdAt dueDate student department academicDepartment serviceDepartment assignedStaff";

function parsePositiveInt(raw: string | null, fallback: number, max: number) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

export async function GET(request: Request) {
  await connectDB();
  const auth = await requireDeptAdmin(request);
  if (auth instanceof Response) return auth;

  const params = new URL(request.url).searchParams;
  const departmentId = params.get("departmentId");
  const status = params.get("status");
  const priority = params.get("priority");
  const category = (params.get("category") || "").trim();
  const workerId = (params.get("workerId") || "").trim();
  const autoAssignedOnly = params.get("autoAssignedOnly") === "1";
  const search = (params.get("search") || "").trim();
  const focusMode = params.get("focusMode") === "1";
  const unassignedOnly = params.get("unassignedOnly") === "1";
  const overdueOnly = params.get("overdueOnly") === "1";
  const sort = (params.get("sort") || "").trim();
  const sortBy = (params.get("sortBy") || "createdAt").trim();
  const sortOrder = (params.get("sortOrder") || "desc").toLowerCase() === "asc" ? 1 : -1;
  const dateFrom = params.get("dateFrom") || params.get("from");
  const dateTo = params.get("dateTo") || params.get("to");
  const page = parsePositiveInt(params.get("page"), 1, 99999);
  const limit = parsePositiveInt(params.get("limit"), 20, 100);
  const scopeKey = [...auth.departmentIds].sort().join(",") || "none";
  const canUseCache = search.length === 0;
  const cacheKey = `dept-admin:issues:${auth.user._id}:${scopeKey}:${params.toString() || "default"}`;

  if (canUseCache) {
    const cachedPayload = getFromCache<Record<string, unknown>>(cacheKey);
    if (cachedPayload) {
      return NextResponse.json(cachedPayload, {
        headers: {
          "Cache-Control": "private, max-age=6, stale-while-revalidate=12",
        },
      });
    }
  }

  const filter: Record<string, unknown> = {
    ...buildDepartmentScopeFilter(auth.departmentIds, departmentId),
  };
  const andFilters: Record<string, unknown>[] = [];

  if (status === "Assigned") {
    filter.assignedStaff = { $ne: null };
  } else if (status && status !== "All") {
    filter.status = status;
  }

  if (priority && priority !== "All") {
    filter.priority = priority;
  }

  if (workerId && workerId !== "All") {
    filter.assignedStaff = workerId;
  }

  if (autoAssignedOnly) {
    filter.tags = "auto_assigned";
  }

  if (category && category !== "All") {
    const normalized = category.toLowerCase();
    const categoryRegexMap: Record<string, RegExp> = {
      electrical: /electrical|electric/i,
      "it support": /it support|it\/network|it network|software|hardware/i,
      "network / internet": /network|internet|wifi|wi-fi/i,
      cleaning: /cleaning|house ?keeping|janitor/i,
      plumbing: /plumbing|plumber|water leak|water leakage|tap/i,
      furniture: /furniture|carpentry|carpenter|desk|chair/i,
    };

    filter.category = categoryRegexMap[normalized] || new RegExp(category, "i");
  }

  if (unassignedOnly) {
    filter.assignedStaff = null;
  }

  if (overdueOnly) {
    filter.dueDate = { $ne: null, $lt: new Date() };
    filter.status = { $nin: ["Resolved", "Rejected"] };
  }

  if (dateFrom || dateTo) {
    const range: Record<string, Date> = {};
    if (dateFrom) range.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    filter.createdAt = range;
  }

  if (search) {
    const studentIds = await User.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();

    andFilters.push({
      $or: [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
      { student: { $in: studentIds.map((row) => row._id) } },
      ],
    });
  }

  if (focusMode) {
    andFilters.push({
      $or: [
        { assignedStaff: null },
        {
          dueDate: { $ne: null, $lt: new Date() },
          status: { $nin: ["Resolved", "Rejected"] },
        },
        {
          priority: { $in: ["High", "Urgent"] },
          status: { $in: ["Pending", "In Progress"] },
        },
      ],
    });
  }

  if (andFilters.length > 0) {
    filter.$and = andFilters;
  }

  const requestedSort = sort.toLowerCase();
  const normalizedSort =
    requestedSort ||
    (sortBy === "priority" && sortOrder === 1
      ? "priority_low"
      : sortBy === "priority" && sortOrder === -1
        ? "priority_high"
        : sortBy === "createdat" && sortOrder === 1
          ? "oldest"
          : "latest");

  const needsPriorityRankSort = normalizedSort === "priority_high" || normalizedSort === "priority_low";
  const skip = (page - 1) * limit;

  const totalPromise = Issue.countDocuments(filter);
  const issuesPromise = needsPriorityRankSort
    ? (async () => {
        const rankedIds = await Issue.aggregate([
          { $match: filter },
          {
            $addFields: {
              priorityRank: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$priority", "Urgent"] }, then: 4 },
                    { case: { $eq: ["$priority", "High"] }, then: 3 },
                    { case: { $eq: ["$priority", "Medium"] }, then: 2 },
                    { case: { $eq: ["$priority", "Low"] }, then: 1 },
                  ],
                  default: 0,
                },
              },
            },
          },
          {
            $sort:
              normalizedSort === "priority_low"
                ? { priorityRank: 1 as const, createdAt: -1 as const }
                : { priorityRank: -1 as const, createdAt: -1 as const },
          },
          { $skip: skip },
          { $limit: limit },
          { $project: { _id: 1 } },
        ]);

        const ids = rankedIds.map((row) => row._id);
        if (ids.length === 0) return [];

        const docs = await Issue.find({ _id: { $in: ids } })
          .select(ISSUE_LIST_SELECT)
          .populate("student", "name email")
          .populate("department", "name type")
          .populate("academicDepartment", "name type")
          .populate("serviceDepartment", "name type")
          .populate("assignedStaff", "name email")
          .lean();

        const docMap = new Map(docs.map((doc) => [String(doc._id), doc]));
        return ids.map((id) => docMap.get(String(id))).filter(Boolean);
      })()
    : (() => {
        let sortClause: Record<string, 1 | -1> = { createdAt: -1 };

        if (normalizedSort === "oldest") {
          sortClause = { createdAt: 1 };
        } else if (normalizedSort === "latest") {
          sortClause = { createdAt: -1 };
        } else {
          const sortMap: Record<string, string> = {
            date: "createdAt",
            createdat: "createdAt",
            status: "status",
            title: "title",
          };
          const sortField = sortMap[sortBy.toLowerCase()] || "createdAt";
          sortClause = { [sortField]: sortOrder as 1 | -1, createdAt: -1 };
        }

        return Issue.find(filter)
          .select(ISSUE_LIST_SELECT)
          .populate("student", "name email")
          .populate("department", "name type")
          .populate("academicDepartment", "name type")
          .populate("serviceDepartment", "name type")
          .populate("assignedStaff", "name email")
          .sort(sortClause)
          .skip(skip)
          .limit(limit)
          .lean();
      })();

  const [total, issues] = await Promise.all([totalPromise, issuesPromise]);

  const payload = {
    issues,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };

  if (canUseCache) {
    setInCache(cacheKey, payload, 8_000);
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, max-age=6, stale-while-revalidate=12",
    },
  });
}
