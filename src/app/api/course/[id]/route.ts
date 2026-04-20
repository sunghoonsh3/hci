import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const LIMIT_PER_WINDOW = 120;
const WINDOW_MS = 60_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = clientIp(request);
  const rl = rateLimit(`course:${ip}`, LIMIT_PER_WINDOW, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSeconds ?? 60),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const { id } = await params;
  const courseId = Number.parseInt(id, 10);
  if (!Number.isFinite(courseId) || courseId <= 0) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

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

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(course, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}
