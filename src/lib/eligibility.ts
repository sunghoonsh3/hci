// Compute eligibility status for a course given audit data
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
  hasAudit: boolean = completedCourses.length > 0
): EligibilityStatus {
  // 1. Already taken (completed, not in-progress)
  if (hasAudit) {
    const taken = completedCourses.find(
      (c) =>
        c.subject === subject &&
        c.courseNumber === courseNumber &&
        c.status === "completed"
    );
    if (taken) return "already-taken";
  }

  // 2. All sections full
  if (
    sections.length > 0 &&
    sections.every((s) => s.seatsAvailable !== null && s.seatsAvailable <= 0)
  ) {
    return "full";
  }

  // 3. Restricted (special approval required) — check before prereqs
  //    since this is a section-level property that applies regardless of audit
  if (sections.some((s) => s.specialApproval)) {
    return "restricted";
  }

  // 4. Needs prerequisite (only check when we have audit data to compare against)
  if (hasAudit) {
    const prereqCodes = extractPrereqCourses(registrationRestrictions);
    if (prereqCodes.length > 0) {
      const allCompleted = completedCourses.map(
        (c) => `${c.subject} ${c.courseNumber}`
      );
      const missingPrereq = prereqCodes.some(
        (code) => !allCompleted.includes(code)
      );
      if (missingPrereq) return "needs-prereq";
    }
  }

  // 5. Eligible
  return "eligible";
}
