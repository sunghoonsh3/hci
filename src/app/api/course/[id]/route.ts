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

  // In production Vercel always populates `x-forwarded-for`; absence likely
  // indicates a misconfigured reverse-proxy or a direct invocation. Refuse
  // rather than silently collapsing all unidentified clients into one bucket.
  if (ip === null && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Client IP unavailable" },
      { status: 400 },
    );
  }

  const rl = rateLimit(
    `course:${ip ?? "unknown"}`,
    LIMIT_PER_WINDOW,
    WINDOW_MS,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSeconds ?? 60),
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
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
      "X-RateLimit-Limit": String(rl.limit),
      "X-RateLimit-Remaining": String(rl.remaining),
      "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
    },
  });
}
