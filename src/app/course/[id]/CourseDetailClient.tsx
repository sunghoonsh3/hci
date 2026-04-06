"use client";

import { useState } from "react";
import Link from "next/link";
import { useAudit } from "@/contexts/AuditContext";
import { usePlans } from "@/contexts/PlansContext";
import { computeEligibility } from "@/lib/eligibility";
import { parseRestrictions, checkPrerequisites } from "@/lib/restrictions";
import { getRequirementBadges } from "@/lib/requirements";
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

function formatDays(daysJson: string | null): string {
  if (!daysJson) return "TBA";
  try {
    const days: string[] = JSON.parse(daysJson);
    return days.join("");
  } catch {
    return "TBA";
  }
}

function formatTime(start: string | null, end: string | null): string {
  if (!start || !end) return "TBA";
  return `${start}-${end}`;
}

export default function CourseDetailClient({ course }: { course: Course }) {
  const { audit } = useAudit();
  const { addToPlan, isSectionInPlan } = usePlans();
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [toast, setToast] = useState("");

  const allCourses = audit
    ? [...audit.completedCourses, ...audit.inProgressCourses]
    : [];
  const status = computeEligibility(
    course.subject,
    course.courseNumber,
    course.registrationRestrictions,
    course.sections,
    allCourses
  );
  const restrictions = parseRestrictions(course.registrationRestrictions);
  const prereqChecks = checkPrerequisites(
    course.registrationRestrictions,
    audit?.completedCourses ?? []
  );
  const badges = getRequirementBadges(course.subject, course.courseNumber);
  const isBlocked = status === "full" || status === "needs-prereq" || status === "restricted";
  const primaryInstructor = course.sections[0]?.instructors[0]?.name ?? "TBA";
  const credits =
    course.creditHoursMin === course.creditHoursMax
      ? `${course.creditHoursMin}`
      : `${course.creditHoursMin}-${course.creditHoursMax}`;

  function handleAddToPlan(sectionId: number, slot: PlanSlot) {
    addToPlan(course.id, sectionId, slot);
    setToast(`${course.subject} ${course.courseNumber} Sec added to Plan ${slot}`);
    setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className="max-w-4xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 right-6 bg-[#1B6B3A] text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-4">
        <Link href="/search" className="hover:text-gray-700">
          Search
        </Link>{" "}
        / {course.subject} {course.courseNumber}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {course.subject} {course.courseNumber} — {course.courseTitle}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
            <span>{primaryInstructor}</span>
            <span>·</span>
            <span>{credits} credits</span>
            <span>·</span>
            <span>Summer 2026</span>
            <EligibilityBadge status={status} size="md" />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setShowPreCheck(true)}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Pre-check
        </button>
        {isBlocked && (
          <button
            onClick={() => setShowRecovery(true)}
            className="bg-white border border-orange-300 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors"
          >
            Recovery Options
          </button>
        )}
      </div>

      {/* Blocked banner */}
      {isBlocked && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-red-600 font-medium">Registration Blocked</span>
            <span className="text-sm text-red-500">
              {status === "full"
                ? "All sections are full"
                : status === "needs-prereq"
                ? "Missing prerequisites"
                : "Special approval required"}
            </span>
          </div>
        </div>
      )}

      {/* Description */}
      {course.description && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Description
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {course.description}
          </p>
        </div>
      )}

      {/* Prerequisites */}
      {prereqChecks.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Prerequisites
          </h2>
          <div className="space-y-1">
            {prereqChecks.map((check) => (
              <div key={check.courseCode} className="flex items-center gap-2 text-sm">
                <span className={check.completed ? "text-green-600" : "text-red-600"}>
                  {check.completed ? "✓" : "✗"}
                </span>
                <span className="font-medium">{check.courseCode}</span>
                {check.completed ? (
                  <span className="text-green-600">
                    — completed {check.term} ({check.grade})
                  </span>
                ) : (
                  <span className="text-red-600">— not completed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Restrictions */}
      {restrictions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Restrictions
          </h2>
          <ul className="space-y-1">
            {restrictions.map((r, i) => (
              <li key={i} className="text-sm text-gray-600">
                <span className="font-medium">{r.label}</span>
                {r.type === "other" ? "" : ` — ${r.raw}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Requirement badges */}
      {badges.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Requirements Fulfilled
          </h2>
          <div className="flex gap-2">
            {badges.map((b) => (
              <span
                key={b}
                className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-sm font-medium"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sections table */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Sections
        </h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-2 font-medium text-gray-600">Sec</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">CRN</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Time</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Room</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Instructor</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Seats</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {course.sections.map((section) => {
                const meeting = section.meetings[0];
                const isFull =
                  section.seatsAvailable !== null && section.seatsAvailable <= 0;
                return (
                  <tr
                    key={section.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-2">{section.sectionNumber ?? "-"}</td>
                    <td className="px-4 py-2 text-gray-500">{section.crn ?? "-"}</td>
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
                    <td className="px-4 py-2 text-gray-500">
                      {meeting?.room ?? "TBA"}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {section.instructors.map((i) => i.name).join(", ") || "TBA"}
                    </td>
                    <td className="px-4 py-2">
                      {(() => {
                        const avail = section.seatsAvailable ?? 0;
                        const max = section.maxEnrollment ?? 0;
                        const pct = max > 0 ? ((max - avail) / max) * 100 : 0;
                        return (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  avail === 0 ? "bg-red-500" : pct > 80 ? "bg-yellow-500" : "bg-green-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs ${isFull ? "text-red-600 font-medium" : "text-gray-600"}`}>
                              {avail}/{max}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(["A", "B", "C"] as PlanSlot[]).map((slot) =>
                          isSectionInPlan(section.id, slot) ? (
                            <span
                              key={slot}
                              className="text-[10px] text-gray-400 px-2 py-1"
                            >
                              {slot} ✓
                            </span>
                          ) : (
                            <button
                              key={slot}
                              onClick={() => handleAddToPlan(section.id, slot)}
                              className="text-[11px] bg-[#1B6B3A] text-white px-2 py-1 rounded font-medium hover:bg-[#155a2f] transition-colors"
                            >
                              +{slot}
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pre-check modal */}
      {showPreCheck && (
        <PreCheckModal
          course={course}
          onClose={() => setShowPreCheck(false)}
          onAddToPlan={() => {
            const open = course.sections.find(
              (s) => s.seatsAvailable === null || s.seatsAvailable! > 0
            );
            if (open) handleAddToPlan(open.id, "A");
            setShowPreCheck(false);
          }}
        />
      )}

      {/* Recovery drawer */}
      {showRecovery && (
        <RecoveryDrawer
          course={course}
          onClose={() => setShowRecovery(false)}
        />
      )}
    </div>
  );
}
