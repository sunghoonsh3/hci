import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveName, formatStudentSelfDescription } from "../persona";

test("Degree Works 'Last, First Middle' format", () => {
  const r = deriveName("Shin, Tristan Sunghoon");
  assert.equal(r.display, "Tristan Shin");
  assert.equal(r.initials, "TS");
});

test("Degree Works 'Last, First' (no middle)", () => {
  const r = deriveName("Doe, Jane");
  assert.equal(r.display, "Jane Doe");
  assert.equal(r.initials, "JD");
});

test("Plain 'First Last' format", () => {
  const r = deriveName("Alex Murphy");
  assert.equal(r.display, "Alex Murphy");
  assert.equal(r.initials, "AM");
});

test("Single name", () => {
  const r = deriveName("Madonna");
  assert.equal(r.display, "Madonna");
  assert.equal(r.initials, "M");
});

test("Empty string falls back to 'Student'", () => {
  const r = deriveName("");
  assert.equal(r.display, "Student");
  assert.equal(r.initials, "S");
});

test("undefined falls back to 'Student'", () => {
  const r = deriveName(undefined);
  assert.equal(r.display, "Student");
  assert.equal(r.initials, "S");
});

test("null falls back to 'Student'", () => {
  const r = deriveName(null);
  assert.equal(r.display, "Student");
  assert.equal(r.initials, "S");
});

test("Surrounding whitespace is trimmed", () => {
  const r = deriveName("  Shin, Tristan  ");
  assert.equal(r.display, "Tristan Shin");
  assert.equal(r.initials, "TS");
});

test("Lowercase name produces uppercase initials", () => {
  const r = deriveName("shin, tristan");
  assert.equal(r.display, "tristan shin");
  assert.equal(r.initials, "TS");
});

test("Three-word plain name uses first and last", () => {
  const r = deriveName("Mary Jane Watson");
  assert.equal(r.display, "Mary Watson");
  assert.equal(r.initials, "MW");
});

test("Comma with no first name uses last only", () => {
  const r = deriveName("Shin,");
  assert.equal(r.display, "Shin");
  assert.equal(r.initials, "S");
});

test("Whitespace-only string falls back to 'Student'", () => {
  const r = deriveName("   ");
  assert.equal(r.display, "Student");
  assert.equal(r.initials, "S");
});

test("formatStudentSelfDescription: full audit (Senior + BACS)", () => {
  assert.equal(
    formatStudentSelfDescription({
      classification: "Senior",
      college: "College of Arts and Letters",
      major: "Computer Science (BA)",
    }),
    "I am a senior in the College of Arts and Letters, majoring in Computer Science (BA).",
  );
});

test("formatStudentSelfDescription: lowercases classification", () => {
  assert.equal(
    formatStudentSelfDescription({
      classification: "Junior",
      college: "Mendoza College of Business",
      major: "Finance",
    }),
    "I am a junior in the Mendoza College of Business, majoring in Finance.",
  );
});

test("formatStudentSelfDescription: 'an' before vowel-initial classification", () => {
  assert.equal(
    formatStudentSelfDescription({
      classification: "Undergraduate",
      college: "College of Arts and Letters",
      major: "Computer Science (BA)",
    }),
    "I am an undergraduate in the College of Arts and Letters, majoring in Computer Science (BA).",
  );
});

test("formatStudentSelfDescription: missing classification falls back to 'a student'", () => {
  assert.equal(
    formatStudentSelfDescription({
      classification: "",
      college: "College of Arts and Letters",
      major: "Computer Science (BA)",
    }),
    "I am a student in the College of Arts and Letters, majoring in Computer Science (BA).",
  );
});

test("formatStudentSelfDescription: omits college clause when missing", () => {
  assert.equal(
    formatStudentSelfDescription({
      classification: "Senior",
      college: "",
      major: "Computer Science (BA)",
    }),
    "I am a senior, majoring in Computer Science (BA).",
  );
});

test("formatStudentSelfDescription: omits major clause when missing", () => {
  assert.equal(
    formatStudentSelfDescription({
      classification: "Senior",
      college: "College of Arts and Letters",
      major: "",
    }),
    "I am a senior in the College of Arts and Letters.",
  );
});

test("formatStudentSelfDescription: null audit", () => {
  assert.equal(formatStudentSelfDescription(null), "I am a student.");
});

test("formatStudentSelfDescription: trims surrounding whitespace", () => {
  assert.equal(
    formatStudentSelfDescription({
      classification: "  Senior  ",
      college: "  College of Arts and Letters  ",
      major: "  Computer Science (BA)  ",
    }),
    "I am a senior in the College of Arts and Letters, majoring in Computer Science (BA).",
  );
});
