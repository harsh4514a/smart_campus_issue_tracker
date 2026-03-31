import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Department from "@/models/Department";
import { getOrSetCache } from "@/lib/server-cache";

export async function GET(request: Request) {
  await connectDB();

  const auth = await authenticateRequest(request, ["student", "faculty", "staff", "admin"]);
  if (auth instanceof Response) return auth;

  const departments = await getOrSetCache("departments:all", 60_000, async () =>
    Department.find().select("_id name type").sort({ name: 1 }).lean()
  );
  return NextResponse.json({ departments });
}
