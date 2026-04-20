import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPrereqCourses, parseRestrictions, checkPrerequisites } from "../restrictions";

test("extractPrereqCourses: parentheses form", () => {
  const raw = JSON.stringify([
    "Prerequisites: (CSE 20312 and CSE 20289)",
  ]);
  assert.deepEqual(extractPrereqCourses(raw), ["CSE 20312", "CSE 20289"]);
});

test("extractPrereqCourses: bare form (no parens)", () => {
  const raw = JSON.stringify(["Prerequisites: CSE 20312"]);
  assert.deepEqual(extractPrereqCourses(raw), ["CSE 20312"]);
});

test("extractPrereqCourses: multiple codes on a bare line", () => {
  const raw = JSON.stringify([
    "Prerequisite: MATH 10550 and MATH 10560",
  ]);
  assert.deepEqual(extractPrereqCourses(raw), ["MATH 10550", "MATH 10560"]);
});

test("extractPrereqCourses: unrelated lines are ignored", () => {
  const raw = JSON.stringify([
    "Limited to senior level students",
    "Prerequisite: CSE 20311",
  ]);
  assert.deepEqual(extractPrereqCourses(raw), ["CSE 20311"]);
});

test("extractPrereqCourses: deduplicates", () => {
  const raw = JSON.stringify([
    "Prerequisites: CSE 20311 and CSE 20311",
  ]);
  assert.deepEqual(extractPrereqCourses(raw), ["CSE 20311"]);
});

test("extractPrereqCourses: invalid JSON returns empty", () => {
  assert.deepEqual(extractPrereqCourses("not json"), []);
  assert.deepEqual(extractPrereqCourses(null), []);
  assert.deepEqual(extractPrereqCourses(JSON.stringify({ not: "array" })), []);
});

test("parseRestrictions: recognizes bare Prerequisites", () => {
  const raw = JSON.stringify(["Prerequisites: CSE 20312"]);
  const [item] = parseRestrictions(raw);
  assert.equal(item.type, "prerequisite");
  assert.match(item.details ?? "", /CSE 20312/);
});

test("parseRestrictions: recognizes level restriction", () => {
  const raw = JSON.stringify([
    "Limited to senior level students only",
  ]);
  const [item] = parseRestrictions(raw);
  assert.equal(item.type, "level");
});

test("checkPrerequisites: marks completed courses", () => {
  const raw = JSON.stringify(["Prerequisites: CSE 20312 and CSE 20289"]);
  const completed = [
    {
      subject: "CSE",
      courseNumber: "20312",
      title: "Data Structures",
      grade: "A",
      credits: 4,
      term: "Fall 2024",
      status: "completed" as const,
    },
  ];
  const checks = checkPrerequisites(raw, completed);
  assert.equal(checks.length, 2);
  const taken = checks.find((c) => c.courseCode === "CSE 20312");
  assert.equal(taken?.completed, true);
  assert.equal(taken?.grade, "A");
  const missing = checks.find((c) => c.courseCode === "CSE 20289");
  assert.equal(missing?.completed, false);
});
