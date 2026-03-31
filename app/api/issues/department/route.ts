import { NextResponse } from "next/server";
import type { PipelineStage, PopulateOptions } from "mongoose";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import type { IssuePriority, IssueStatus } from "@/models/Issue";
import "@/models/Department"; // register Department for populate
import { authenticateRequest } from "@/lib/auth";

type SortBy = "created_desc" | "created_asc" | "priority_desc" | "sla_deadline";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const ISSUE_LIST_SELECT =
  "title description category location status createdAt updatedAt dueDate priority student department academicDepartment serviceDepartment assignedStaff";

const VALID_STATUS: IssueStatus[] = ["Pending", "In Progress", "Resolved", "Rejected"];
const VALID_PRIORITY: IssuePriority[] = ["Low", "Medium", "High", "Urgent"];

const POPULATE_OPTIONS: PopulateOptions[] = [
  { path: "student", select: "name email" },
  { path: "department", select: "_id name type" },
  { path: "academicDepartment", select: "_id name type" },
  { path: "serviceDepartment", select: "_id name type" },
  { path: "assignedStaff", select: "_id name email" },
];

const ISSUE_LIST_PROJECT: Record<string, 0 | 1> = {
  title: 1,
  description: 1,
  category: 1,
  location: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
  dueDate: 1,
  priority: 1,
  student: 1,
  department: 1,
  academicDepartment: 1,
  serviceDepartment: 1,
  assignedStaff: 1,
};

export async function GET(request: Request) {
  try {
    await connectDB();
  } catch (error) {
    console.error("DB connection failed for /api/issues/department:", error);
    return NextResponse.json(
      { message: "Database unavailable. Please try again shortly." },
      { status: 503 }
    );
  }

  const authResult = await authenticateRequest(request, ["faculty", "staff"]);
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const limitParam = Number.parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
    const hasPagination = searchParams.has("page") || searchParams.has("limit");
    const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT;

    const statusFilter = parseStatus(searchParams.get("status"));
    const priorityFilter = parsePriority(searchParams.get("priority"));
    const sortBy = parseSortBy(searchParams.get("sortBy"));
    const rawSearch = (searchParams.get("search") || "").trim();
    const searchTerm = rawSearch.length >= 2 ? rawSearch.slice(0, 100) : "";

    const query = buildQuery({
      assignedStaff: user._id,
      statusFilter,
      priorityFilter,
      searchTerm,
    });

    let totalItems = 0;
    if (hasPagination) {
      totalItems = await Issue.countDocuments(query);
    }

    const totalPages = hasPagination ? Math.max(1, Math.ceil(totalItems / limit)) : 1;
    const currentPage = hasPagination ? Math.min(requestedPage, totalPages) : 1;
    const skip = hasPagination ? (currentPage - 1) * limit : 0;

    const issues = await fetchIssues({
      query,
      sortBy,
      hasPagination,
      skip,
      limit,
    });

    if (!hasPagination) {
      totalItems = issues.length;
    }

    return NextResponse.json({
      issues,
      totalItems,
      totalPages,
      currentPage,
      limit: hasPagination ? limit : Math.max(issues.length, 1),
    });
  } catch (error) {
    console.error("Fetch department issues error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

function parseStatus(value: string | null): IssueStatus | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const resolved =
    normalized === "pending"
      ? "Pending"
      : normalized === "in progress"
        ? "In Progress"
        : normalized === "resolved"
          ? "Resolved"
          : normalized === "rejected"
            ? "Rejected"
            : null;

  if (!resolved || !VALID_STATUS.includes(resolved)) return null;
  return resolved;
}

function parsePriority(value: string | null): IssuePriority | "none" | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();

  if (normalized === "none" || normalized === "no priority") {
    return "none";
  }

  const resolved =
    normalized === "low"
      ? "Low"
      : normalized === "medium"
        ? "Medium"
        : normalized === "high"
          ? "High"
          : normalized === "urgent"
            ? "Urgent"
            : null;

  if (!resolved || !VALID_PRIORITY.includes(resolved)) return null;
  return resolved;
}

function parseSortBy(value: string | null): SortBy {
  if (value === "created_desc" || value === "created_asc" || value === "priority_desc" || value === "sla_deadline") {
    return value;
  }

  return "created_desc";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildQuery({
  assignedStaff,
  statusFilter,
  priorityFilter,
  searchTerm,
}: {
  assignedStaff: unknown;
  statusFilter: IssueStatus | null;
  priorityFilter: IssuePriority | "none" | null;
  searchTerm: string;
}) {
  const query: Record<string, unknown> = {
    assignedStaff,
  };

  if (statusFilter) {
    query.status = statusFilter;
  }

  const andClauses: Record<string, unknown>[] = [];

  if (priorityFilter === "none") {
    andClauses.push({
      $or: [{ priority: null }, { priority: { $exists: false } }],
    });
  } else if (priorityFilter) {
    query.priority = priorityFilter;
  }

  if (searchTerm) {
    const regex = new RegExp(escapeRegExp(searchTerm), "i");
    andClauses.push({
      $or: [
        { title: regex },
        { description: regex },
        { category: regex },
        { location: regex },
      ],
    });
  }

  if (andClauses.length > 0) {
    query.$and = andClauses;
  }

  return query;
}

async function fetchIssues({
  query,
  sortBy,
  hasPagination,
  skip,
  limit,
}: {
  query: Record<string, unknown>;
  sortBy: SortBy;
  hasPagination: boolean;
  skip: number;
  limit: number;
}) {
  if (sortBy === "created_desc" || sortBy === "created_asc") {
    const sort = sortBy === "created_desc" ? { createdAt: -1 as const } : { createdAt: 1 as const };

    const findQuery = Issue.find(query)
      .select(ISSUE_LIST_SELECT)
      .populate([...POPULATE_OPTIONS])
      .sort(sort);

    if (hasPagination) {
      findQuery.skip(skip).limit(limit);
    }

    return findQuery.lean();
  }

  const pipeline: PipelineStage[] = [{ $match: query as Record<string, unknown> }];

  if (sortBy === "priority_desc") {
    pipeline.push({
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
    } as PipelineStage);
    pipeline.push({ $sort: { priorityRank: -1, createdAt: -1 } });
  } else {
    pipeline.push({
      $addFields: {
        statusRank: {
          $cond: [{ $in: ["$status", ["Resolved", "Rejected"]] }, 1, 0],
        },
        dueSort: {
          $cond: [
            { $in: ["$status", ["Resolved", "Rejected"]] },
            new Date("9999-12-31T23:59:59.999Z"),
            { $ifNull: ["$dueDate", new Date("9999-12-31T23:59:59.999Z")] },
          ],
        },
        closedSort: {
          $cond: [
            { $in: ["$status", ["Resolved", "Rejected"]] },
            { $ifNull: ["$updatedAt", "$createdAt"] },
            new Date("1970-01-01T00:00:00.000Z"),
          ],
        },
      },
    } as PipelineStage);
    pipeline.push({
      $sort: {
        statusRank: 1,
        dueSort: 1,
        closedSort: -1,
        createdAt: -1,
      },
    });
  }

  pipeline.push({ $project: ISSUE_LIST_PROJECT } as PipelineStage);

  if (hasPagination) {
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
  }

  const rawIssues = await Issue.aggregate(pipeline as PipelineStage[]);
  return Issue.populate(rawIssues, [...POPULATE_OPTIONS]);
}