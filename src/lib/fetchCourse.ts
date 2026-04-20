import { CourseSchema, type CourseDTO } from "./schemas";

export type FetchReason = "network" | "http" | "shape" | "abort";

export type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: FetchReason; status?: number };

/**
 * Validated course fetcher returning a discriminated union so callers can
 * distinguish network failure vs. 404 vs. shape drift vs. aborted requests.
 */
export async function fetchCourseResult(
  id: number,
  signal?: AbortSignal,
): Promise<FetchResult<CourseDTO>> {
  try {
    const res = await fetch(`/api/course/${id}`, { signal });
    if (!res.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`fetchCourse(${id}) http ${res.status}`);
      }
      return { ok: false, reason: "http", status: res.status };
    }
    const raw = await res.json();
    const parsed = CourseSchema.safeParse(raw);
    if (!parsed.success) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`fetchCourse(${id}) invalid shape`, parsed.error);
      }
      return { ok: false, reason: "shape" };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, reason: "abort" };
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(`fetchCourse(${id}) network`, err);
    }
    return { ok: false, reason: "network" };
  }
}

/**
 * Back-compat wrapper. Returns null on any non-success result.
 */
export async function fetchCourse(
  id: number,
  signal?: AbortSignal,
): Promise<CourseDTO | null> {
  const result = await fetchCourseResult(id, signal);
  return result.ok ? result.data : null;
}

export interface FetchCoursesReport {
  data: CourseDTO[];
  failures: { id: number; reason: FetchReason; status?: number }[];
}

/**
 * Batch fetcher that preserves failure context per id. Aborted ids are
 * silently dropped since abort is caller-initiated.
 */
export async function fetchCoursesReport(
  ids: number[],
  signal?: AbortSignal,
): Promise<FetchCoursesReport> {
  const results = await Promise.all(
    ids.map(async (id) => {
      const r = await fetchCourseResult(id, signal);
      return { id, result: r };
    }),
  );
  const data: CourseDTO[] = [];
  const failures: FetchCoursesReport["failures"] = [];
  for (const { id, result } of results) {
    if (result.ok) data.push(result.data);
    else if (result.reason !== "abort") {
      failures.push({ id, reason: result.reason, status: result.status });
    }
  }
  return { data, failures };
}

/**
 * Back-compat wrapper returning only the successfully fetched courses.
 */
export async function fetchCourses(
  ids: number[],
  signal?: AbortSignal,
): Promise<CourseDTO[]> {
  const { data } = await fetchCoursesReport(ids, signal);
  return data;
}

export function toCourseMap(courses: CourseDTO[]): Record<number, CourseDTO> {
  const map: Record<number, CourseDTO> = {};
  for (const c of courses) map[c.id] = c;
  return map;
}
