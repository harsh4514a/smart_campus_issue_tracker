import mongoose from "mongoose";
import AuditLog from "@/models/AuditLog";

export async function createAuditLog(input: {
  issueId: mongoose.Types.ObjectId | string;
  action: string;
  performedBy: { userId?: mongoose.Types.ObjectId | string | null; name: string; role?: string | null };
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await AuditLog.create({
    issueId: input.issueId,
    action: input.action,
    performedBy: {
      userId: input.performedBy.userId || null,
      name: input.performedBy.name,
      role: input.performedBy.role || null,
    },
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    timestamp: new Date(),
  });
}
