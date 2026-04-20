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

    if (/prerequisite/i.test(raw)) {
      const parenMatch = raw.match(/Prerequisites?:\s*\(([^)]+)\)/i);
      if (parenMatch) {
        return {
          type: "prerequisite",
          raw,
          label: "Prerequisites required",
          details: parenMatch[1],
        };
      }
      const bareMatch = raw.match(/Prerequisites?:\s*(.+?)\s*$/i);
      if (bareMatch) {
        return {
          type: "prerequisite",
          raw,
          label: "Prerequisites required",
          details: bareMatch[1],
        };
      }
    }

    return { type: "other", raw, label: raw };
  });
}

export function extractPrereqCourses(restrictionsJson: string | null): string[] {
  const restrictions = safeParseStringArray(restrictionsJson);
  const courses = new Set<string>();

  for (const r of restrictions) {
    if (!/prerequisite/i.test(r)) continue;
    const codes = r.match(COURSE_CODE_RE);
    if (codes) for (const c of codes) courses.add(c);
  }

  return [...courses];
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
