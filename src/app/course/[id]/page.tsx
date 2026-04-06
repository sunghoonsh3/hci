import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
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

  return <CourseDetailClient course={JSON.parse(JSON.stringify(course))} />;
}
