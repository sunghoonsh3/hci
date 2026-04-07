"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlans } from "@/contexts/PlansContext";
import { useAudit } from "@/contexts/AuditContext";
import { getRequirementBadges } from "@/lib/requirements";
import { computeEligibility } from "@/lib/eligibility";
import EligibilityBadge from "@/components/EligibilityBadge";
import WeeklyCalendar from "@/components/WeeklyCalendar";
import type { CalendarEvent } from "@/components/WeeklyCalendar";
import type { PlanSlot } from "@/types";

function RowMenu({
  sectionId,
  currentSlot,
  onMove,
  onRemove,
}: {
  sectionId: number;
  currentSlot: PlanSlot;
  onMove: (sectionId: number, from: PlanSlot, to: PlanSlot) => void;
  onRemove: (sectionId: number, slot: PlanSlot) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const otherSlots = (["A", "B", "C"] as PlanSlot[]).filter((s) => s !== currentSlot);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((p) => !p)}
        className="text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100 transition-colors"
        title="Actions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 w-40">
          {otherSlots.map((slot) => (
            <button
              key={slot}
              onClick={() => {
                onMove(sectionId, currentSlot, slot);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Move to Plan {slot}
            </button>
          ))}
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={() => {
              onRemove(sectionId, currentSlot);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

interface CourseData {
  id: number;
  subject: string;
  courseNumber: string;
  courseTitle: string;
  creditHoursMin: number | null;
  creditHoursMax: number | null;
  registrationRestrictions: string | null;
  sections: {
    id: number;
    sectionNumber: string | null;
    seatsAvailable: number | null;
    specialApproval: string | null;
    meetings: {
      days: string | null;
      startTime: string | null;
      endTime: string | null;
    }[];
  }[];
}

const PLAN_COLORS: Record<PlanSlot, string> = {
  A: "#1B6B3A",
  B: "#2563eb",
  C: "#6b7280",
};

export default function PlanPage() {
  const router = useRouter();
  const { plans, removeFromPlan, moveToPlan, loaded } = usePlans();
  const { audit } = useAudit();
  const [activeSlot, setActiveSlot] = useState<PlanSlot>("A");
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [courseDataMap, setCourseDataMap] = useState<Record<number, CourseData>>({});
  const [highlightedSection, setHighlightedSection] = useState<number | null>(null);

  // Fetch course data for all plan entries
  useEffect(() => {
    if (!loaded) return;
    const courseIds = [...new Set(plans.map((p) => p.courseId))];

    setCourseDataMap((prev) => {
      const missing = courseIds.filter((id) => !prev[id]);
      if (missing.length === 0) return prev;

      Promise.all(
        missing.map((id) =>
          fetch(`/api/course/${id}`)
            .then((r) => r.json())
            .catch(() => null)
        )
      ).then((results) => {
        setCourseDataMap((curr) => {
          const updated = { ...curr };
          for (const course of results) {
            if (course) updated[course.id] = course;
          }
          return updated;
        });
      });

      return prev;
    });
  }, [plans, loaded]);

  const slotEntries = plans.filter((p) => p.planSlot === activeSlot);

  // Build calendar events
  const calendarEntries = showAllPlans ? plans : slotEntries;
  const events: CalendarEvent[] = [];
  for (const entry of calendarEntries) {
    const course = courseDataMap[entry.courseId];
    if (!course) continue;
    const section = course.sections.find((s) => s.id === entry.sectionId);
    if (!section) continue;
    for (const meeting of section.meetings) {
      if (!meeting.days || !meeting.startTime || !meeting.endTime) continue;
      let days: string[];
      try {
        days = JSON.parse(meeting.days);
      } catch {
        continue;
      }
      events.push({
        id: entry.sectionId,
        label: `${course.subject} ${course.courseNumber}`,
        days,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        color: PLAN_COLORS[entry.planSlot],
      });
    }
  }

  // Calculate total credits
  const totalCredits = slotEntries.reduce((sum, entry) => {
    const c = courseDataMap[entry.courseId];
    return sum + (c?.creditHoursMin ?? 0);
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Plan</h1>
        <Link
          href="/export"
          className="bg-[#1B6B3A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#155a2f] transition-colors"
        >
          Export to NOVO
        </Link>
      </div>

      {/* Plan tabs */}
      <div className="flex gap-2 mb-4">
        {(["A", "B", "C"] as PlanSlot[]).map((slot) => {
          const count = plans.filter((p) => p.planSlot === slot).length;
          return (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSlot === slot
                  ? "text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              style={
                activeSlot === slot
                  ? { backgroundColor: PLAN_COLORS[slot] }
                  : undefined
              }
            >
              Plan {slot} ({count})
            </button>
          );
        })}
        <label className="flex items-center gap-2 ml-4 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showAllPlans}
            onChange={(e) => setShowAllPlans(e.target.checked)}
            className="rounded"
          />
          Show all plans on calendar
        </label>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* Course table */}
        <div>
          {slotEntries.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-500">No courses in Plan {activeSlot}.</p>
              <Link
                href="/search"
                className="text-[#1B6B3A] font-medium text-sm hover:underline mt-2 inline-block"
              >
                Search for courses
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Course
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Title
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Credits
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Reqs
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slotEntries.map((entry) => {
                    const course = courseDataMap[entry.courseId];
                    const section = course?.sections.find(
                      (s) => s.id === entry.sectionId
                    );
                    return (
                      <tr
                        key={entry.sectionId}
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          highlightedSection === entry.sectionId
                            ? "bg-yellow-50 ring-2 ring-inset ring-yellow-400"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          {course ? (
                            <Link
                              href={`/course/${course.id}`}
                              className="font-medium text-[#0C2340] hover:underline block"
                            >
                              {course.subject} {course.courseNumber}
                            </Link>
                          ) : (
                            <span className="text-gray-400">Loading...</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {course ? (
                            <Link
                              href={`/course/${course.id}`}
                              className="text-gray-700 hover:underline block"
                            >
                              {course.courseTitle}
                            </Link>
                          ) : (
                            <span className="text-gray-400">...</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {section
                              ? `Sec ${section.sectionNumber ?? "-"}`
                              : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {course?.creditHoursMin ?? "?"}
                        </td>
                        <td className="px-4 py-3">
                          {course ? (
                            <EligibilityBadge
                              status={computeEligibility(
                                course.subject,
                                course.courseNumber,
                                course.registrationRestrictions,
                                course.sections,
                                audit
                                  ? [
                                      ...audit.completedCourses,
                                      ...audit.inProgressCourses,
                                    ]
                                  : []
                              )}
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {course ? (
                            <div className="flex gap-1 flex-wrap">
                              {getRequirementBadges(
                                course.subject,
                                course.courseNumber
                              ).map((b) => (
                                <span
                                  key={b}
                                  className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium"
                                >
                                  {b}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3 text-xs">
                            <button
                              onClick={() =>
                                removeFromPlan(entry.sectionId, activeSlot)
                              }
                              className="text-red-600 hover:text-red-800 font-medium hover:underline"
                            >
                              Remove
                            </button>
                            {course && (
                              <button
                                onClick={() =>
                                  router.push(`/course/${course.id}`)
                                }
                                className="text-gray-600 hover:text-gray-800 font-medium hover:underline"
                              >
                                Options
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 border-t border-gray-200">
                Total: {totalCredits} credits · {slotEntries.length} course
                {slotEntries.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>

        {/* Weekly calendar */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Weekly Schedule
          </h2>
          <WeeklyCalendar
            events={events}
            highlightedId={highlightedSection}
            onEventClick={(id) =>
              setHighlightedSection((prev) => (prev === id ? null : id))
            }
          />
          {showAllPlans && (
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: "#1B6B3A" }}
                />
                <span>Plan A</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: "#2563eb" }}
                />
                <span>Plan B</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: "#6b7280" }}
                />
                <span>Plan C</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
