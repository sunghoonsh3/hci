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
  const openOnly = params.open === "true";

  // Get all subjects for the filter dropdown
  const subjects = await prisma.course.findMany({
    select: { subject: true },
    distinct: ["subject"],
    orderBy: { subject: "asc" },
  });

  // Build where clause
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
    include: {
      sections: {
        include: {
          meetings: true,
          instructors: true,
        },
      },
    },
    orderBy: [{ subject: "asc" }, { courseNumber: "asc" }],
  });

  // If openOnly, filter to courses with at least one open section
  const filtered = openOnly
    ? courses.filter((c) =>
        c.sections.some(
          (s) => s.seatsAvailable !== null && s.seatsAvailable > 0
        )
      )
    : courses;

  return (
    <SearchClient
      courses={JSON.parse(JSON.stringify(filtered))}
      subjects={subjects.map((s) => s.subject)}
      initialSubject={subject}
      initialKeyword={keyword}
      initialOpenOnly={openOnly}
    />
  );
}
