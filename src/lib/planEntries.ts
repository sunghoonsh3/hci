import type { PlanEntry, PlanSlot } from "@/types";

const ALL_SLOTS: PlanSlot[] = ["A", "B", "C"];

export interface CourseNameHint {
  subject?: string;
  courseNumber?: string;
  courseTitle?: string;
}

export interface AddResult {
  entries: PlanEntry[];
  added: boolean;
  alreadyInSlots: PlanSlot[];
}

export function addEntry(
  entries: PlanEntry[],
  courseId: number,
  sectionId: number,
  slot: PlanSlot,
  hint?: CourseNameHint,
): AddResult {
  const existingSlots = entries
    .filter((p) => p.sectionId === sectionId)
    .map((p) => p.planSlot);
  if (existingSlots.includes(slot)) {
    return { entries, added: false, alreadyInSlots: existingSlots };
  }
  return {
    entries: [
      ...entries,
      {
        courseId,
        sectionId,
        planSlot: slot,
        subject: hint?.subject,
        courseNumber: hint?.courseNumber,
        courseTitle: hint?.courseTitle,
      },
    ],
    added: true,
    alreadyInSlots: existingSlots,
  };
}

export function removeEntry(
  entries: PlanEntry[],
  sectionId: number,
  slot: PlanSlot,
): PlanEntry[] {
  return entries.filter(
    (p) => !(p.sectionId === sectionId && p.planSlot === slot),
  );
}

export function moveEntry(
  entries: PlanEntry[],
  sectionId: number,
  fromSlot: PlanSlot,
  toSlot: PlanSlot,
): PlanEntry[] {
  if (fromSlot === toSlot) return entries;
  return entries.map((p) =>
    p.sectionId === sectionId && p.planSlot === fromSlot
      ? { ...p, planSlot: toSlot }
      : p,
  );
}

export function findSlotsForCourse(
  entries: PlanEntry[],
  courseId: number,
): PlanSlot[] {
  const slots = new Set<PlanSlot>();
  for (const p of entries) {
    if (p.courseId === courseId) slots.add(p.planSlot);
  }
  return ALL_SLOTS.filter((s) => slots.has(s));
}

export function findEntryInSlot(
  entries: PlanEntry[],
  courseId: number,
  slot: PlanSlot,
): PlanEntry | undefined {
  return entries.find((p) => p.courseId === courseId && p.planSlot === slot);
}

/**
 * Swap a course's section within a single plan slot.
 * Returns the new entries array, or null if there is no entry to swap.
 * If `newSectionId === existing.sectionId`, returns the original array unchanged.
 */
export function swapSectionInSlot(
  entries: PlanEntry[],
  courseId: number,
  slot: PlanSlot,
  newSectionId: number,
  hint?: CourseNameHint,
): PlanEntry[] | null {
  const existing = findEntryInSlot(entries, courseId, slot);
  if (!existing) return null;
  if (existing.sectionId === newSectionId) return entries;
  const removed = removeEntry(entries, existing.sectionId, slot);
  return addEntry(removed, courseId, newSectionId, slot, hint).entries;
}
