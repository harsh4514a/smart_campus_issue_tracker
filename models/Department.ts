import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDepartment extends Document {
  name: string;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

const Department: Model<IDepartment> =
  (mongoose.models.Department as Model<IDepartment>) ||
  mongoose.model<IDepartment>("Department", DepartmentSchema);

export default Department;