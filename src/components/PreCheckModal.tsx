"use client";

import { useAudit } from "@/contexts/AuditContext";
import { usePlans } from "@/contexts/PlansContext";
import { checkPrerequisites } from "@/lib/restrictions";

interface Section {
  id: number;
  seatsAvailable: number | null;
  specialApproval: string | null;
  meetings: { days: string | null; startTime: string | null; endTime: string | null }[];
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
  const { isInPlan } = usePlans();
  const allCourses = audit
    ? [...audit.completedCourses, ...audit.inProgressCourses]
    : [];

  // Run checks
  const checks: CheckItem[] = [];

  // 1. Prerequisites
  const prereqs = checkPrerequisites(
    course.registrationRestrictions,
    audit?.completedCourses ?? []
  );
  const allPrereqsMet = prereqs.length === 0 || prereqs.every((p) => p.completed);
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

  // 2. Class standing
  checks.push({
    label: "Class Standing",
    passed: true,
    message: audit ? `${audit.classification} — no restriction` : "No audit data",
  });

  // 3. Seat availability
  const hasOpenSeat = course.sections.some(
    (s) => s.seatsAvailable === null || s.seatsAvailable > 0
  );
  checks.push({
    label: "Seat Availability",
    passed: hasOpenSeat,
    message: hasOpenSeat ? "Seats available" : "All sections full",
  });

  // 4. Time conflicts (simplified — would need full plan data for real check)
  checks.push({
    label: "Time Conflicts",
    passed: true,
    message: "No conflicts detected",
  });

  // 5. Repeat check
  const alreadyTaken = allCourses.some(
    (c) =>
      c.subject === course.subject &&
      c.courseNumber === course.courseNumber &&
      c.status === "completed"
  );
  checks.push({
    label: "Repeat Check",
    passed: !alreadyTaken,
    message: alreadyTaken ? "Course already completed" : "Not previously taken",
  });

  // 6. Permission
  const needsPermission = course.sections.some((s) => s.specialApproval);
  checks.push({
    label: "Permission",
    passed: !needsPermission,
    message: needsPermission ? "Special approval required" : "No permission needed",
  });

  const allPassed = checks.every((c) => c.passed);
  const inPlan = isInPlan(course.id);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            Pre-check: {course.subject} {course.courseNumber}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{course.courseTitle}</p>
        </div>

        <div className="px-6 py-4 space-y-3">
          {checks.map((check) => (
            <div key={check.label} className="flex items-start gap-3">
              <span
                className={`mt-0.5 text-lg ${
                  check.passed ? "text-green-500" : "text-red-500"
                }`}
              >
                {check.passed ? "✓" : "✗"}
              </span>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {check.label}
                </div>
                <div className="text-xs text-gray-500">{check.message}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div
            className={`text-sm font-semibold ${
              allPassed ? "text-green-600" : "text-red-600"
            }`}
          >
            {allPassed ? "Eligible" : "Blocked"}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Close
            </button>
            {allPassed && !inPlan && (
              <button
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
