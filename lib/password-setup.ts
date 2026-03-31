import jwt from "jsonwebtoken";

export type PasswordSetupPayload = {
  purpose: "dept-admin-password-setup" | "staff-password-setup";
  userId: string;
  email: string;
};

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("Please set the JWT_SECRET environment variable.");
}

const passwordSetupSecret = `${jwtSecret}:password-setup`;

export function signPasswordSetupToken(
  payload: Omit<PasswordSetupPayload, "purpose"> & { purpose?: PasswordSetupPayload["purpose"] }
) {
  return jwt.sign({ ...payload, purpose: payload.purpose || "dept-admin-password-setup" }, passwordSetupSecret, {
    expiresIn: "24h",
  });
}

export function verifyPasswordSetupToken(token: string) {
  const decoded = jwt.verify(token, passwordSetupSecret) as jwt.JwtPayload & PasswordSetupPayload;

  if (
    (decoded.purpose !== "dept-admin-password-setup" && decoded.purpose !== "staff-password-setup") ||
    !decoded.userId ||
    !decoded.email
  ) {
    throw new Error("Invalid token payload");
  }

  return {
    userId: decoded.userId,
    email: decoded.email,
    purpose: decoded.purpose,
  };
}
