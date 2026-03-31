import mongoose, { Schema, Document, Model } from "mongoose";
import type { UserRole } from "./User";

export type OtpPurpose = "register" | "login" | "reset-password";

export interface IOtp extends Document {
  email: string;
  name: string;
  passwordHash: string;
  otpHash: string;
  purpose: OtpPurpose;
  role: UserRole;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    email: { type: String, required: true, index: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    otpHash: { type: String, required: true },
    purpose: { type: String, enum: ["register", "login", "reset-password"], default: "register", index: true },
    role: { type: String, enum: ["student", "faculty", "staff", "admin"], default: "student" },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    maxAttempts: { type: Number, required: true, default: 5, min: 1, max: 10 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Automatically remove expired OTPs via TTL index (MongoDB handles cleanup)
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp: Model<IOtp> = (mongoose.models.Otp as Model<IOtp>) || mongoose.model<IOtp>("Otp", OtpSchema);

export default Otp;