import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAuditLog extends Document {
  issueId: mongoose.Types.ObjectId;
  action: string;
  performedBy: {
    userId: mongoose.Types.ObjectId | null;
    name: string;
    role?: string | null;
  };
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true, index: true },
    action: { type: String, required: true, trim: true },
    performedBy: {
      userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
      name: { type: String, required: true, trim: true },
      role: { type: String, default: null },
    },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

const AuditLog: Model<IAuditLog> =
  (mongoose.models.AuditLog as Model<IAuditLog>) || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;
