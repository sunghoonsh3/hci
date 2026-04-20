import { test } from "node:test";
import assert from "node:assert/strict";
import { meetingsConflict, sectionsConflict } from "../conflicts";

const mwf10 = {
  days: JSON.stringify(["M", "W", "F"]),
  startTime: "10:00",
  endTime: "11:15",
};
const mwf11 = {
  days: JSON.stringify(["M", "W", "F"]),
  startTime: "11:00",
  endTime: "12:15",
};
const tr10 = {
  days: JSON.stringify(["T", "R"]),
  startTime: "10:00",
  endTime: "11:15",
};
const mwf12 = {
  days: JSON.stringify(["M", "W", "F"]),
  startTime: "12:00",
  endTime: "13:00",
};

test("meetingsConflict: overlapping time on same day", () => {
  assert.equal(meetingsConflict(mwf10, mwf11), true);
});

test("meetingsConflict: disjoint time same days", () => {
  assert.equal(meetingsConflict(mwf10, mwf12), false);
});

test("meetingsConflict: different days never conflict", () => {
  assert.equal(meetingsConflict(mwf10, tr10), false);
});

test("meetingsConflict: touching boundaries do not conflict", () => {
  const a = { ...mwf10 };
  const b = { ...mwf10, startTime: "11:15", endTime: "12:30" };
  assert.equal(meetingsConflict(a, b), false);
});

test("meetingsConflict: missing times do not conflict", () => {
  assert.equal(
    meetingsConflict(
      { days: mwf10.days, startTime: null, endTime: null },
      mwf10,
    ),
    false,
  );
});

test("sectionsConflict: any pair conflicting bubbles up", () => {
  assert.equal(sectionsConflict([mwf10, tr10], [mwf11]), true);
  assert.equal(sectionsConflict([tr10], [mwf11]), false);
});
