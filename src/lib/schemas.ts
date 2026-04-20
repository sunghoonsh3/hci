import { z } from "zod";

export const MeetingSchema = z.object({
  id: z.number().optional(),
  room: z.string().nullable().optional(),
  days: z.string().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export const InstructorSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
});

export const SectionSchema = z.object({
  id: z.number(),
  sectionNumber: z.string().nullable(),
  crn: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  maxEnrollment: z.number().nullable(),
  seatsAvailable: z.number().nullable(),
  waitlistCurrent: z.number().nullable().optional(),
  waitlistCapacity: z.number().nullable().optional(),
  specialApproval: z.string().nullable(),
  sectionNotes: z.string().nullable().optional(),
  meetings: z.array(MeetingSchema),
  instructors: z.array(InstructorSchema),
});

export const CourseSchema = z.object({
  id: z.number(),
  subject: z.string(),
  courseNumber: z.string(),
  courseTitle: z.string(),
  description: z.string().nullable().optional(),
  creditHoursMin: z.number().nullable(),
  creditHoursMax: z.number().nullable(),
  registrationRestrictions: z.string().nullable(),
  cannotHaveTaken: z.string().nullable().optional(),
  attributes: z.string().nullable().optional(),
  sections: z.array(SectionSchema),
});

export type CourseDTO = z.infer<typeof CourseSchema>;
export type SectionDTO = z.infer<typeof SectionSchema>;
export type MeetingDTO = z.infer<typeof MeetingSchema>;

export const PlanSlotSchema = z.enum(["A", "B", "C"]);

export const PlanEntrySchema = z.object({
  courseId: z.number(),
  sectionId: z.number(),
  planSlot: PlanSlotSchema,
});

export const PlanEntriesSchema = z.array(PlanEntrySchema);

export const CompletedCourseSchema = z.object({
  subject: z.string(),
  courseNumber: z.string(),
  title: z.string(),
  grade: z.string(),
  credits: z.number(),
  term: z.string(),
  requirementBlock: z.string().optional(),
  status: z.enum(["completed", "in-progress"]),
});

export const ParsedAuditSchema = z.object({
  studentName: z.string(),
  studentId: z.string(),
  classification: z.string(),
  college: z.string(),
  major: z.string(),
  catalogYear: z.string(),
  gpa: z.number(),
  creditsRequired: z.number(),
  creditsApplied: z.number(),
  degreeProgress: z.number(),
  completedCourses: z.array(CompletedCourseSchema),
  inProgressCourses: z.array(CompletedCourseSchema),
});
