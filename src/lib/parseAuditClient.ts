import type { ParsedAudit } from "@/types";
import { ParsedAuditSchema } from "@/lib/schemas";

export type ParseAuditError =
  | { kind: "empty" }
  | { kind: "too-long"; chars: number }
  | { kind: "rate-limited"; retryAfterSeconds?: number }
  | { kind: "server"; message: string }
  | { kind: "invalid-shape" };

export type ParseAuditResult =
  | { ok: true; audit: ParsedAudit }
  | { ok: false; error: ParseAuditError };

export async function parseAuditViaApi(
  rawText: string,
  signal?: AbortSignal,
): Promise<ParseAuditResult> {
  const trimmed = rawText.trim();
  if (!trimmed) return { ok: false, error: { kind: "empty" } };

  let response: Response;
  try {
    response = await fetch("/api/parse-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: trimmed }),
      signal,
    });
  } catch {
    return { ok: false, error: { kind: "server", message: "Network error" } };
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    return {
      ok: false,
      error: {
        kind: "rate-limited",
        retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined,
      },
    };
  }

  if (response.status === 413) {
    return { ok: false, error: { kind: "too-long", chars: trimmed.length } };
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {}
    return { ok: false, error: { kind: "server", message } };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: { kind: "invalid-shape" } };
  }

  const parsed = ParsedAuditSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: { kind: "invalid-shape" } };

  return { ok: true, audit: parsed.data };
}
