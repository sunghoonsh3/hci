// Parse registration restriction text into plain language
import type { CompletedCourse } from "@/types";

export interface ParsedRestriction {
  type: "prerequisite" | "level" | "campus" | "program-exclusion" | "other";
  raw: string;
  label: string;
  details?: string;
}

export interface PrereqCheck {
  courseCode: string;       // "CSE 20312"
  completed: boolean;
  grade?: string;
  term?: string;
}

export function parseRestrictions(restrictionsJson: string | null): ParsedRestriction[] {
  if (!restrictionsJson) return [];

  let restrictions: string[];
  try {
    restrictions = JSON.parse(restrictionsJson);
  } catch {
    return [];
  }

  return restrictions.map((raw) => {
    // Level restriction
    const levelMatch = raw.match(/limited to (.+ level) students/i);
    if (levelMatch) {
      return { type: "level", raw, label: `${levelMatch[1]} only` };
    }

    // Campus restriction
    const campusMatch = raw.match(/limited to students in the (.+) campus/i);
    if (campusMatch) {
      return { type: "campus", raw, label: `${campusMatch[1]} campus only` };
    }

    // Program exclusion
    if (/cannot enroll.+program in/i.test(raw)) {
      return { type: "program-exclusion", raw, label: "Program restriction" };
    }

    // Prerequisites
    const prereqMatch = raw.match(/Prerequisites?:\s*\(([^)]+)\)/i);
    if (prereqMatch) {
      return {
        type: "prerequisite",
        raw,
        label: "Prerequisites required",
        details: prereqMatch[1],
      };
    }

    // Fallback
    return { type: "other", raw, label: raw };
  });
}

export function extractPrereqCourses(restrictionsJson: string | null): string[] {
  if (!restrictionsJson) return [];

  let restrictions: string[];
  try {
    restrictions = JSON.parse(restrictionsJson);
  } catch {
    return [];
  }

  const courses: string[] = [];
  for (const r of restrictions) {
    const match = r.match(/Prerequisites?:\s*\(([^)]+)\)/i);
    if (match) {
      // Extract course codes like "CSE 20312" from the prereq string
      const codes = match[1].match(/[A-Z]{2,5}\s+\d{4,5}/g);
      if (codes) courses.push(...codes);
    }
  }
  return courses;
}

export function checkPrerequisites(
  restrictionsJson: string | null,
  completedCourses: CompletedCourse[]
): PrereqCheck[] {
  const prereqCodes = extractPrereqCourses(restrictionsJson);
  return prereqCodes.map((code) => {
    const [subject, number] = code.split(/\s+/);
    const completed = completedCourses.find(
      (c) => c.subject === subject && c.courseNumber === number
    );
    return {
      courseCode: code,
      completed: !!completed,
      grade: completed?.grade,
      term: completed?.term,
    };
  });
}
