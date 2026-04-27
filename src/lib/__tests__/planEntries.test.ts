import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addEntry,
  removeEntry,
  moveEntry,
  findSlotsForCourse,
  findEntryInSlot,
  swapSectionInSlot,
} from "../planEntries";
import type { PlanEntry } from "@/types";

const hint = { subject: "CSE", courseNumber: "30151", courseTitle: "X" };

test("addEntry adds a new plan entry", () => {
  const result = addEntry([], 1, 100, "A", hint);
  assert.equal(result.added, true);
  assert.deepEqual(result.alreadyInSlots, []);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].courseId, 1);
  assert.equal(result.entries[0].sectionId, 100);
  assert.equal(result.entries[0].planSlot, "A");
});

test("addEntry is idempotent within a slot", () => {
  const start: PlanEntry[] = [
    { courseId: 1, sectionId: 100, planSlot: "A" },
  ];
  const result = addEntry(start, 1, 100, "A");
  assert.equal(result.added, false);
  assert.equal(result.entries, start);
  assert.deepEqual(result.alreadyInSlots, ["A"]);
});

test("addEntry reports other slots already containing the same section", () => {
  const start: PlanEntry[] = [
    { courseId: 1, sectionId: 100, planSlot: "A" },
  ];
  const result = addEntry(start, 1, 100, "B");
  assert.equal(result.added, true);
  assert.deepEqual(result.alreadyInSlots, ["A"]);
  assert.equal(result.entries.length, 2);
});

test("removeEntry only removes the matching (section, slot) pair", () => {
  const start: PlanEntry[] = [
    { courseId: 1, sectionId: 100, planSlot: "A" },
    { courseId: 1, sectionId: 100, planSlot: "B" },
    { courseId: 2, sectionId: 200, planSlot: "A" },
  ];
  const after = removeEntry(start, 100, "A");
  assert.equal(after.length, 2);
  assert.ok(after.find((e) => e.sectionId === 100 && e.planSlot === "B"));
  assert.ok(after.find((e) => e.sectionId === 200));
});

test("moveEntry changes planSlot and removes from source", () => {
  const start: PlanEntry[] = [
    { courseId: 1, sectionId: 100, planSlot: "A" },
    { courseId: 2, sectionId: 200, planSlot: "B" },
  ];
  const after = moveEntry(start, 100, "A", "B");

  // The course 1 entry should now be in B and not in A.
  const slotsForCourse1 = findSlotsForCourse(after, 1);
  assert.deepEqual(slotsForCourse1, ["B"]);
  // Course 2 unaffected.
  const slotsForCourse2 = findSlotsForCourse(after, 2);
  assert.deepEqual(slotsForCourse2, ["B"]);
  // Length unchanged (move, not add).
  assert.equal(after.length, 2);
});

test("moveEntry is a no-op when fromSlot equals toSlot", () => {
  const start: PlanEntry[] = [
    { courseId: 1, sectionId: 100, planSlot: "A" },
  ];
  const after = moveEntry(start, 100, "A", "A");
  assert.equal(after, start);
});

test("moveEntry leaves entries untouched when section not in fromSlot", () => {
  const start: PlanEntry[] = [
    { courseId: 1, sectionId: 100, planSlot: "A" },
  ];
  const after = moveEntry(start, 100, "B", "C");
  assert.deepEqual(after, start);
});

test("findSlotsForCourse returns sorted unique slots", () => {
  const entries: PlanEntry[] = [
    { courseId: 1, sectionId: 100, planSlot: "C" },
    { courseId: 1, sectionId: 101, planSlot: "A" },
    { courseId: 2, sectionId: 200, planSlot: "B" },
  ];
  assert.deepEqual(findSlotsForCourse(entries, 1), ["A", "C"]);
  assert.deepEqual(findSlotsForCourse(entries, 2), ["B"]);
  assert.deepEqual(findSlotsForCourse(entries, 999), []);
});

test("findEntryInSlot finds the right entry", () => {
  const entries: PlanEntry[] = [
    { courseId: 1, sectionId: 100, planSlot: "A" },
    { courseId: 1, sectionId: 101, planSlot: "B" },
  ];
  assert.equal(findEntryInSlot(entries, 1, "A")?.sectionId, 100);
  assert.equal(findEntryInSlot(entries, 1, "B")?.sectionId, 101);
  assert.equal(findEntryInSlot(entries, 1, "C"), undefined);
});

test("swapSectionInSlot replaces the section while keeping slot", () => {
  const entries: PlanEntry[] = [
    { courseId: 1, sectionId: 100, planSlot: "A" },
    { courseId: 1, sectionId: 100, planSlot: "B" },
  ];
  const after = swapSectionInSlot(entries, 1, "A", 102, hint);
  assert.notEqual(after, null);
  // Section 100 still in B (unaffected).
  assert.ok(
    after!.find((e) => e.sectionId === 100 && e.planSlot === "B"),
    "Plan B entry unchanged",
  );
  // Plan A now has section 102.
  assert.equal(findEntryInSlot(after!, 1, "A")?.sectionId, 102);
  // Plan A has only one entry for course 1.
  assert.equal(after!.filter((e) => e.planSlot === "A").length, 1);
});

test("swapSectionInSlot returns null when course not in slot", () => {
  const entries: PlanEntry[] = [
    { courseId: 1, sectionId: 100, planSlot: "A" },
  ];
  assert.equal(swapSectionInSlot(entries, 1, "B", 102), null);
});

test("swapSectionInSlot is identity if newSectionId matches existing", () => {
  const entries: PlanEntry[] = [
    { courseId: 1, sectionId: 100, planSlot: "A" },
  ];
  const after = swapSectionInSlot(entries, 1, "A", 100);
  assert.equal(after, entries);
});

test("recovery scenario: move from Plan A to Plan B removes from A", () => {
  // Course 1 in Plan A, Course 2 in Plan B; move course 1 A → B.
  let entries: PlanEntry[] = [];
  entries = addEntry(entries, 1, 100, "A", hint).entries;
  entries = addEntry(entries, 2, 200, "B", hint).entries;
  entries = moveEntry(entries, 100, "A", "B");

  assert.deepEqual(findSlotsForCourse(entries, 1), ["B"]);
  // Plan A no longer contains course 1.
  assert.equal(findEntryInSlot(entries, 1, "A"), undefined);
  // Plan B contains course 1 (section 100) and course 2 (section 200).
  assert.equal(entries.filter((e) => e.planSlot === "B").length, 2);
});

test("recovery scenario: move A → C also possible (not just A → B)", () => {
  let entries: PlanEntry[] = [];
  entries = addEntry(entries, 1, 100, "A", hint).entries;
  entries = moveEntry(entries, 100, "A", "C");

  assert.deepEqual(findSlotsForCourse(entries, 1), ["C"]);
  assert.equal(findEntryInSlot(entries, 1, "A"), undefined);
  assert.equal(findEntryInSlot(entries, 1, "C")?.sectionId, 100);
});
