import mongoose, { Schema, Document, Model } from "mongoose";

export type MaintenanceFrequency = "Weekly" | "Monthly" | "Quarterly" | "Yearly";

export interface IMaintenanceTask extends Document {
  title: string;
  department: mongoose.Types.ObjectId;
  assignedWorker: mongoose.Types.ObjectId | null;
  frequency: MaintenanceFrequency;
  nextDueDate: Date;
  notes?: string | null;
  lastRunAt?: Date | null;
  status: "Upcoming" | "Overdue";
}

const MaintenanceTaskSchema = new Schema<IMaintenanceTask>(
  {
    title: { type: String, required: true, trim: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    assignedWorker: { type: Schema.Types.ObjectId, ref: "User", default: null },
    frequency: {
      type: String,
      enum: ["Weekly", "Monthly", "Quarterly", "Yearly"],
      required: true,
      default: "Monthly",
    },
    nextDueDate: { type: Date, required: true, index: true },
    notes: { type: String, default: null, trim: true },
    lastRunAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["Upcoming", "Overdue"],
      default: "Upcoming",
    },
  },
  { timestamps: true }
);

const MaintenanceTask: Model<IMaintenanceTask> =
  (mongoose.models.MaintenanceTask as Model<IMaintenanceTask>) ||
  mongoose.model<IMaintenanceTask>("MaintenanceTask", MaintenanceTaskSchema);

export default MaintenanceTask;
