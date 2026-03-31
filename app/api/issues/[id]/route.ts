import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Issue from "@/models/Issue";
import Department from "@/models/Department";
import { buildLocationKey, normalizeTitle, wordSetSimilarity } from "@/lib/duplicate-check";
import { canAdminAccessIssue } from "@/lib/rbac";

const SIMILARITY_THRESHOLD = 0.75;

const CATEGORY_SERVICE_KEYWORDS: Record<string, string[]> = {
  maintenance: ["maintenance", "maint"],
  electrical: ["electrical", "elect"],
  plumbing: ["plumbing", "plumb"],
  cleanliness: ["clean", "janitor", "housekeep"],
  security: ["security", "secur"],
  other: ["service", "support"],
};

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  await connectDB();
  const auth = await authenticateRequest(request, ["student", "faculty"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const isValidId = Issue.db.base.Types.ObjectId.isValid(id);
  if (!isValidId) {
    return NextResponse.json({ message: "Invalid issue id." }, { status: 400 });
  }

  const issue = await Issue.findById(id);
  if (!issue) return NextResponse.json({ message: "Issue not found." }, { status: 404 });

  if (issue.student.toString() !== auth.user._id.toString()) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ issue });
}

export async function PATCH(request: Request, { params }: Params) {
  await connectDB();
  const auth = await authenticateRequest(request, ["student", "faculty"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const isValidId = Issue.db.base.Types.ObjectId.isValid(id);
  if (!isValidId) {
    return NextResponse.json({ message: "Invalid issue id." }, { status: 400 });
  }

  try {
    const { title, description, category, location, imageUrl } = await request.json();
    if (!title || !category || !location) {
      return NextResponse.json({ message: "Title, category, and location are required." }, { status: 400 });
    }

    const normalizedDescription = typeof description === "string" ? description.trim() : "";

    const normalizedTitle = normalizeTitle(title);
    const locationKey = buildLocationKey(location);

    const issue = await Issue.findById(id);
    if (!issue) return NextResponse.json({ message: "Issue not found." }, { status: 404 });

    if (issue.student.toString() !== auth.user._id.toString()) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Prevent duplicates on edit (exclude current issue id)
    const candidates = await Issue.find({
      _id: { $ne: id },
      category,
      status: { $nin: ["Resolved", "Rejected"] },
    })
      .select("title location normalizedTitle locationKey")
      .lean();

    const isDuplicate = candidates.some((c) => {
      const cLocKey = c.locationKey || buildLocationKey(c.location);
      if (cLocKey !== locationKey) return false;
      const cNormTitle = c.normalizedTitle || normalizeTitle(c.title);
      return cNormTitle === normalizedTitle || wordSetSimilarity(cNormTitle, normalizedTitle) >= SIMILARITY_THRESHOLD;
    });

    if (isDuplicate) {
      return NextResponse.json(
        { message: "This issue has already been reported for this location." },
        { status: 409 },
      );
    }

    issue.title = title;
    issue.description = normalizedDescription;
    issue.category = category;
    issue.location = location;
    issue.normalizedTitle = normalizedTitle;
    issue.locationKey = locationKey;

    const mappedServiceDepartmentId = await resolveServiceDepartmentIdByCategory(category);
    if (mappedServiceDepartmentId) {
      issue.serviceDepartment = mappedServiceDepartmentId;
      issue.department = mappedServiceDepartmentId;
    }

    if (typeof imageUrl === "string") {
      issue.imageUrl = imageUrl.trim().length > 0 ? imageUrl : null;
    }
    await issue.save();

    return NextResponse.json({ message: "Issue updated", issue });
  } catch (error) {
    console.error("Update issue error", error);
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

export async function DELETE(request: Request, { params }: Params) {
  await connectDB();
  const auth = await authenticateRequest(request, ["student", "faculty", "admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const isValidId = Issue.db.base.Types.ObjectId.isValid(id);
  if (!isValidId) {
    return NextResponse.json({ message: "Invalid issue id." }, { status: 400 });
  }

  try {
    const issue = await Issue.findById(id);
    if (!issue) return NextResponse.json({ message: "Issue not found." }, { status: 404 });

    const isAdmin = auth.user.role === "admin";
    const isOwner = issue.student.toString() === auth.user._id.toString();

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (isAdmin && !canAdminAccessIssue(auth.user, issue)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    await issue.deleteOne();
    return NextResponse.json({ message: "Issue deleted" });
  } catch (error) {
    console.error("Delete issue error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
