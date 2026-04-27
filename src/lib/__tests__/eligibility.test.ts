import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeEligibility,
  isRegisterable,
  registrationBlockedReason,
} from "../eligibility";
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

test("eligible when prereqs met via OR alternative", () => {
  const completed: CompletedCourse[] = [
    {
      subject: "CSE",
      courseNumber: "10550",
      title: "Intro",
      grade: "A",
      credits: 4,
      term: "Fall 2024",
      status: "completed",
    },
  ];
  const restrictions = JSON.stringify([
    "Prerequisites: CSE 10550 or MATH 10550",
  ]);
  const status = computeEligibility(
    "MATH",
    "20550",
    restrictions,
    [{ seatsAvailable: 5, specialApproval: null }],
    completed,
  );
  assert.equal(status, "eligible");
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

test("eligible when the only prereq is in-progress (next-term registration)", () => {
  const inProgress: CompletedCourse[] = [
    {
      subject: "ACCT",
      courseNumber: "20100",
      title: "Accountancy I",
      grade: "IP",
      credits: 3,
      term: "Spring 2026",
      status: "in-progress",
    },
  ];
  const restrictions = JSON.stringify(["Prerequisites: ACCT 20100"]);
  const status = computeEligibility(
    "ACCT",
    "20200",
    restrictions,
    [{ seatsAvailable: 5, specialApproval: null }],
    inProgress,
  );
  assert.equal(status, "eligible");
});

test("eligible when an AND-group prereq is partly completed and partly in-progress", () => {
  const courses: CompletedCourse[] = [
    {
      subject: "CSE",
      courseNumber: "20312",
      title: "Data Structures",
      grade: "A",
      credits: 4,
      term: "Fall 2024",
      status: "completed",
    },
    {
      subject: "CSE",
      courseNumber: "20289",
      title: "Systems Programming",
      grade: "IP",
      credits: 4,
      term: "Spring 2026",
      status: "in-progress",
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
    courses,
  );
  assert.equal(status, "eligible");
});

test("needs-prereq still returns when prereq is neither completed nor in-progress", () => {
  const inProgress: CompletedCourse[] = [
    {
      subject: "CSE",
      courseNumber: "20312",
      title: "Data Structures",
      grade: "IP",
      credits: 4,
      term: "Spring 2026",
      status: "in-progress",
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
    inProgress,
  );
  assert.equal(status, "needs-prereq");
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

test("'Prerequisite OR corequisite' is not treated as prereq", () => {
  const restrictions = JSON.stringify([
    "Prerequisite OR corequisite: CSE 20311 or ACMS 10100",
  ]);
  const status = computeEligibility(
    "CSE",
    "20289",
    restrictions,
    [{ seatsAvailable: 5, specialApproval: null }],
    audit,
  );
  assert.equal(status, "eligible");
});

test("isRegisterable: eligible only", () => {
  assert.equal(isRegisterable("eligible"), true);
  assert.equal(isRegisterable("full"), false);
  assert.equal(isRegisterable("needs-prereq"), false);
  assert.equal(isRegisterable("restricted"), false);
  assert.equal(isRegisterable("already-taken"), false);
  assert.equal(isRegisterable("unknown"), false);
});

test("registrationBlockedReason: covers every status", () => {
  assert.equal(registrationBlockedReason("eligible"), null);
  assert.equal(registrationBlockedReason("full"), "Section full");
  assert.equal(
    registrationBlockedReason("needs-prereq"),
    "Missing prerequisites",
  );
  assert.equal(
    registrationBlockedReason("restricted"),
    "Special approval required",
  );
  assert.equal(registrationBlockedReason("already-taken"), "Already taken");
  assert.equal(
    registrationBlockedReason("unknown"),
    "Course data unavailable",
  );
});
