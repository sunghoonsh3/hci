import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAuditText, isValidAudit } from "../auditParser";

test("parseAuditText: extracts metadata and course lines", () => {
  const text = [
    "Name: Alex Murphy",
    "Student ID: 900123456",
    "Classification: Senior",
    "College: College of Arts and Letters",
    "Major: Computer Science (BA)",
    "Catalog Year: 2022",
    "GPA: 3.419",
    "Credits Required: 122",
    "Credits Applied: 134.5",
    "Progress: 98%",
    "CSE 20311 Fundamentals of Computing A 4 Fall 2024",
    "CSE 20312 Data Structures IP 4 Spring 2025",
  ].join("\n");
  const audit = parseAuditText(text);
  assert.equal(audit.studentName, "Alex Murphy");
  assert.equal(audit.studentId, "900123456");
  assert.equal(audit.classification, "Senior");
  assert.equal(audit.gpa, 3.419);
  assert.equal(audit.creditsRequired, 122);
  assert.equal(audit.creditsApplied, 134.5);
  assert.equal(audit.degreeProgress, 98);
  assert.equal(audit.completedCourses.length, 1);
  assert.equal(audit.inProgressCourses.length, 1);
  assert.equal(audit.completedCourses[0].subject, "CSE");
  assert.equal(audit.completedCourses[0].grade, "A");
  assert.equal(audit.inProgressCourses[0].grade, "IP");
  assert.equal(isValidAudit(audit), true);
});

test("parseAuditText: rejects text with no course lines", () => {
  const audit = parseAuditText("just some random text\nno courses here");
  assert.equal(isValidAudit(audit), false);
});
