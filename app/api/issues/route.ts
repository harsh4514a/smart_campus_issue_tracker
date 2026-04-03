import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import type { IssueStatus } from "@/models/Issue";
import Department from "@/models/Department";
import User from "@/models/User";
import { authenticateRequest } from "@/lib/auth";
import { normalizeTitle, buildLocationKey, wordSetSimilarity } from "@/lib/duplicate-check";
import { calculateDueDateByPriority } from "@/lib/sla";
import { createAuditLog } from "@/lib/audit";
import { getAdminRecipientEmails, sendIssueEventEmail } from "@/lib/issue-mailer";

const SIMILARITY_THRESHOLD = 0.75;
const DEFAULT_MAX_ACTIVE_ISSUES = 8;
const VALID_STATUS: IssueStatus[] = ["Pending", "In Progress", "Resolved", "Rejected"];

const CATEGORY_SERVICE_KEYWORDS: Record<string, string[]> = {
  cleaning: ["cleaning", "clean", "janitor", "housekeep"],
  electrical: ["electrical", "elect"],
  "it support": ["it support", "software", "system", "login", "project", "code"],
  "network / internet": ["network", "internet", "wifi", "wi-fi", "connectivity", "lan"],
  "network/internet": ["network", "internet", "wifi", "wi-fi", "connectivity", "lan"],
  plumbing: ["plumbing", "plumb"],
  furniture: ["furniture", "chair", "desk", "table", "door"],
  // Legacy aliases for backward compatibility with older categories.
  maintenance: ["maintenance", "maint"],
  cleanliness: ["clean", "janitor", "housekeep"],
  security: ["security", "secur"],
  other: ["service", "support"],
};

const CATEGORY_SERVICE_ALIASES: Record<string, string[]> = {
  cleaning: ["cleaning", "cleanliness"],
  electrical: ["electrical"],
  "it support": ["it support", "it-support", "it"],
  "network / internet": ["network / internet", "network/internet", "network and internet", "internet"],
  plumbing: ["plumbing"],
  furniture: ["furniture"],
};

