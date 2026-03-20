import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDepartment extends Document {
  name: string;
  type: "Academic" | "Service";
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["Academic", "Service"],
      default: "Service",
      trim: true,
    },
  },
  { timestamps: true }
);

const cachedModel = mongoose.models.Department as Model<IDepartment> | undefined;

if (cachedModel && !cachedModel.schema.path("type")) {
  cachedModel.schema.add({
    type: {
      type: String,
      required: true,
      enum: ["Academic", "Service"],
      default: "Service",
      trim: true,
    },
  });
}

if (cachedModel && cachedModel.schema.path("description")) {
  const legacyDescriptionPath = cachedModel.schema.path("description") as {
    required?: (isRequired: boolean) => void;
    options?: { required?: boolean; default?: unknown };
  };

  if (typeof legacyDescriptionPath.required === "function") {
    legacyDescriptionPath.required(false);
  }

  if (legacyDescriptionPath.options) {
    legacyDescriptionPath.options.required = false;
    legacyDescriptionPath.options.default = undefined;
  }
}

const Department: Model<IDepartment> =
  cachedModel || mongoose.model<IDepartment>("Department", DepartmentSchema);

export default Department;