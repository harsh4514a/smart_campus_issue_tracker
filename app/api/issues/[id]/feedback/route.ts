import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Issue from "@/models/Issue";
import Feedback from "@/models/Feedback";
import { createAuditLog } from "@/lib/audit";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  await connectDB();
  const auth = await authenticateRequest(request, ["student", "faculty", "admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  if (auth.user.role === "admin") {
    const feedback = await Feedback.find({ issueId: id }).sort({ submittedAt: -1 }).lean();
    return NextResponse.json({ feedback });
  }

  const feedback = await Feedback.findOne({ issueId: id, studentId: auth.user._id }).lean();
  return NextResponse.json({ feedback });
}

export async function POST(request: Request, { params }: Params) {
  await connectDB();
  const auth = await authenticateRequest(request, ["student", "faculty"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  const issue = await Issue.findById(id).select("student status");
  if (!issue) {
    return NextResponse.json({ message: "Issue not found." }, { status: 404 });
  }

  if (String(issue.student) !== String(auth.user._id)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (issue.status !== "Resolved") {
    return NextResponse.json({ message: "Feedback can be submitted only for resolved issues." }, { status: 400 });
  }

  const { rating, comment } = await request.json();
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ message: "Rating must be between 1 and 5." }, { status: 400 });
  }

  const feedback = await Feedback.findOneAndUpdate(
    { issueId: id, studentId: auth.user._id },
    {
      issueId: id,
      studentId: auth.user._id,
      rating,
      comment: typeof comment === "string" ? comment.trim() || null : null,
      submittedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  await createAuditLog({
    issueId: id,
    action: "Feedback submitted",
    performedBy: { userId: auth.user._id, name: auth.user.name, role: auth.user.role },
    newValue: { rating: feedback.rating },
  });

  return NextResponse.json({ message: "Feedback saved.", feedback });
}
