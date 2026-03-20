import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import Department from "@/models/Department";
import { authenticateRequest } from "@/lib/auth";
import { normalizeTitle, buildLocationKey, wordSetSimilarity } from "@/lib/duplicate-check";

const SIMILARITY_THRESHOLD = 0.75;

const CATEGORY_SERVICE_KEYWORDS: Record<string, string[]> = {
  maintenance: ["maintenance", "maint"],
  electrical: ["electrical", "elect"],
  plumbing: ["plumbing", "plumb"],
  cleanliness: ["clean", "janitor", "housekeep"],
  security: ["security", "secur"],
  other: ["service", "support"],
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
    const skip = (page - 1) * limit;

    const issues = await Issue.find({})
      .select("title category location status createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();

    const hasMore = issues.length > limit;
    const paginatedIssues = hasMore ? issues.slice(0, limit) : issues;

    return NextResponse.json({
      issues: paginatedIssues,
      page,
      limit,
      hasMore,
    });
  } catch (error) {
    console.error("Fetch all issues error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
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

    const issue = await Issue.create({
      title,
      description: normalizedDescription,
      category,
      location,
      normalizedTitle,
      locationKey,
      imageUrl: typeof imageUrl === "string" && imageUrl.trim().length > 0 ? imageUrl : null,
      status: "Pending",
      student: user._id,
      department: finalDepartmentId,
      academicDepartment: finalAcademicDepartmentId,
      serviceDepartment: finalServiceDepartmentId,
    });

    return NextResponse.json({ message: "Issue created", issue }, { status: 201 });
  } catch (error) {
    console.error("Create issue error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

async function resolveServiceDepartmentIdByCategory(category: string) {
  const normalizedCategory = category.trim().toLowerCase();
  const keywords = CATEGORY_SERVICE_KEYWORDS[normalizedCategory] || [normalizedCategory];

  for (const keyword of keywords) {
    const matchedDepartment = await Department.findOne({
      type: "Service",
      name: { $regex: keyword, $options: "i" },
    })
      .select("_id")
      .lean();

    if (matchedDepartment?._id) {
      return matchedDepartment._id;
    }
  }

  return null;
}