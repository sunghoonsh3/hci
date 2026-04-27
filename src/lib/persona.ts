import type { ParsedAudit } from "@/types";

export interface DerivedName {
  display: string;
  initials: string;
}

export function deriveName(studentName: string | null | undefined): DerivedName {
  const trimmed = (studentName ?? "").trim();
  if (!trimmed) return { display: "Student", initials: "S" };

  let first = "";
  let last = "";

  const commaIdx = trimmed.indexOf(",");
  if (commaIdx >= 0) {
    last = trimmed.slice(0, commaIdx).trim();
    const after = trimmed.slice(commaIdx + 1).trim();
    first = after.split(/\s+/)[0] ?? "";
  } else {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    first = parts[0] ?? "";
    if (parts.length > 1) last = parts[parts.length - 1] ?? "";
  }

  const display = [first, last].filter(Boolean).join(" ") || trimmed;
  const initials =
    ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() ||
    trimmed[0]?.toUpperCase() ||
    "?";

  return { display, initials };
}

export function formatStudentSelfDescription(
  audit: Pick<ParsedAudit, "classification" | "college" | "major"> | null | undefined,
): string {
  const classification = audit?.classification?.trim() ?? "";
  const college = audit?.college?.trim() ?? "";
  const major = audit?.major?.trim() ?? "";

  const role = classification.toLowerCase() || "student";
  const article = /^[aeiou]/i.test(role) ? "an" : "a";

  const collegeClause = college ? ` in the ${college}` : "";
  const majorClause = major ? `, majoring in ${major}` : "";

  return `I am ${article} ${role}${collegeClause}${majorClause}.`;
}
