import type { EligibilityStatus, CompletedCourse } from "@/types";
import { extractPrereqGroups, prereqGroupsSatisfied } from "./restrictions";

interface SectionInfo {
  seatsAvailable: number | null;
  specialApproval: string | null;
}

export function computeEligibility(
  subject: string,
  courseNumber: string,
  registrationRestrictions: string | null,
  sections: SectionInfo[],
  completedCourses: CompletedCourse[],
  hasAudit: boolean = completedCourses.length > 0,
): EligibilityStatus {
  if (hasAudit) {
    const taken = completedCourses.find(
      (c) =>
        c.subject === subject &&
        c.courseNumber === courseNumber &&
        c.status === "completed",
    );
    if (taken) return "already-taken";
  }

  if (sections.length === 0) return "unknown";

  if (sections.every((s) => s.seatsAvailable !== null && s.seatsAvailable <= 0)) {
    return "full";
  }

  if (sections.some((s) => s.specialApproval)) {
    return "restricted";
  }

  if (hasAudit) {
    const groups = extractPrereqGroups(registrationRestrictions);
    if (groups.length > 0) {
      const completedCodes = completedCourses.map(
        (c) => `${c.subject} ${c.courseNumber}`,
      );
      if (!prereqGroupsSatisfied(groups, completedCodes)) return "needs-prereq";
    }
  }

  return "eligible";
}

/**
 * Shared source of truth for whether a course can be added to a Plan
 * or exported to NOVO. Mirrors what a real registration system would allow.
 */
export function isRegisterable(status: EligibilityStatus): boolean {
  return status === "eligible";
}

/**
 * Human-readable reason explaining why registration is blocked,
 * or null if the status is registerable.
 */
export function registrationBlockedReason(
  status: EligibilityStatus,
): string | null {
  switch (status) {
    case "eligible":
      return null;
    case "full":
      return "Section full";
    case "needs-prereq":
      return "Missing prerequisites";
    case "restricted":
      return "Special approval required";
    case "already-taken":
      return "Already taken";
    case "unknown":
      return "Course data unavailable";
  }
}
