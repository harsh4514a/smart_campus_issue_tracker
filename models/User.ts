import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "student" | "faculty" | "staff" | "admin";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isDemoUser?: boolean;
  department?: mongoose.Types.ObjectId | null;
  academicDepartment?: mongoose.Types.ObjectId | null;
  serviceDepartment?: mongoose.Types.ObjectId | null;
  studentId?: string | null;
  institute?: string | null;
  course?: string | null;
  mobileNumber?: string | null;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ["student", "faculty", "staff", "admin"],
      required: true,
      default: "student",
    },
    isDemoUser: { type: Boolean, default: false },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    academicDepartment: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    serviceDepartment: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    studentId: { type: String, trim: true, default: null },
    institute: { type: String, trim: true, default: null },
    course: { type: String, trim: true, default: null },
    mobileNumber: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function hashPassword(next) {
  const user = this as IUser;

  if (!user.isModified("password")) return next();

  // If password already appears to be hashed, skip re-hashing (allows pre-hashed storage from OTP flow)
  if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$") || user.password.startsWith("$2y$")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function comparePassword(candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>("User", UserSchema);

const cachedUserModel = mongoose.models.User as Model<IUser> | undefined;

if (cachedUserModel && !cachedUserModel.schema.path("academicDepartment")) {
  cachedUserModel.schema.add({
    academicDepartment: { type: Schema.Types.ObjectId, ref: "Department", default: null },
  });
}

if (cachedUserModel && !cachedUserModel.schema.path("serviceDepartment")) {
  cachedUserModel.schema.add({
    serviceDepartment: { type: Schema.Types.ObjectId, ref: "Department", default: null },
  });
}

if (cachedUserModel && !cachedUserModel.schema.path("studentId")) {
  cachedUserModel.schema.add({
    studentId: { type: String, trim: true, default: null },
  });
}

if (cachedUserModel && !cachedUserModel.schema.path("institute")) {
  cachedUserModel.schema.add({
    institute: { type: String, trim: true, default: null },
  });
}

if (cachedUserModel && !cachedUserModel.schema.path("course")) {
  cachedUserModel.schema.add({
    course: { type: String, trim: true, default: null },
  });
}

if (cachedUserModel && !cachedUserModel.schema.path("mobileNumber")) {
  cachedUserModel.schema.add({
    mobileNumber: { type: String, trim: true, default: null },
  });
}

if (cachedUserModel && !cachedUserModel.schema.path("isDemoUser")) {
  cachedUserModel.schema.add({
    isDemoUser: { type: Boolean, default: false },
  });
}

export default User;