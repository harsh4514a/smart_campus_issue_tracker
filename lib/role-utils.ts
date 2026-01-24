import type { UserRole } from "@/models/User";

export function deriveRoleFromEmail(email: string): UserRole {
  const normalized = email.trim().toLowerCase();

  if (normalized.endsWith("@charusat.ac.in")) {
    return "faculty";
  }

  if (normalized.endsWith("@charusat.edu.in")) {
    return "student";
  }

  return "student";
}
