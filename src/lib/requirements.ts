// BACS (BA Computer Science, Arts & Letters) requirement mapping
import type { RequirementBadge } from "@/types";

const CS_CORE = new Set([
  "CSE 20311",
  "CSE 20312",
  "CSE 20289",
  "CSE 30151",
  "CSE 40113",
  "CSE 40175",
]);

const MATH_REQUIRED = new Set([
  "MATH 10550",
  "MATH 10560",
  "CSE 20110",
]);

const MATH_ELECTIVE_OPTIONS = new Set([
  "MATH 20550",
  "MATH 20610",
  "MATH 20580",
  "ACMS 30440",
  "ACMS 30530",
]);

export function getRequirementBadges(
  subject: string,
  courseNumber: string
): RequirementBadge[] {
  const key = `${subject} ${courseNumber}`;
  const badges: RequirementBadge[] = [];

  if (CS_CORE.has(key)) {
    badges.push("CS Core");
  } else if (subject === "CSE" && parseInt(courseNumber) >= 30000) {
    badges.push("CS Elective");
  }

  if (MATH_REQUIRED.has(key) || MATH_ELECTIVE_OPTIONS.has(key)) {
    badges.push("Math Req");
  }

  return badges;
}

export function isCSCore(subject: string, courseNumber: string): boolean {
  return CS_CORE.has(`${subject} ${courseNumber}`);
}

export function isCSElective(subject: string, courseNumber: string): boolean {
  return (
    subject === "CSE" &&
    parseInt(courseNumber) >= 30000 &&
    !CS_CORE.has(`${subject} ${courseNumber}`)
  );
}
