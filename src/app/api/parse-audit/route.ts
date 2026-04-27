import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { ParsedAuditSchema } from "@/lib/schemas";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const LIMIT_PER_WINDOW = 5;
const WINDOW_MS = 60_000;
const MAX_AUDIT_CHARS = 60_000;

const SYSTEM_PROMPT = `You extract structured data from Notre Dame Degree Works audits.

Input format varies. Two known shapes:
  (A) Web-UI scrape with each course spanning 5 lines (code, title, grade, credits, term).
  (B) Linearized text where requirement labels and course rows can collide on one line, with credits sometimes wrapped in parens like "(3)" for in-progress.
Other layouts may appear. Use the labels and surrounding context to find rows; do not rely on a fixed line shape.

Rules:
- Pull credits/GPA/credits-required from the top-level "Bachelor of Arts" (or equivalent overall degree) block, not from nested sub-blocks (Major/College/etc.).
- "Degree progress" appears as a percentage near the top of the audit (e.g. "98%"). Strip the % sign.
- For each course extract: subject (e.g. CSE), courseNumber (e.g. 20312), title, grade, credits (number; "(3)" -> 3), term (e.g. "Spring 2026"), and the requirementBlock label when one is clearly associated.
- Status is "in-progress" if grade is "IP" (or credits appear in parens). Otherwise "completed".
- Emit each course exactly once. The "In-progress" summary block at the end of the audit duplicates rows already shown in their requirement blocks; do not double-count.
- Skip "Satisfied by:" / "Exception by:" lines and decorative headers.
- studentName: human name only (e.g. "Shin, Tristan Sunghoon"). Do not include the student ID, email, or surrounding label text.
- college / major: just the name (e.g. "College of Arts and Letters", "Computer Science (BA)"). Do not include trailing fields like Status / Catalog Year / Advisors.
- catalogYear: 4-digit year as a string (e.g. "2022").
- If a field is genuinely absent from the input, use an empty string for strings or 0 for numbers.`;

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (ip === null && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Client IP unavailable" },
      { status: 400 },
    );
  }

  const rl = rateLimit(`parse-audit:${ip ?? "unknown"}`, LIMIT_PER_WINDOW, WINDOW_MS);
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Audit parser not configured" },
      { status: 500 },
    );
  }

  let rawText: string;
  try {
    const body = (await request.json()) as { rawText?: unknown };
    if (typeof body.rawText !== "string") {
      return NextResponse.json({ error: "rawText required" }, { status: 400 });
    }
    rawText = body.rawText.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!rawText) {
    return NextResponse.json({ error: "rawText empty" }, { status: 400 });
  }
  if (rawText.length > MAX_AUDIT_CHARS) {
    return NextResponse.json(
      { error: `Audit too long (${rawText.length} chars; max ${MAX_AUDIT_CHARS})` },
      { status: 413 },
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: {
        format: zodOutputFormat(ParsedAuditSchema),
        effort: "medium",
      },
      messages: [
        {
          role: "user",
          content: `Extract the audit:\n\n${rawText}`,
        },
      ],
    });

    if (!response.parsed_output) {
      return NextResponse.json(
        { error: "Model did not return structured output" },
        { status: 502 },
      );
    }

    return NextResponse.json(response.parsed_output, {
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Limit": String(rl.limit),
        "X-RateLimit-Remaining": String(rl.remaining),
        "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Upstream rate limited; try again shortly" },
        { status: 503 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      return NextResponse.json(
        { error: "Audit parser failed" },
        { status: 502 },
      );
    }
    console.error("parse-audit unexpected error", err);
    return NextResponse.json(
      { error: "Audit parser failed" },
      { status: 500 },
    );
  }
}
