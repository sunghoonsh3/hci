import { prisma } from "@/lib/db";
import SearchClient from "./SearchClient";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const subject = typeof params.subject === "string" ? params.subject : "";
  const keyword = typeof params.keyword === "string" ? params.keyword : "";
  // `open` is preserved for deep-link compatibility; the actual filtering
  // happens in SearchClient so the checkbox toggles without a round trip.
  const openOnly = params.open === "true";

  const subjects = await prisma.course.findMany({
    select: { subject: true },
    distinct: ["subject"],
    orderBy: { subject: "asc" },
  });

  const where: Record<string, unknown> = {};
  if (subject) where.subject = subject;
  if (keyword) {
    where.OR = [
      { courseTitle: { contains: keyword, mode: "insensitive" as const } },
      { description: { contains: keyword, mode: "insensitive" as const } },
      { courseNumber: { contains: keyword, mode: "insensitive" as const } },
    ];
  }

  const courses = await prisma.course.findMany({
    where,
    select: {
      id: true,
      subject: true,
      courseNumber: true,
      courseTitle: true,
      creditHoursMin: true,
      creditHoursMax: true,
      registrationRestrictions: true,
      sections: {
        select: {
          id: true,
          seatsAvailable: true,
          maxEnrollment: true,
          specialApproval: true,
          meetings: {
            select: { days: true, startTime: true, endTime: true },
          },
          instructors: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: [{ subject: "asc" }, { courseNumber: "asc" }],
  });

  return (
    <SearchClient
      courses={courses}
      subjects={subjects.map((s) => s.subject)}
      initialSubject={subject}
      initialKeyword={keyword}
      initialOpenOnly={openOnly}
    />
  );
}
