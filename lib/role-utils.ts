import type { UserRole } from "@/models/User";

export function deriveStudentMetadataFromEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf("@");
  const localPart = atIndex > 0 ? normalized.slice(0, atIndex) : normalized;

  let course: string | null = null;
  if (localPart.includes("cs")) {
    course = "CSE";
  } else if (localPart.includes("ce")) {
    course = "CE";
  } else if (localPart.includes("it")) {
    course = "IT";
  }

  return {
    studentId: localPart ? localPart.toUpperCase() : null,
    course,
  };
}

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
