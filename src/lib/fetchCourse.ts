import { CourseSchema, type CourseDTO } from "./schemas";

export async function fetchCourse(
  id: number,
  signal?: AbortSignal,
): Promise<CourseDTO | null> {
  try {
    const res = await fetch(`/api/course/${id}`, { signal });
    if (!res.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`fetchCourse(${id}) ${res.status}`);
      }
      return null;
    }
    const raw = await res.json();
    const parsed = CourseSchema.safeParse(raw);
    if (!parsed.success) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`fetchCourse(${id}) invalid shape`, parsed.error);
      }
      return null;
    }
    return parsed.data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    if (process.env.NODE_ENV !== "production") {
      console.warn(`fetchCourse(${id}) error`, err);
    }
    return null;
  }
}

export async function fetchCourses(
  ids: number[],
  signal?: AbortSignal,
): Promise<CourseDTO[]> {
  const results = await Promise.all(ids.map((id) => fetchCourse(id, signal)));
  return results.filter((r): r is CourseDTO => r !== null);
}

export function toCourseMap(courses: CourseDTO[]): Record<number, CourseDTO> {
  const map: Record<number, CourseDTO> = {};
  for (const c of courses) map[c.id] = c;
  return map;
}
