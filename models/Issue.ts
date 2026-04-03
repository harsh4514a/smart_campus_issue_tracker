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
  attachments?: string[];
  resolutionAttachments?: string[];
  status: IssueStatus;
  student: mongoose.Types.ObjectId;
  department: mongoose.Types.ObjectId | null;
  academicDepartment: mongoose.Types.ObjectId | null;
  serviceDepartment: mongoose.Types.ObjectId | null;
  assignedStaff: mongoose.Types.ObjectId | null;
  priority?: IssuePriority | null;
  dueDate?: Date | null;
  overdueNotifiedAt?: Date | null;
  recurring?: boolean;
  tags?: string[];
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
    attachments: { type: [String], default: [] },
    resolutionAttachments: { type: [String], default: [] },
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
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    overdueNotifiedAt: { type: Date, default: null },
    recurring: { type: Boolean, default: false, index: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

// Query indexes for issue list filtering/sorting in admin and department-admin views.
IssueSchema.index({ status: 1, createdAt: -1 });
IssueSchema.index({ status: 1, priority: 1, createdAt: -1 });
IssueSchema.index({ priority: 1, createdAt: -1 });
IssueSchema.index({ department: 1, createdAt: -1 });
IssueSchema.index({ academicDepartment: 1, createdAt: -1 });
IssueSchema.index({ serviceDepartment: 1, createdAt: -1 });
IssueSchema.index({ department: 1, status: 1, priority: 1, createdAt: -1 });
IssueSchema.index({ academicDepartment: 1, status: 1, priority: 1, createdAt: -1 });
IssueSchema.index({ serviceDepartment: 1, status: 1, priority: 1, createdAt: -1 });
IssueSchema.index({ category: 1, createdAt: -1 });
IssueSchema.index({ assignedStaff: 1, status: 1, createdAt: -1 });

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

if (cachedIssueModel && !cachedIssueModel.schema.path("dueDate")) {
  cachedIssueModel.schema.add({
    dueDate: { type: Date, default: null, index: true },
  });
}

if (cachedIssueModel && !cachedIssueModel.schema.path("attachments")) {
  cachedIssueModel.schema.add({
    attachments: { type: [String], default: [] },
  });
}

if (cachedIssueModel && !cachedIssueModel.schema.path("resolutionAttachments")) {
  cachedIssueModel.schema.add({
    resolutionAttachments: { type: [String], default: [] },
  });
}

if (cachedIssueModel && !cachedIssueModel.schema.path("overdueNotifiedAt")) {
  cachedIssueModel.schema.add({
    overdueNotifiedAt: { type: Date, default: null },
  });
}

if (cachedIssueModel && !cachedIssueModel.schema.path("recurring")) {
  cachedIssueModel.schema.add({
    recurring: { type: Boolean, default: false, index: true },
  });
}

if (cachedIssueModel && !cachedIssueModel.schema.path("tags")) {
  cachedIssueModel.schema.add({
    tags: { type: [String], default: [] },
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