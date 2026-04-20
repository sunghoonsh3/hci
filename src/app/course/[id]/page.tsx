import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { extractPrereqCourses } from "@/lib/restrictions";
import CourseDetailClient from "./CourseDetailClient";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = Number.parseInt(id, 10);
  if (!Number.isFinite(courseId) || courseId <= 0) notFound();

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      subject: true,
      courseNumber: true,
      courseTitle: true,
      description: true,
      creditHoursMin: true,
      creditHoursMax: true,
      registrationRestrictions: true,
      cannotHaveTaken: true,
      attributes: true,
      sections: {
        select: {
          id: true,
          sectionNumber: true,
          crn: true,
          status: true,
          maxEnrollment: true,
          seatsAvailable: true,
          waitlistCurrent: true,
          waitlistCapacity: true,
          specialApproval: true,
          sectionNotes: true,
          meetings: {
            select: {
              id: true,
              room: true,
              startDate: true,
              endDate: true,
              days: true,
              startTime: true,
              endTime: true,
            },
          },
          instructors: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!course) notFound();

  const prereqCodes = extractPrereqCourses(course.registrationRestrictions);
  let cannotCodes: string[] = [];
  try {
    if (course.cannotHaveTaken) {
      const parsed = JSON.parse(course.cannotHaveTaken);
      if (Array.isArray(parsed)) {
        cannotCodes = parsed.filter((x): x is string => typeof x === "string");
      }
    }
  } catch {
    /* ignore malformed JSON */
  }

  const allCodes = [...new Set([...prereqCodes, ...cannotCodes])];
  const titleMap: Record<string, string> = {};

  if (allCodes.length > 0) {
    const conditions = allCodes.map((code) => {
      const [subject, courseNumber] = code.split(/\s+/);
      return { subject, courseNumber };
    });

    const found = await prisma.course.findMany({
      where: { OR: conditions },
      select: { subject: true, courseNumber: true, courseTitle: true },
    });

    for (const c of found) {
      titleMap[`${c.subject} ${c.courseNumber}`] = c.courseTitle;
    }
  }

  return <CourseDetailClient course={course} courseTitleMap={titleMap} />;
}
