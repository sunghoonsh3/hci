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
  const subjectList = subjects.map((s) => s.subject);

  // Students type the catalog form ("CSE 20212"), but `subject` lives in
  // its own column. Detect a leading subject token so the keyword half can
  // hit `courseNumber` / `courseTitle` cleanly. An explicit dropdown subject
  // wins: if the parsed token disagrees with it, leave the keyword alone
  // rather than silently overriding the dropdown.
  let effectiveSubject = subject;
  let effectiveKeyword = keyword;
  const leadMatch = /^([A-Za-z]{2,4})\s+(.+)$/.exec(keyword.trim());
  if (leadMatch) {
    const parsedUpper = leadMatch[1].toUpperCase();
    const canonical = subjectList.find((s) => s.toUpperCase() === parsedUpper);
    if (canonical) {
      if (!effectiveSubject) {
        effectiveSubject = canonical;
        effectiveKeyword = leadMatch[2].trim();
      } else if (effectiveSubject.toUpperCase() === parsedUpper) {
        effectiveKeyword = leadMatch[2].trim();
      }
    }
  }

  const where: Record<string, unknown> = {};
  if (effectiveSubject) where.subject = effectiveSubject;
  if (effectiveKeyword) {
    where.OR = [
      { courseTitle: { contains: effectiveKeyword, mode: "insensitive" as const } },
      { description: { contains: effectiveKeyword, mode: "insensitive" as const } },
      { courseNumber: { contains: effectiveKeyword, mode: "insensitive" as const } },
      { subject: { contains: effectiveKeyword, mode: "insensitive" as const } },
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
