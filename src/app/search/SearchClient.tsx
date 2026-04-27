"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAudit } from "@/contexts/AuditContext";
import { usePlans } from "@/contexts/PlansContext";
import { computeEligibility, isRegisterable } from "@/lib/eligibility";
import { getRequirementBadges } from "@/lib/requirements";
import { fetchCourses } from "@/lib/fetchCourse";
import type { CourseDTO } from "@/lib/schemas";
import { useToast } from "@/contexts/ToastContext";
import EligibilityBadge from "@/components/EligibilityBadge";
import WeeklyCalendar, {
  type CalendarEvent,
} from "@/components/WeeklyCalendar";
import type { EligibilityStatus, PlanSlot } from "@/types";

interface Section {
  id: number;
  seatsAvailable: number | null;
  maxEnrollment: number | null;
  specialApproval: string | null;
  meetings: {
    days: string | null;
    startTime: string | null;
    endTime: string | null;
  }[];
  instructors: { name: string }[];
}

interface Course {
  id: number;
  subject: string;
  courseNumber: string;
  courseTitle: string;
  creditHoursMin: number | null;
  creditHoursMax: number | null;
  registrationRestrictions: string | null;
  sections: Section[];
}

const PLAN_COLORS: Record<PlanSlot, string> = {
  A: "#1B6B3A",
  B: "#2563eb",
  C: "#6b7280",
};

