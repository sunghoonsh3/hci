import type { EligibilityStatus, CompletedCourse } from "@/types";
import { extractPrereqCourses } from "./restrictions";

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
    const prereqCodes = extractPrereqCourses(registrationRestrictions);
    if (prereqCodes.length > 0) {
      const allCompleted = completedCourses.map(
        (c) => `${c.subject} ${c.courseNumber}`,
      );
      const missingPrereq = prereqCodes.some(
        (code) => !allCompleted.includes(code),
      );
      if (missingPrereq) return "needs-prereq";
    }
  }

  return "eligible";
}
