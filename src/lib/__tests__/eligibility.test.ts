import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEligibility } from "../eligibility";
import type { CompletedCourse } from "@/types";

const audit: CompletedCourse[] = [
  {
    subject: "CSE",
    courseNumber: "20311",
    title: "Fundamentals of Computing",
    grade: "A",
    credits: 4,
    term: "Fall 2024",
    status: "completed",
  },
];

test("already-taken when student has completed the course", () => {
  const status = computeEligibility(
    "CSE",
    "20311",
    null,
    [{ seatsAvailable: 5, specialApproval: null }],
    audit,
  );
  assert.equal(status, "already-taken");
});

test("unknown when there are no sections", () => {
  const status = computeEligibility("CSE", "99999", null, [], []);
  assert.equal(status, "unknown");
});

test("full when every section has zero seats", () => {
  const status = computeEligibility(
    "CSE",
    "40113",
    null,
    [
      { seatsAvailable: 0, specialApproval: null },
      { seatsAvailable: 0, specialApproval: null },
    ],
    audit,
  );
  assert.equal(status, "full");
});

test("not full when any seatsAvailable is null (treated as available)", () => {
  const status = computeEligibility(
    "CSE",
    "40113",
    null,
    [
      { seatsAvailable: 0, specialApproval: null },
      { seatsAvailable: null, specialApproval: null },
    ],
    audit,
  );
  assert.notEqual(status, "full");
});

test("restricted when any section requires special approval", () => {
  const status = computeEligibility(
    "CSE",
    "30151",
    null,
    [{ seatsAvailable: 5, specialApproval: "Instructor Approval" }],
    audit,
  );
  assert.equal(status, "restricted");
});

test("needs-prereq when audit lacks a declared prereq", () => {
  const restrictions = JSON.stringify([
    "Prerequisites: (CSE 20312 and CSE 20289)",
  ]);
  const status = computeEligibility(
    "CSE",
    "30151",
    restrictions,
    [{ seatsAvailable: 5, specialApproval: null }],
    audit,
  );
  assert.equal(status, "needs-prereq");
});

test("eligible when prereqs met and seats available", () => {
  const completed: CompletedCourse[] = [
    ...audit,
    {
      subject: "CSE",
      courseNumber: "20312",
      title: "Data Structures",
      grade: "A",
      credits: 4,
      term: "Spring 2025",
      status: "completed",
    },
    {
      subject: "CSE",
      courseNumber: "20289",
      title: "Systems Programming",
      grade: "B+",
      credits: 4,
      term: "Spring 2025",
      status: "completed",
    },
  ];
  const restrictions = JSON.stringify([
    "Prerequisites: (CSE 20312 and CSE 20289)",
  ]);
  const status = computeEligibility(
    "CSE",
    "30151",
    restrictions,
    [{ seatsAvailable: 5, specialApproval: null }],
    completed,
  );
  assert.equal(status, "eligible");
});

test("no prereq check without audit data", () => {
  const restrictions = JSON.stringify([
    "Prerequisites: (CSE 20312)",
  ]);
  const status = computeEligibility(
    "CSE",
    "30151",
    restrictions,
    [{ seatsAvailable: 5, specialApproval: null }],
    [],
    false,
  );
  assert.equal(status, "eligible");
});
