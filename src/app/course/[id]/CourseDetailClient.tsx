"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useAudit } from "@/contexts/AuditContext";
import { usePlans } from "@/contexts/PlansContext";
import {
  computeEligibility,
  isRegisterable,
  registrationBlockedReason,
} from "@/lib/eligibility";
import { parseRestrictions, checkPrerequisites } from "@/lib/restrictions";
import { getRequirementBadges } from "@/lib/requirements";
import { useToast } from "@/contexts/ToastContext";
import { getCourseGuidance, getCoursePath } from "@/lib/guidance";
import EligibilityBadge from "@/components/EligibilityBadge";
import PreCheckModal from "@/components/PreCheckModal";
import RecoveryDrawer from "@/components/RecoveryDrawer";
import type { PlanSlot } from "@/types";

interface Meeting {
  id: number;
  room: string | null;
  days: string | null;
  startTime: string | null;
  endTime: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface Instructor {
  id: number;
  name: string;
}

interface Section {
  id: number;
  sectionNumber: string | null;
  crn: number | null;
  status: string | null;
  maxEnrollment: number | null;
  seatsAvailable: number | null;
  waitlistCurrent: number | null;
  waitlistCapacity: number | null;
  specialApproval: string | null;
  sectionNotes: string | null;
  meetings: Meeting[];
  instructors: Instructor[];
}

interface Course {
  id: number;
  subject: string;
  courseNumber: string;
  courseTitle: string;
  description: string | null;
  creditHoursMin: number | null;
  creditHoursMax: number | null;
  registrationRestrictions: string | null;
  cannotHaveTaken: string | null;
  attributes: string | null;
  sections: Section[];
}

function parseDays(daysJson: string | null): string[] {
  if (!daysJson) return [];
  try {
    const parsed = JSON.parse(daysJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDays(daysJson: string | null): string {
  const days = parseDays(daysJson);
  return days.length ? days.join("") : "TBA";
}

function formatTime(start: string | null, end: string | null): string {
  if (!start || !end) return "TBA";
  return `${start}-${end}`;
}


export default function CourseDetailClient({
  course,
  courseTitleMap = {},
}: {
  course: Course;
  courseTitleMap?: Record<string, string>;
}) {
  const { audit } = useAudit();
  const { addToPlan, removeFromPlan, isSectionInPlan, findSlotsForSection } =
    usePlans();
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const { show } = useToast();

  const allCourses = useMemo(
    () =>
      audit
        ? [...audit.completedCourses, ...audit.inProgressCourses]
        : [],
    [audit],
  );
  const status = useMemo(
    () =>
      computeEligibility(
        course.subject,
        course.courseNumber,
        course.registrationRestrictions,
        course.sections,
        allCourses,
      ),
    [course, allCourses],
  );
  const restrictions = useMemo(
    () => parseRestrictions(course.registrationRestrictions),
    [course.registrationRestrictions],
  );
  const prereqChecks = useMemo(
    () =>
      checkPrerequisites(
        course.registrationRestrictions,
        audit?.completedCourses ?? [],
        audit?.inProgressCourses ?? [],
      ),
    [course.registrationRestrictions, audit],
  );
  const badges = getRequirementBadges(course.subject, course.courseNumber);
  const isBlocked = !isRegisterable(status);
  const blockedReason = registrationBlockedReason(status);
  const primaryInstructor =
    course.sections[0]?.instructors[0]?.name ?? "TBA";
  const credits =
    course.creditHoursMin === course.creditHoursMax
      ? `${course.creditHoursMin}`
      : `${course.creditHoursMin}-${course.creditHoursMax}`;

  const courseKey = `${course.subject} ${course.courseNumber}`;
  const guidance = getCourseGuidance(course.subject, course.courseNumber);
  const coursePath = getCoursePath(course.subject, course.courseNumber);

  const totalSeats = course.sections.reduce(
    (s, sec) => s + (sec.seatsAvailable ?? 0),
    0,
  );
  const totalMax = course.sections.reduce(
    (s, sec) => s + (sec.maxEnrollment ?? 0),
    0,
  );

  function handleAddToPlan(sectionId: number, slot: PlanSlot) {
    const existing = findSlotsForSection(sectionId);
    const result = addToPlan(course.id, sectionId, slot, {
      subject: course.subject,
      courseNumber: course.courseNumber,
      courseTitle: course.courseTitle,
    });
    const label = `${course.subject} ${course.courseNumber}`;
    if (!result.added) {
      show(`${label} already in Plan ${slot}`, { variant: "warning" });
      return;
    }
    const alsoIn = existing.filter((s) => s !== slot);
    const extra = alsoIn.length
      ? ` (also in Plan ${alsoIn.join(", ")})`
      : "";
    show(`${label} added to Plan ${slot}${extra}`, {
      undo: () => removeFromPlan(sectionId, slot),
    });
  }

  return (
    <div>
      <div className="text-sm text-gray-600 mb-4">
        <Link href="/search" className="hover:text-gray-900">
          Search
        </Link>{" "}
        / {course.subject} {course.courseNumber}
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        <div>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {course.subject} {course.courseNumber}: {course.courseTitle}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-700">
                <span>{primaryInstructor}</span>
                <span aria-hidden="true">·</span>
                <span>{credits} credits</span>
                <span aria-hidden="true">·</span>
                <span>Summer 2026</span>
                <EligibilityBadge status={status} size="md" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mb-6">
            {isBlocked ? (
              <button
                type="button"
                disabled
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium opacity-75 cursor-not-allowed"
              >
                Register (Blocked)
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  show(
                    "Registration would be executed in NOVO. This is a prototype.",
                  )
                }
                className="bg-[#1B6B3A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#155a2f] transition-colors"
              >
                Register
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPreCheck(true)}
              className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Pre-check
            </button>
          </div>

          {isBlocked && (
            <div
              className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4"
              role="status"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-red-700 font-medium">
                    Registration Blocked
                  </span>
                  <span className="text-sm text-red-700">
                    {status === "full"
                      ? `This course is full (${totalSeats} seats remaining)`
                      : (blockedReason ?? "Not registerable")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecovery(true)}
                  className="shrink-0 text-sm bg-orange-600 text-white px-3 py-1.5 rounded font-medium hover:bg-orange-700 transition-colors"
                >
                  See recovery options
                </button>
              </div>
            </div>
          )}

          {course.description && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">
                Description
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                {course.description}
              </p>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">
              Availability
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {totalSeats}/{totalMax} seats
              </span>
              <div
                className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-xs"
                role="progressbar"
                aria-label="Seat availability"
                aria-valuemin={0}
                aria-valuemax={totalMax}
                aria-valuenow={totalMax - totalSeats}
              >
                <div
                  className={`h-full rounded-full ${
                    totalSeats === 0
                      ? "bg-red-500"
                      : totalMax > 0 &&
                          (totalMax - totalSeats) / totalMax > 0.8
                        ? "bg-yellow-500"
                        : "bg-green-500"
                  }`}
                  style={{
                    width: `${
                      totalMax > 0
                        ? ((totalMax - totalSeats) / totalMax) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <span
                className={`text-xs font-medium ${
                  totalSeats === 0 ? "text-red-700" : "text-green-800"
                }`}
              >
                {totalSeats === 0 ? "Filled" : "Available"}
              </span>
            </div>
          </div>

          {prereqChecks.filter(
            (c) => c.completed || c.inProgress || courseTitleMap[c.courseCode],
          ).length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">
                Prerequisites
              </h2>
              <div className="space-y-1">
                {prereqChecks
                  .filter(
                    (c) =>
                      c.completed || c.inProgress || courseTitleMap[c.courseCode],
                  )
                  .map((check) => {
                    const title = courseTitleMap[check.courseCode];
                    const color = check.completed
                      ? "text-green-700"
                      : check.inProgress
                        ? "text-amber-700"
                        : "text-red-700";
                    const marker = check.completed
                      ? "✓"
                      : check.inProgress
                        ? "◐"
                        : "✗";
                    return (
                      <div
                        key={check.courseCode}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className={color} aria-hidden="true">
                          {marker}
                        </span>
                        <span className="font-medium">
                          {check.courseCode}
                          {title ? `: ${title}` : ""}
                        </span>
                        {check.completed ? (
                          <span className="text-green-800">
                            — completed {check.term} ({check.grade})
                          </span>
                        ) : check.inProgress ? (
                          <span className="text-amber-800">
                            — in progress ({check.term})
                          </span>
                        ) : (
                          <span className="text-red-700">— not completed</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {restrictions.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">
                Restrictions
              </h2>
              <ul className="space-y-1">
                {restrictions.map((r, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    <span className="font-medium">{r.label}</span>
                    {r.type === "other" ? "" : ` — ${r.raw}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {badges.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">
                Requirements Fulfilled
              </h2>
              <div className="flex gap-2">
                {badges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center rounded-full bg-blue-50 text-blue-800 px-3 py-1 text-sm font-medium"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">
              Course Path
            </h2>
            {coursePath ? (
              <div className="flex items-center gap-1 text-sm overflow-x-auto pb-2">
                {coursePath.map((code, i) => {
                  const isCurrent = code === courseKey;
                  const completed = audit?.completedCourses.some(
                    (c) => `${c.subject} ${c.courseNumber}` === code,
                  );
                  return (
                    <React.Fragment key={`${code}-${i}`}>
                      {i > 0 && (
                        <span className="text-gray-400 mx-1" aria-hidden="true">
                          →
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap ${
                          isCurrent
                            ? "bg-[#1B6B3A] text-white"
                            : completed
                              ? "bg-green-100 text-green-900"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {completed && !isCurrent ? "✓ " : ""}
                        {code}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic">
                Course path data not yet available for this course.
              </p>
            )}
          </div>

          {guidance ? (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">
                Guidance
              </h2>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Common Pairings</span>
                    <div className="font-medium text-gray-900 mt-0.5">
                      {guidance.commonPairings}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Typical Semester</span>
                    <div className="font-medium text-gray-900 mt-0.5">
                      {guidance.typicalSemester}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Fill Speed</span>
                    <div className="font-medium text-gray-900 mt-0.5">
                      {guidance.fillSpeed}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Major Take Rate</span>
                    <div className="font-medium text-gray-900 mt-0.5">
                      {guidance.majorTakeRate}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">
                Guidance
              </h2>
              <p className="text-sm text-gray-600 italic">
                No advisor guidance available for this course yet.
              </p>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">
              Sections
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-2 font-medium text-gray-700">
                      Sec
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">
                      Time
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">
                      Room
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">
                      Seats
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-gray-700" />
                  </tr>
                </thead>
                <tbody>
                  {course.sections.map((section) => {
                    const meeting = section.meetings[0];
                    const isFull =
                      section.seatsAvailable !== null &&
                      section.seatsAvailable <= 0;
                    const avail = section.seatsAvailable ?? 0;
                    const max = section.maxEnrollment ?? 0;
                    const inPlan = isSectionInPlan(section.id);
                    return (
                      <tr
                        key={section.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-2">
                          {section.sectionNumber ?? "-"}
                        </td>
                        <td className="px-4 py-2">
                          {meeting ? (
                            <>
                              {formatDays(meeting.days)}{" "}
                              {formatTime(meeting.startTime, meeting.endTime)}
                            </>
                          ) : (
                            "TBA"
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {meeting?.room ?? "TBA"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={
                              isFull
                                ? "text-red-700 font-medium"
                                : "text-gray-700"
                            }
                          >
                            {avail}/{max}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {inPlan ? (
                            <span className="text-xs text-green-800 font-medium">
                              In Plan ✓
                            </span>
                          ) : isFull ? (
                            <span className="text-xs text-red-700">Full</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddToPlan(section.id, "A")}
                              aria-label={`Add section ${section.sectionNumber ?? section.id} to Plan A`}
                              className="text-xs bg-[#1B6B3A] text-white px-3 py-1.5 rounded font-medium hover:bg-[#155a2f] transition-colors"
                            >
                              Select
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Quick Info — {course.subject} {course.courseNumber}
            </h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Seats</span>
                <span
                  className={`font-medium ${
                    totalSeats === 0 ? "text-red-700" : ""
                  }`}
                >
                  {totalSeats}/{totalMax}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Instructor</span>
                <span className="font-medium text-right max-w-[140px] truncate">
                  {primaryInstructor}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Credits</span>
                <span className="font-medium">{credits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Term</span>
                <span className="font-medium">Summer 2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sections</span>
                <span className="font-medium">{course.sections.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPreCheck && (
        <PreCheckModal
          course={course}
          onClose={() => setShowPreCheck(false)}
          onAddToPlan={() => {
            const open = course.sections.find(
              (s) =>
                s.seatsAvailable === null || (s.seatsAvailable ?? 0) > 0,
            );
            if (open) handleAddToPlan(open.id, "A");
            setShowPreCheck(false);
          }}
        />
      )}

      {showRecovery && (
        <RecoveryDrawer
          course={course}
          onClose={() => setShowRecovery(false)}
        />
      )}
    </div>
  );
}