export async function GET(request: Request) {
  await connectDB();

  const authResult = await authenticateRequest(request, ["student", "faculty"]);
  if (authResult instanceof Response) return authResult;

  try {
    const { searchParams } = new URL(request.url);

    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const limitParam = Number.parseInt(searchParams.get("limit") || "20", 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

    const status = parseStatus(searchParams.get("status"));
    const category = (searchParams.get("category") || "").trim().slice(0, 80);
    const rawSearch = (searchParams.get("search") || "").trim();
    const searchTerm = rawSearch.length >= 2 ? rawSearch.slice(0, 100) : "";
    const sortBy = parseSortBy(searchParams.get("sortBy"));

    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (searchTerm) {
      const regex = new RegExp(escapeRegExp(searchTerm), "i");
      query.$or = [{ title: regex }, { category: regex }, { location: regex }, { description: regex }];
    }

    const totalItems = await Issue.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const currentPage = Math.min(page, totalPages);
    const skip = (currentPage - 1) * limit;

    const sort: Record<string, 1 | -1> = { createdAt: -1 };
    if (sortBy === "created_asc") {
      sort.createdAt = 1;
    } else if (sortBy === "status") {
      sort.status = 1;
      sort.createdAt = -1;
    } else if (sortBy === "category") {
      sort.category = 1;
      sort.createdAt = -1;
    }

    const issues = await Issue.find(query)
      .select("title category location status createdAt")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const hasMore = currentPage < totalPages;

    return NextResponse.json({
      issues,
      page: currentPage,
      limit,
      totalItems,
      totalPages,
      hasMore,
    });
  } catch (error) {
    console.error("Fetch all issues error", error);
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

function parseSortBy(value: string | null) {
  if (value === "created_asc" || value === "status" || value === "category") return value;
  return "created_desc";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(request: Request) {
  await connectDB();

  const authResult = await authenticateRequest(request, ["student", "faculty"]);
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;

  try {
    const { title, description, category, location, departmentId, imageUrl } = await request.json();

    if (!title || !category || !location) {
      return NextResponse.json({ message: "Title, category, and location are required." }, { status: 400 });
    }

    const normalizedDescription = typeof description === "string" ? description.trim() : "";

    /* ---- Compute normalized fields ---- */
    const normalizedTitle = normalizeTitle(title);
    const locationKey = buildLocationKey(location);

    /* ---- Duplicate detection ---- */
    // Fetch all unresolved issues in the same category, then compare
    // normalized values in application code. This handles both new issues
    // (with stored normalizedTitle/locationKey) and legacy issues without them.
    const candidates = await Issue.find({
      category,
      status: { $nin: ["Resolved", "Rejected"] },
    })
      .select("title location normalizedTitle locationKey")
      .lean();

    const isDuplicate = candidates.some((c) => {
      const cNormTitle = c.normalizedTitle || normalizeTitle(c.title);
      const cLocKey = c.locationKey || buildLocationKey(c.location);
      if (cLocKey !== locationKey) return false;
      // Exact match or word-set similarity ≥ 75%
      return cNormTitle === normalizedTitle || wordSetSimilarity(cNormTitle, normalizedTitle) >= SIMILARITY_THRESHOLD;
    });

    if (isDuplicate) {
      return NextResponse.json(
        { message: "This issue has already been reported for this location." },
        { status: 409 },
      );
    }
    /* ---- End duplicate detection ---- */

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

    const mappedServiceDepartmentId = await resolveServiceDepartmentIdByCategory(category);
    const selectedAcademicDepartmentId = department?.type === "Academic" ? department._id : null;
    const selectedServiceDepartmentId = department?.type === "Service" ? department._id : null;
    const finalServiceDepartmentId = selectedServiceDepartmentId || mappedServiceDepartmentId || null;
    const finalAcademicDepartmentId = selectedAcademicDepartmentId;
    const finalDepartmentId = finalServiceDepartmentId || finalAcademicDepartmentId || null;

    const initialPriority = "Medium";

    const lookbackStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recurringSimilarCount = await Issue.countDocuments({
      category,
      department: finalDepartmentId,
      createdAt: { $gte: lookbackStart },
    });

    const parsedMaxActive = Number.parseInt(process.env.AUTO_ASSIGN_MAX_ACTIVE_ISSUES || "", 10);
    const maxActiveIssues = Number.isFinite(parsedMaxActive) && parsedMaxActive > 0
      ? parsedMaxActive
      : DEFAULT_MAX_ACTIVE_ISSUES;

    const autoAssignResult = await findAutoAssignableWorker({
      departmentId: finalDepartmentId ? String(finalDepartmentId) : null,
      academicDepartmentId: finalAcademicDepartmentId ? String(finalAcademicDepartmentId) : null,
      serviceDepartmentId: finalServiceDepartmentId ? String(finalServiceDepartmentId) : null,
      category,
      maxActiveIssues,
    });

    const issue = await Issue.create({
      title,
      description: normalizedDescription,
      category,
      location,
      normalizedTitle,
      locationKey,
      imageUrl: typeof imageUrl === "string" && imageUrl.trim().length > 0 ? imageUrl : null,
      attachments: typeof imageUrl === "string" && imageUrl.trim().length > 0 ? [imageUrl] : [],
      status: "Pending",
      student: user._id,
      department: finalDepartmentId,
      academicDepartment: finalAcademicDepartmentId,
      serviceDepartment: finalServiceDepartmentId,
      assignedStaff: autoAssignResult.workerId || null,
      priority: initialPriority,
      dueDate: calculateDueDateByPriority(initialPriority),
      recurring: recurringSimilarCount >= 3,
      tags: autoAssignResult.workerId ? ["auto_assigned"] : [],
    });

    await createAuditLog({
      issueId: issue._id,
      action: "Issue created",
      performedBy: {
        userId: user._id,
        name: user.name,
        role: user.role,
      },
      newValue: {
        status: issue.status,
        priority: issue.priority,
        assignedStaff: autoAssignResult.workerId || null,
      },
    });

    if (autoAssignResult.workerId) {
      await createAuditLog({
        issueId: issue._id,
        action: "Assigned to worker",
        performedBy: {
          userId: null,
          name: "Auto Assignment Engine",
          role: "system",
        },
        oldValue: { assignedStaff: null },
        newValue: {
          assignedStaff: autoAssignResult.workerName,
          reason: autoAssignResult.reason,
        },
      });
    }

    try {
      const explicitDepartmentId = department?._id ? String(department._id) : "";
      const issueDepartmentIds = explicitDepartmentId
        ? [explicitDepartmentId]
        : [finalDepartmentId, finalAcademicDepartmentId, finalServiceDepartmentId]
            .map((value) => String(value || ""))
            .filter(Boolean)
            .filter((value, index, arr) => arr.indexOf(value) === index);

      const adminRecipients = await getAdminRecipientEmails({ issueDepartmentIds });

      if (adminRecipients.length > 0) {
        await sendIssueEventEmail({
          event: "created",
          to: adminRecipients,
          issue: {
            id: issue._id.toString(),
            title: issue.title,
            department: department?.name || null,
            priority: issue.priority,
            status: issue.status,
          },
          actorName: user.name,
        });
      }

      if (autoAssignResult.workerId) {
        const autoAssignedWorker = await User.findById(autoAssignResult.workerId)
          .select("email")
          .lean<{ email?: string }>();

        const workerEmail = String(autoAssignedWorker?.email || "").trim();
        if (workerEmail) {
          await sendIssueEventEmail({
            event: "assigned",
            to: [workerEmail],
            issue: {
              id: issue._id.toString(),
              title: issue.title,
              department: department?.name || null,
              priority: issue.priority,
              status: issue.status,
            },
            actorName: "Auto Assignment Engine",
          });
        }
      }
    } catch (mailErr) {
      console.error("Issue created email error", mailErr);
    }

    const populatedIssue = await Issue.findById(issue._id)
      .populate("student", "name email")
      .populate("department", "name type")
      .populate("academicDepartment", "name type")
      .populate("serviceDepartment", "name type")
      .populate("assignedStaff", "name email")
      .lean();

    return NextResponse.json(
      {
        message: "Issue created",
        issue: populatedIssue,
        autoAssignment: autoAssignResult.workerId
          ? `Auto-assigned to ${autoAssignResult.workerName}`
          : "No suitable worker found",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create issue error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

async function findAutoAssignableWorker(input: {
  departmentId: string | null;
  academicDepartmentId: string | null;
  serviceDepartmentId: string | null;
  category: string;
  maxActiveIssues: number;
}): Promise<{ workerId: string | null; workerName: string | null; reason: string }> {
  if (!input.departmentId) {
    return { workerId: null, workerName: null, reason: "No department mapped" };
  }

  const normalizedCategory = input.category.trim().toLowerCase();

  const toId = (value: unknown) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      const maybeId = (value as { _id?: unknown })._id;
      if (typeof maybeId === "string") return maybeId;
      if (maybeId && typeof maybeId === "object" && "toString" in maybeId) {
        return String(maybeId);
      }
      if ("toString" in value) {
        return String(value);
      }
    }
    return String(value);
  };

  const workers = await User.find({
    role: "staff",
    $or: [
      { department: input.departmentId },
      { academicDepartment: input.departmentId },
      { serviceDepartment: input.departmentId },
    ],
  })
    .select("_id name designation department academicDepartment serviceDepartment managedDepartments")
    .populate("department", "_id name")
    .populate("academicDepartment", "_id name")
    .populate("serviceDepartment", "_id name")
    .populate("managedDepartments", "_id name")
    .lean();

  if (workers.length === 0) {
    return { workerId: null, workerName: null, reason: "No worker in department" };
  }

  const departmentScopedWorkers = workers.filter((worker) => {
    const workerAcademicIds = [
      toId(worker.academicDepartment),
      toId(worker.department),
      ...(Array.isArray(worker.managedDepartments)
        ? worker.managedDepartments.map((value) => toId(value))
        : []),
    ].filter(Boolean);

    const workerServiceIds = [
      toId(worker.serviceDepartment),
      toId(worker.department),
    ].filter(Boolean);

    // If issue has an academic department (e.g. CSE), do not assign cross-academic workers (e.g. CE).
    if (input.academicDepartmentId && !workerAcademicIds.includes(input.academicDepartmentId)) {
      return false;
    }

    // If issue is mapped to a service department, keep service scope strict too.
    if (input.serviceDepartmentId && !workerServiceIds.includes(input.serviceDepartmentId)) {
      return false;
    }

    return true;
  });

  if (departmentScopedWorkers.length === 0) {
    return { workerId: null, workerName: null, reason: "No worker in exact department scope" };
  }

  // If issue category is mapped to a specific service department, scope filtering above already
  // guarantees category relevance for workers in that service department.
  const categoryMatched = input.serviceDepartmentId
    ? departmentScopedWorkers
    : departmentScopedWorkers.filter((worker) => {
        const categoryHints = [
          String(worker.designation || ""),
          String((worker as { department?: { name?: string } }).department?.name || ""),
          String((worker as { serviceDepartment?: { name?: string } }).serviceDepartment?.name || ""),
          String((worker as { academicDepartment?: { name?: string } }).academicDepartment?.name || ""),
          ...(Array.isArray((worker as { managedDepartments?: Array<{ name?: string }> }).managedDepartments)
            ? (worker as { managedDepartments?: Array<{ name?: string }> }).managedDepartments!.map((department) =>
                String(department?.name || "")
              )
            : []),
        ]
          .join(" ")
          .toLowerCase();

        return categoryHints.includes(normalizedCategory);
      });

  // Auto-assign only when there is exactly one category+department match.
  if (categoryMatched.length === 0) {
    return { workerId: null, workerName: null, reason: "No worker matched this category in department" };
  }

  const candidateWorkers = categoryMatched;
  const workerIds = candidateWorkers.map((worker) => worker._id);

  const activeRows = await Issue.aggregate([
    {
      $match: {
        assignedStaff: { $in: workerIds },
        status: { $nin: ["Resolved", "Rejected"] },
      },
    },
    { $group: { _id: "$assignedStaff", count: { $sum: 1 } } },
  ]);

  const activeMap = new Map(activeRows.map((row) => [String(row._id), Number(row.count)]));

  const eligible = candidateWorkers
    .map((worker) => ({
      worker,
      activeIssues: activeMap.get(String(worker._id)) || 0,
    }))
    .filter((item) => item.activeIssues < Math.max(1, input.maxActiveIssues));

  if (eligible.length === 0) {
    return { workerId: null, workerName: null, reason: "All matching workers are at max load" };
  }

  eligible.sort((a, b) => a.activeIssues - b.activeIssues || String(a.worker.name).localeCompare(String(b.worker.name)));
  const selected = eligible[0].worker;
  return {
    workerId: String(selected._id),
    workerName: String(selected.name || "Worker"),
    reason: "Category and department matched; least-busy worker selected",
  };
}

async function resolveServiceDepartmentIdByCategory(category: string) {
  const normalizedCategory = category.trim().toLowerCase();

  const aliases = CATEGORY_SERVICE_ALIASES[normalizedCategory] || [normalizedCategory];

  // 1) Prefer exact/near-exact alias matching to avoid accidental substring matches.
  const serviceDepartments = await Department.find({ type: "Service" })
    .select("_id name")
    .lean();

  const normalizeName = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const normalizedAliasSet = new Set(aliases.map(normalizeName));

  const exactMatch = serviceDepartments.find((department) => {
    const normalizedDepartmentName = normalizeName(String(department.name || ""));
    return normalizedAliasSet.has(normalizedDepartmentName);
  });

  if (exactMatch?._id) {
    return exactMatch._id;
  }

  // 2) Fallback to keyword matching with word boundaries for safer routing.
  const keywords = CATEGORY_SERVICE_KEYWORDS[normalizedCategory] || [normalizedCategory];
  for (const keyword of keywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\b)${escaped}(\\b|$)`, "i");
    const matchedDepartment = serviceDepartments.find((department) => regex.test(String(department.name || "")));
    if (matchedDepartment?._id) {
      return matchedDepartment._id;
    }
  }

  return null;
}