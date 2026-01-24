import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Issue from "@/models/Issue";

interface Params {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: Params) {
  await connectDB();
  const auth = await authenticateRequest(request, ["faculty", "staff", "admin"]);
  if (auth instanceof Response) return auth;

  const { id } = params;

  try {
    const { status } = await request.json();
    if (!status || !["Pending", "In Progress", "Resolved"].includes(status)) {
      return NextResponse.json({ message: "Invalid status." }, { status: 400 });
    }

    const issue = await Issue.findById(id);
    if (!issue) return NextResponse.json({ message: "Issue not found." }, { status: 404 });

    issue.status = status;
    await issue.save();

    return NextResponse.json({ message: "Status updated", issue });
  } catch (error) {
    console.error("Update status error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}