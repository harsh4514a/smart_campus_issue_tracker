import mongoose, { Schema, Document, Model } from "mongoose";

export type OtpPurpose = "register" | "reset";

export interface IOtp extends Document {
  email: string;
  name: string;
  passwordHash: string;
  otp: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    email: { type: String, required: true, index: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    otp: { type: String, required: true },
  purpose: { type: String, enum: ["register", "reset"], default: "register", index: true },
  expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Automatically remove expired OTPs via TTL index (MongoDB handles cleanup)
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp: Model<IOtp> = (mongoose.models.Otp as Model<IOtp>) || mongoose.model<IOtp>("Otp", OtpSchema);

export default Otp;