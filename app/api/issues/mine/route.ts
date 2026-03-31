import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import type { IssueStatus } from "@/models/Issue";
import "@/models/Department"; // register Department for populate
import { authenticateRequest } from "@/lib/auth";

const VALID_STATUS: IssueStatus[] = ["Pending", "In Progress", "Resolved", "Rejected"];

export async function GET(request: Request) {
  await connectDB();

  const authResult = await authenticateRequest(request, ["student", "faculty"]);
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);

    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const limitParam = Number.parseInt(searchParams.get("limit") || "50", 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 50;

    const status = parseStatus(searchParams.get("status"));
    const rawSearch = (searchParams.get("search") || "").trim();
    const searchTerm = rawSearch.length >= 2 ? rawSearch.slice(0, 100) : "";

    const query: Record<string, unknown> = { student: user._id };

    if (status) {
      query.status = status;
    }

    if (searchTerm) {
      const regex = new RegExp(escapeRegExp(searchTerm), "i");
      query.$or = [{ title: regex }, { description: regex }, { category: regex }, { location: regex }];
    }

    const totalItems = await Issue.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const currentPage = Math.min(page, totalPages);
    const skip = (currentPage - 1) * limit;

    const issues = await Issue.find(query)
      .select("title description category status location imageUrl createdAt updatedAt dueDate")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json({
      issues,
      page: currentPage,
      limit,
      totalItems,
      totalPages,
      hasMore: currentPage < totalPages,
    });
  } catch (error) {
    console.error("Fetch my issues error", error);
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}