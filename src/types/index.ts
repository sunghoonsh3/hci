// Shared types for Registration Clarity

export interface CompletedCourse {
  subject: string;        // "CSE"
  courseNumber: string;    // "20312"
  title: string;          // "Data Structures"
  grade: string;          // "A", "B+", "IP"
  credits: number;        // 4
  term: string;           // "Fall 2024"
  requirementBlock?: string; // "Major in Computer Science"
  status: "completed" | "in-progress";
}

export interface ParsedAudit {
  studentName: string;
  studentId: string;
  classification: string;     // "Senior"
  college: string;            // "College of Arts and Letters"
  major: string;              // "Computer Science (BA)"
  catalogYear: string;        // "2022"
  gpa: number;                // 3.419
  creditsRequired: number;    // 122
  creditsApplied: number;     // 134.5
  degreeProgress: number;     // 98
  completedCourses: CompletedCourse[];
  inProgressCourses: CompletedCourse[];
}

export interface PlanEntry {
  courseId: number;
  sectionId: number;
  planSlot: "A" | "B" | "C";
}

export type EligibilityStatus =
  | "eligible"
  | "full"
  | "restricted"
  | "needs-prereq"
  | "already-taken";

export interface PreCheckItem {
  label: string;
  passed: boolean;
  message: string;
}

export interface PreCheckResult {
  prerequisites: PreCheckItem;
  classStanding: PreCheckItem;
  seatAvailability: PreCheckItem;
  timeConflicts: PreCheckItem;
  repeatCheck: PreCheckItem;
  permission: PreCheckItem;
}

export type PlanSlot = "A" | "B" | "C";

// Requirement badge types
export type RequirementBadge =
  | "CS Core"
  | "CS Elective"
  | "Math Req"
  | "University Core"
  | "College Req";