function parseDays(days: string | null): string[] {
  if (!days) return [];
  try {
    const parsed = JSON.parse(days);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function FilterChip({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`h-10 inline-flex items-center gap-2 px-3 rounded-lg text-sm border transition-colors ${
        checked
          ? "bg-[#0C2340] border-[#0C2340] text-white"
          : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
      }`}
    >
      <span
        className={`w-4 h-4 rounded border flex items-center justify-center ${
          checked ? "bg-white border-white" : "bg-white border-gray-400"
        }`}
      >
        {checked && (
          <svg
            className="w-3 h-3 text-[#0C2340]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}

export default function SearchClient({
  courses,
  subjects,
  initialSubject,
  initialKeyword,
  initialOpenOnly,
}: {
  courses: Course[];
  subjects: string[];
  initialSubject: string;
  initialKeyword: string;
  initialOpenOnly: boolean;
}) {
  const router = useRouter();
  const { audit } = useAudit();
  const {
    plans,
    addToPlan,
    removeFromPlan,
    isInPlan,
    isSectionInPlan,
    findSlotsForSection,
  } = usePlans();

  const PLAN_SLOTS: PlanSlot[] = ["A", "B", "C"];

  const [subject, setSubject] = useState(initialSubject);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [openOnly, setOpenOnly] = useState(initialOpenOnly);
  const [coreOnly, setCoreOnly] = useState(false);
  const [majorOnly, setMajorOnly] = useState(false);
  const [courseMap, setCourseMap] = useState<Record<number, CourseDTO>>({});

  const { show } = useToast();

  const planIdsKey = useMemo(
    () =>
      [...new Set(plans.map((p) => p.courseId))]
        .sort((a, b) => a - b)
        .join(","),
    [plans],
  );

  useEffect(() => {
    if (!planIdsKey) return;
    const ids = planIdsKey.split(",").map((n) => parseInt(n, 10));
    const controller = new AbortController();
    fetchCourses(ids, controller.signal).then((results) => {
      setCourseMap((prev) => {
        const next: typeof prev = {};
        const referenced = new Set(ids);
        for (const [key, value] of Object.entries(prev)) {
          const id = Number(key);
          if (referenced.has(id)) next[id] = value;
        }
        for (const c of results) next[c.id] = c;
        return next;
      });
    });
    return () => controller.abort();
  }, [planIdsKey]);

  // Drop cached course data when no plan entries reference anything.
  // Adjust-state-during-render idiom avoids the set-state-in-effect lint.
  const [lastPlanIdsKey, setLastPlanIdsKey] = useState(planIdsKey);
  if (lastPlanIdsKey !== planIdsKey) {
    setLastPlanIdsKey(planIdsKey);
    if (!planIdsKey) setCourseMap({});
  }

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    if (plans.length === 0) return [];
    const events: CalendarEvent[] = [];
    for (const entry of plans) {
      const course = courseMap[entry.courseId];
      if (!course) continue;
      const section = course.sections.find((s) => s.id === entry.sectionId);
      if (!section) continue;
      for (const m of section.meetings) {
        if (!m.startTime || !m.endTime) continue;
        const days = parseDays(m.days);
        if (days.length === 0) continue;
        events.push({
          id: entry.sectionId,
          label: `${course.subject} ${course.courseNumber}`,
          days,
          startTime: m.startTime,
          endTime: m.endTime,
          color: PLAN_COLORS[entry.planSlot] || "#1B6B3A",
        });
      }
    }
    return events;
  }, [plans, courseMap]);

  const applyFilters = useCallback(() => {
    // Only subject/keyword hit the server (large dataset). openOnly is
    // client-side so it does not belong in this round trip; it is still
    // carried along in the URL so a deep-link preserves the checkbox.
    const sp = new URLSearchParams();
    if (subject) sp.set("subject", subject);
    if (keyword) sp.set("keyword", keyword);
    if (openOnly) sp.set("open", "true");
    router.push(`/search?${sp.toString()}`);
  }, [subject, keyword, openOnly, router]);

  function getStatus(course: Course): EligibilityStatus {
    const allCourses = audit
      ? [...audit.completedCourses, ...audit.inProgressCourses]
      : [];
    return computeEligibility(
      course.subject,
      course.courseNumber,
      course.registrationRestrictions,
      course.sections,
      allCourses,
      !!audit,
    );
  }

  function sectionSummary(course: Course) {
    let avail = 0;
    let max = 0;
    let openSections = 0;
    for (const s of course.sections) {
      avail += s.seatsAvailable ?? 0;
      max += s.maxEnrollment ?? 0;
      if (s.seatsAvailable === null || s.seatsAvailable > 0) openSections += 1;
    }
    return { avail, max, openSections, total: course.sections.length };
  }

  const displayCourses = useMemo(() => {
    let result = courses;
    if (openOnly) {
      result = result.filter((c) =>
        c.sections.some(
          (s) => s.seatsAvailable === null || s.seatsAvailable > 0,
        ),
      );
    }
    if (coreOnly) {
      result = result.filter(
        (c) => getRequirementBadges(c.subject, c.courseNumber).length > 0,
      );
    }
    if (majorOnly) {
      result = result.filter(
        (c) =>
          c.subject === "CSE" ||
          c.subject === "ACMS" ||
          c.subject === "MATH",
      );
    }
    return result;
  }, [courses, openOnly, coreOnly, majorOnly]);

  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Reset pagination when the filter output changes.
  // React docs recommend the "adjust state during render" idiom for prop-derived resets.
  const [lastDisplayed, setLastDisplayed] = useState(displayCourses);
  if (lastDisplayed !== displayCourses) {
    setLastDisplayed(displayCourses);
    setVisibleCount(PAGE_SIZE);
  }
  const visibleCourses = displayCourses.slice(0, visibleCount);
  const remaining = displayCourses.length - visibleCourses.length;

  function handleAddToPlan(course: Course, slot: PlanSlot) {
    const openSection = course.sections.find(
      (s) => s.seatsAvailable === null || s.seatsAvailable > 0,
    );
    if (!openSection) {
      show(`${course.subject} ${course.courseNumber} has no open seats`, {
        variant: "error",
      });
      return;
    }
    const existing = findSlotsForSection(openSection.id);
    const result = addToPlan(course.id, openSection.id, slot, {
      subject: course.subject,
      courseNumber: course.courseNumber,
      courseTitle: course.courseTitle,
    });
    if (!result.added) {
      show(
        `${course.subject} ${course.courseNumber} already in Plan ${slot}`,
        { variant: "warning" },
      );
      return;
    }
    const alsoIn = existing.filter((s) => s !== slot);
    const extra = alsoIn.length
      ? ` (also in Plan ${alsoIn.join(", ")})`
      : "";
    show(
      `${course.subject} ${course.courseNumber} added to Plan ${slot}${extra}`,
      { undo: () => removeFromPlan(openSection.id, slot) },
    );
  }

  function handleRemoveSlot(course: Course, slot: PlanSlot) {
    const entries = plans.filter(
      (p) => p.courseId === course.id && p.planSlot === slot,
    );
    if (entries.length === 0) return;
    for (const e of entries) removeFromPlan(e.sectionId, slot);
    show(`${course.subject} ${course.courseNumber} removed from Plan ${slot}`, {
      undo: () => {
        for (const e of entries) {
          addToPlan(course.id, e.sectionId, slot, {
            subject: course.subject,
            courseNumber: course.courseNumber,
            courseTitle: course.courseTitle,
          });
        }
      },
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          Search Results{" "}
          <span className="text-sm font-normal text-gray-600">
            — {displayCourses.length} course
            {displayCourses.length !== 1 ? "s" : ""}
          </span>
        </h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-6 flex flex-wrap items-center gap-2">
        <select
          id="search-subject"
          aria-label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-10 border border-gray-300 rounded-lg px-3 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0C2340]/20 focus:border-[#0C2340]"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <svg
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
            />
          </svg>
          <input
            id="search-keyword"
            type="text"
            aria-label="Keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Search courses..."
            className="h-10 w-full border border-gray-300 rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C2340]/20 focus:border-[#0C2340]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <FilterChip
            label="Open seats only"
            checked={openOnly}
            onChange={setOpenOnly}
          />
          <FilterChip
            label="Core requirements"
            checked={coreOnly}
            onChange={setCoreOnly}
          />
          <FilterChip
            label="My major courses"
            checked={majorOnly}
            onChange={setMajorOnly}
          />
        </div>

        <button
          type="button"
          onClick={applyFilters}
          className="h-10 bg-[#0C2340] text-white px-5 rounded-lg text-sm font-medium hover:bg-[#0a1d35] transition-colors"
        >
          Search
        </button>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto max-h-[calc(100vh-260px)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Course
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Title
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Seats
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Reqs
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleCourses.map((course) => {
                const status = getStatus(course);
                const seats = sectionSummary(course);
                const badges = getRequirementBadges(
                  course.subject,
                  course.courseNumber,
                );
                const inPlan = isInPlan(course.id);
                const sectionsLabel =
                  seats.openSections === 0 && seats.total > 1
                    ? "All sections full"
                    : `${seats.openSections} of ${seats.total} ${
                        seats.total === 1 ? "section" : "sections"
                      } open`;
                return (
                  <tr
                    key={course.id}
                    onClick={() => router.push(`/course/${course.id}`)}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#0C2340]">
                        {course.subject} {course.courseNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {course.courseTitle}
                    </td>
                    <td className="px-4 py-3">
                      <EligibilityBadge status={status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col leading-tight">
                        <span
                          className={
                            seats.avail === 0
                              ? "text-red-700 font-medium"
                              : "text-gray-700"
                          }
                        >
                          {seats.avail}/{seats.max}
                        </span>
                        <span
                          className={`text-[10px] mt-0.5 ${
                            seats.openSections === 0
                              ? "text-red-700"
                              : "text-gray-600"
                          }`}
                        >
                          {sectionsLabel}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {badges.map((b) => (
                          <span
                            key={b}
                            className="inline-flex items-center rounded-full bg-blue-50 text-blue-800 px-2 py-0.5 text-xs font-medium"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isRegisterable(status) && !inPlan ? (
                        <span
                          className="text-xs text-gray-500"
                          title="Cannot add to plan while blocked"
                        >
                          —
                        </span>
                      ) : (
                        <div
                          className="flex justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {PLAN_SLOTS.map((slot) => {
                            const openSection = course.sections.find(
                              (s) =>
                                s.seatsAvailable === null ||
                                s.seatsAvailable > 0,
                            );
                            const inThisSlot = openSection
                              ? isSectionInPlan(openSection.id, slot)
                              : false;
                            if (inThisSlot && openSection) {
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveSlot(course, slot);
                                  }}
                                  aria-label={`Remove ${course.subject} ${course.courseNumber} from Plan ${slot}`}
                                  title={`Remove from Plan ${slot}`}
                                  className="group text-xs px-2.5 py-1.5 rounded font-medium text-white inline-flex items-center whitespace-nowrap hover:brightness-110 transition"
                                  style={{
                                    backgroundColor: PLAN_COLORS[slot],
                                  }}
                                >
                                  <span className="group-hover:hidden">
                                    ✓ {slot}
                                  </span>
                                  <span className="hidden group-hover:inline">
                                    × {slot}
                                  </span>
                                </button>
                              );
                            }
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToPlan(course, slot);
                                }}
                                disabled={!isRegisterable(status)}
                                aria-label={`Add ${course.subject} ${course.courseNumber} to Plan ${slot}`}
                                className="text-xs px-2.5 py-1.5 rounded font-medium text-white whitespace-nowrap hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                  backgroundColor: PLAN_COLORS[slot],
                                }}
                              >
                                + {slot}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {remaining > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
              <span className="text-gray-700">
                Showing {visibleCourses.length} of {displayCourses.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((v) => v + PAGE_SIZE)
                }
                className="bg-[#0C2340] text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-[#0a1d35] transition-colors"
              >
                Load {Math.min(PAGE_SIZE, remaining)} more
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-800">
              Weekly Schedule
            </h2>
          </div>
          <WeeklyCalendar
            events={calendarEvents}
            compact
            emptyMessage="Add courses to your plan to see them on the schedule."
          />
        </div>
      </div>
    </div>
  );
}
