import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Feedback from "@/models/Feedback";

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const stats = await Feedback.aggregate([
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        total: { $sum: 1 },
      },
    },
  ]);

  const summary = stats[0] || { averageRating: 0, total: 0 };
  return NextResponse.json({
    averageRating: Number(summary.averageRating || 0),
    total: Number(summary.total || 0),
  });
}
