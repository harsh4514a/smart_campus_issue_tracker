import mongoose, { Schema, Document, Model } from "mongoose";

export type IssueStatus = "Pending" | "In Progress" | "Resolved" | "Rejected";
export type IssuePriority = "Low" | "Medium" | "High" | "Urgent";

export interface IIssue extends Document {
  title: string;
  description: string;
  category: string;
  location: string;
  normalizedTitle: string;
  locationKey: string;
  imageUrl?: string | null;
  status: IssueStatus;
  student: mongoose.Types.ObjectId;
  department: mongoose.Types.ObjectId | null;
  academicDepartment: mongoose.Types.ObjectId | null;
  serviceDepartment: mongoose.Types.ObjectId | null;
  assignedStaff: mongoose.Types.ObjectId | null;
  priority?: IssuePriority | null;
  createdAt: Date;
}

const IssueSchema = new Schema<IIssue>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: false, default: "", trim: true },
    category: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    normalizedTitle: { type: String, default: "", index: true },
    locationKey: { type: String, default: "", index: true },
  imageUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved", "Rejected"],
      default: "Pending",
    },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    academicDepartment: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    serviceDepartment: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    assignedStaff: { type: Schema.Types.ObjectId, ref: "User", default: null },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const cachedIssueModel = mongoose.models.Issue as Model<IIssue> | undefined;

if (cachedIssueModel && !cachedIssueModel.schema.path("academicDepartment")) {
  cachedIssueModel.schema.add({
    academicDepartment: { type: Schema.Types.ObjectId, ref: "Department", default: null },
  });
}

if (cachedIssueModel && !cachedIssueModel.schema.path("serviceDepartment")) {
  cachedIssueModel.schema.add({
    serviceDepartment: { type: Schema.Types.ObjectId, ref: "Department", default: null },
  });
}

if (cachedIssueModel && !cachedIssueModel.schema.path("assignedStaff")) {
  cachedIssueModel.schema.add({
    assignedStaff: { type: Schema.Types.ObjectId, ref: "User", default: null },
  });
}

if (cachedIssueModel && !cachedIssueModel.schema.path("priority")) {
  cachedIssueModel.schema.add({
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: null,
    },
  });
}

if (cachedIssueModel && cachedIssueModel.schema.path("description")) {
  const descriptionPath = cachedIssueModel.schema.path("description") as {
    required?: (isRequired: boolean) => void;
    options?: { required?: boolean; default?: unknown };
  };

  if (typeof descriptionPath.required === "function") {
    descriptionPath.required(false);
  }

  if (descriptionPath.options) {
    descriptionPath.options.required = false;
    descriptionPath.options.default = "";
  }
}

const Issue: Model<IIssue> =
  (mongoose.models.Issue as Model<IIssue>) || mongoose.model<IIssue>("Issue", IssueSchema);

export default Issue;