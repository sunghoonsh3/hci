import type { CompletedCourse } from "@/types";

export interface ParsedRestriction {
  type: "prerequisite" | "level" | "campus" | "program-exclusion" | "other";
  raw: string;
  label: string;
  details?: string;
}

export interface PrereqCheck {
  courseCode: string;
  completed: boolean;
  grade?: string;
  term?: string;
}

const COURSE_CODE_RE = /[A-Z]{2,5}\s+\d{4,5}/g;

function safeParseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/**
 * True only when a line declares prerequisites as the lead clause.
 * Excludes lines like "Prerequisite OR corequisite: ..." or co-requisite notes.
 */
function isPureLeadPrereqLine(raw: string): boolean {
  const trimmed = raw.trim();
  if (!/^prerequisites?\s*:/i.test(trimmed)) return false;
  if (/corequisite/i.test(trimmed)) return false;
  return true;
}

function extractPrereqClause(raw: string): string | null {
  // Everything after "Prerequisites:" until end of line. Parentheses are
  // preserved so nested/grouped clauses parse correctly through AND/OR split.
  const m = raw.match(/Prerequisites?:\s*(.+?)\s*$/i);
  return m ? m[1] : null;
}

export function parseRestrictions(
  restrictionsJson: string | null,
): ParsedRestriction[] {
  const restrictions = safeParseStringArray(restrictionsJson);

  return restrictions.map((raw): ParsedRestriction => {
    const levelMatch = raw.match(/limited to (.+ level) students/i);
    if (levelMatch) {
      return { type: "level", raw, label: `${levelMatch[1]} only` };
    }

    const campusMatch = raw.match(/limited to students in the (.+) campus/i);
    if (campusMatch) {
      return { type: "campus", raw, label: `${campusMatch[1]} campus only` };
    }

    if (/cannot enroll.+program in/i.test(raw)) {
      return { type: "program-exclusion", raw, label: "Program restriction" };
    }

    if (isPureLeadPrereqLine(raw)) {
      const clause = extractPrereqClause(raw);
      if (clause) {
        // Strip outer wrapping parens purely for display cleanliness.
        const display = clause.replace(/^\((.*)\)$/, "$1");
        return {
          type: "prerequisite",
          raw,
          label: "Prerequisites required",
          details: display,
        };
      }
    }

    return { type: "other", raw, label: raw };
  });
}

/**
 * Parse prereqs into groups representing AND-of-OR.
 * Each inner array is a group whose members are alternatives (OR); any one
 * satisfies the group. All groups must be satisfied (AND).
 *
 * Examples:
 *   "Prerequisites: (CSE 20312 and CSE 20289)" → [[CSE 20312], [CSE 20289]]
 *   "Prerequisites: CSE 10550 or MATH 10550"   → [[CSE 10550, MATH 10550]]
 *   "Prerequisite OR corequisite: ..."          → [] (coreqs are not prereqs)
 */
export function extractPrereqGroups(
  restrictionsJson: string | null,
): string[][] {
  const restrictions = safeParseStringArray(restrictionsJson);
  const groups: string[][] = [];

  for (const raw of restrictions) {
    if (!isPureLeadPrereqLine(raw)) continue;
    const clause = extractPrereqClause(raw);
    if (!clause) continue;

    const andParts = clause.split(/\s+and\s+/i);
    for (const part of andParts) {
      const orParts = part.split(/\s+or\s+/i);
      const alternatives: string[] = [];
      for (const orPart of orParts) {
        const codes = orPart.match(COURSE_CODE_RE);
        if (codes) for (const code of codes) alternatives.push(code);
      }
      if (alternatives.length > 0) {
        groups.push([...new Set(alternatives)]);
      }
    }
  }

  return groups;
}

/**
 * Flatten prereq groups into a deduped list of all candidate course codes.
 * Kept for backward compatibility and display purposes.
 */
export function extractPrereqCourses(
  restrictionsJson: string | null,
): string[] {
  const groups = extractPrereqGroups(restrictionsJson);
  const flat = new Set<string>();
  for (const group of groups) for (const code of group) flat.add(code);
  return [...flat];
}

/**
 * True when each group has at least one completed alternative.
 */
export function prereqGroupsSatisfied(
  groups: string[][],
  completedCourseCodes: string[],
): boolean {
  if (groups.length === 0) return true;
  const completed = new Set(completedCourseCodes);
  return groups.every((group) => group.some((code) => completed.has(code)));
}

export function checkPrerequisites(
  restrictionsJson: string | null,
  completedCourses: CompletedCourse[],
): PrereqCheck[] {
  const prereqCodes = extractPrereqCourses(restrictionsJson);
  return prereqCodes.map((code) => {
    const [subject, number] = code.split(/\s+/);
    const completed = completedCourses.find(
      (c) => c.subject === subject && c.courseNumber === number,
    );
    return {
      courseCode: code,
      completed: !!completed,
      grade: completed?.grade,
      term: completed?.term,
    };
  });
}
