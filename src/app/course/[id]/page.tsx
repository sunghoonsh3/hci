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
  const courseId = parseInt(id, 10);
  if (isNaN(courseId)) notFound();

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      sections: {
        include: {
          meetings: true,
          instructors: true,
        },
      },
    },
  });

  if (!course) notFound();

  // Look up titles for prerequisite and cannotHaveTaken courses
  const prereqCodes = extractPrereqCourses(course.registrationRestrictions);
  let cannotCodes: string[] = [];
  try {
    if (course.cannotHaveTaken) cannotCodes = JSON.parse(course.cannotHaveTaken);
  } catch { /* ignore */ }

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

  return (
    <CourseDetailClient
      course={JSON.parse(JSON.stringify(course))}
      courseTitleMap={titleMap}
    />
  );
}
