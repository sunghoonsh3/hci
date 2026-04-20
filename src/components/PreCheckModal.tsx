"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAudit } from "@/contexts/AuditContext";
import { usePlans } from "@/contexts/PlansContext";
import { checkPrerequisites } from "@/lib/restrictions";
import { sectionsConflict } from "@/lib/conflicts";
import { fetchCourses } from "@/lib/fetchCourse";

interface MeetingTime {
  days: string | null;
  startTime: string | null;
  endTime: string | null;
}

interface Section {
  id: number;
  seatsAvailable: number | null;
  specialApproval: string | null;
  meetings: MeetingTime[];
}

interface Course {
  id: number;
  subject: string;
  courseNumber: string;
  courseTitle: string;
  registrationRestrictions: string | null;
  sections: Section[];
}

interface CheckItem {
  label: string;
  passed: boolean;
  message: string;
}

export default function PreCheckModal({
  course,
  onClose,
  onAddToPlan,
}: {
  course: Course;
  onClose: () => void;
  onAddToPlan: () => void;
}) {
  const { audit } = useAudit();
  const { plans, isInPlan } = usePlans();
  const allCourses = useMemo(
    () =>
      audit
        ? [...audit.completedCourses, ...audit.inProgressCourses]
        : [],
    [audit],
  );

  const [plannedMeetings, setPlannedMeetings] = useState<
    { courseLabel: string; meetings: MeetingTime[] }[]
  >([]);

  const otherCourseIds = useMemo(
    () =>
      [...new Set(plans.map((p) => p.courseId))]
        .filter((id) => id !== course.id)
        .sort((a, b) => a - b),
    [plans, course.id],
  );
  const otherIdsKey = otherCourseIds.join(",");

  useEffect(() => {
    if (otherCourseIds.length === 0) {
      setPlannedMeetings([]);
      return;
    }
    const controller = new AbortController();
    fetchCourses(otherCourseIds, controller.signal).then((courses) => {
      const items: { courseLabel: string; meetings: MeetingTime[] }[] = [];
      for (const c of courses) {
        for (const s of c.sections) {
          const inPlan = plans.find((p) => p.sectionId === s.id);
          if (inPlan) {
            items.push({
              courseLabel: `${c.subject} ${c.courseNumber}`,
              meetings: s.meetings,
            });
          }
        }
      }
      setPlannedMeetings(items);
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherIdsKey]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const checks: CheckItem[] = [];

  const prereqs = checkPrerequisites(
    course.registrationRestrictions,
    audit?.completedCourses ?? [],
  );
  const allPrereqsMet =
    prereqs.length === 0 || prereqs.every((p) => p.completed);
  checks.push({
    label: "Prerequisites",
    passed: allPrereqsMet,
    message: allPrereqsMet
      ? prereqs.length === 0
        ? "None required"
        : "All prerequisites completed"
      : `Missing: ${prereqs
          .filter((p) => !p.completed)
          .map((p) => p.courseCode)
          .join(", ")}`,
  });

  checks.push({
    label: "Class Standing",
    passed: true,
    message: audit
      ? `${audit.classification} — no restriction`
      : "No audit data",
  });

  const hasOpenSeat = course.sections.some(
    (s) => s.seatsAvailable === null || s.seatsAvailable > 0,
  );
  checks.push({
    label: "Seat Availability",
    passed: hasOpenSeat,
    message: hasOpenSeat ? "Seats available" : "All sections full",
  });

  let conflictCourse = "";
  const courseMeetings = course.sections.flatMap((s) => s.meetings);
  for (const planned of plannedMeetings) {
    if (sectionsConflict(courseMeetings, planned.meetings)) {
      conflictCourse = planned.courseLabel;
      break;
    }
  }
  checks.push({
    label: "Time Conflicts",
    passed: !conflictCourse,
    message: conflictCourse
      ? `Conflicts with ${conflictCourse}`
      : "No conflicts with current plan",
  });

  const alreadyTaken = allCourses.some(
    (c) =>
      c.subject === course.subject &&
      c.courseNumber === course.courseNumber &&
      c.status === "completed",
  );
  checks.push({
    label: "Repeat Check",
    passed: !alreadyTaken,
    message: alreadyTaken
      ? "Course already completed"
      : "Not previously taken",
  });

  const needsPermission = course.sections.some((s) => s.specialApproval);
  checks.push({
    label: "Permission",
    passed: !needsPermission,
    message: needsPermission
      ? "Special approval required"
      : "No permission needed",
  });

  const allPassed = checks.every((c) => c.passed);
  const inPlan = isInPlan(course.id);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="precheck-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4"
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <h2
              id="precheck-title"
              className="text-lg font-bold text-gray-900"
            >
              Pre-Registration Check — {course.subject} {course.courseNumber}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {course.courseTitle}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close pre-check dialog"
            className="text-gray-500 hover:text-gray-800 text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>

        <div
          role="status"
          className={`mx-6 mt-4 px-4 py-2 rounded-lg text-sm font-medium ${
            allPassed
              ? "bg-green-50 text-green-900 border border-green-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          {allPassed
            ? "Eligible — You meet all requirements to register for this course."
            : "Blocked — Some requirements are not met."}
        </div>

        <div className="px-6 py-4">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Detailed Checks
          </div>
          <ul className="space-y-3">
            {checks.map((check) => (
              <li key={check.label} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 text-lg ${
                    check.passed ? "text-green-700" : "text-red-700"
                  }`}
                  aria-hidden="true"
                >
                  {check.passed ? "✓" : "✗"}
                </span>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {check.label}
                  </div>
                  <div className="text-xs text-gray-700">{check.message}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div
            className={`text-sm font-semibold ${
              allPassed ? "text-green-700" : "text-red-700"
            }`}
          >
            {allPassed ? "Eligible" : "Blocked"}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              Close
            </button>
            {allPassed && !inPlan && (
              <button
                type="button"
                onClick={onAddToPlan}
                className="px-4 py-2 text-sm bg-[#1B6B3A] text-white rounded-lg font-medium hover:bg-[#155a2f] transition-colors"
              >
                Add to Plan A
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
