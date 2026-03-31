import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import Otp, { type IOtp, type OtpPurpose } from "@/models/Otp";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
const OTP_DIGITS = 6;
const OTP_REGEX = /^\d{6}$/;

export type VerifyOtpResult =
  | { ok: true; otpRecord: IOtp }
  | { ok: false; status: number; message: string };

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isOtpFormatValid(otp: string) {
  return OTP_REGEX.test(otp);
}

export function generateOtp() {
  const min = 10 ** (OTP_DIGITS - 1);
  const max = 10 ** OTP_DIGITS;
  return String(randomInt(min, max));
}

export async function createOtpRecord(params: {
  email: string;
  purpose: OtpPurpose;
  name: string;
  passwordHash: string;
  role: IOtp["role"];
}) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);

  // Enforce one active OTP per user by removing old records before creating a new one.
  await Otp.deleteMany({ email: params.email });

  await Otp.create({
    email: params.email,
    purpose: params.purpose,
    name: params.name,
    passwordHash: params.passwordHash,
    role: params.role,
    otpHash,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
  });

  return otp;
}

export async function verifyOtpRecord(params: { email: string; purpose: OtpPurpose; otp: string }): Promise<VerifyOtpResult> {
  const otpRecord = await Otp.findOne({ email: params.email, purpose: params.purpose });
  if (!otpRecord) {
    return { ok: false, status: 404, message: "OTP not found or expired." };
  }

  if (otpRecord.expiresAt.getTime() <= Date.now()) {
    await otpRecord.deleteOne();
    return { ok: false, status: 400, message: "OTP expired." };
  }

  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    await otpRecord.deleteOne();
    return { ok: false, status: 429, message: "Too many OTP attempts. Please request a new code." };
  }

  const isValid = await bcrypt.compare(params.otp, otpRecord.otpHash);
  if (!isValid) {
    otpRecord.attempts += 1;

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      await otpRecord.deleteOne();
      return { ok: false, status: 429, message: "Too many OTP attempts. Please request a new code." };
    }

    await otpRecord.save();
    return {
      ok: false,
      status: 401,
      message: `Invalid OTP. ${otpRecord.maxAttempts - otpRecord.attempts} attempt(s) remaining.`,
    };
  }

  await otpRecord.deleteOne();
  return { ok: true, otpRecord };
}
