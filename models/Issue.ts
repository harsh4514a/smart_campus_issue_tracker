import mongoose, { Schema, Document, Model } from "mongoose";

export type IssueStatus = "Pending" | "In Progress" | "Resolved";

export interface IIssue extends Document {
  title: string;
  description: string;
  category: string;
  location: string;
  status: IssueStatus;
  student: mongoose.Types.ObjectId;
  department: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const IssueSchema = new Schema<IIssue>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved"],
      default: "Pending",
    },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const Issue: Model<IIssue> =
  (mongoose.models.Issue as Model<IIssue>) || mongoose.model<IIssue>("Issue", IssueSchema);

export default Issue;