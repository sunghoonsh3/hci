"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAudit } from "@/contexts/AuditContext";
import { usePlans } from "@/contexts/PlansContext";
import { computeEligibility } from "@/lib/eligibility";
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
  const { plans, addToPlan, removeFromPlan, isInPlan, findSlotsForSection } =
    usePlans();

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

  function handleAddToPlan(course: Course) {
    const openSection = course.sections.find(
      (s) => s.seatsAvailable === null || s.seatsAvailable > 0,
    );
    if (!openSection) {
      show(`${course.subject} ${course.courseNumber} has no open seats`, {
        variant: "warning",
      });
      return;
    }
    const existing = findSlotsForSection(openSection.id);
    const result = addToPlan(course.id, openSection.id, "A", {
      subject: course.subject,
      courseNumber: course.courseNumber,
      courseTitle: course.courseTitle,
    });
    if (!result.added) {
      show(
        `${course.subject} ${course.courseNumber} already in Plan A`,
        { variant: "warning" },
      );
      return;
    }
    const alsoIn = existing.filter((s) => s !== "A");
    const extra = alsoIn.length
      ? ` (also in Plan ${alsoIn.join(", ")})`
      : "";
    show(`${course.subject} ${course.courseNumber} added to Plan A${extra}`, {
      undo: () => removeFromPlan(openSection.id, "A"),
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

      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label
            htmlFor="search-subject"
            className="block text-xs text-gray-600 mb-1"
          >
            Subject
          </label>
          <select
            id="search-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="search-keyword"
            className="block text-xs text-gray-600 mb-1"
          >
            Keyword
          </label>
          <input
            id="search-keyword"
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Search courses..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pb-1">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="rounded"
          />
          Open seats only
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 pb-1">
          <input
            type="checkbox"
            checked={coreOnly}
            onChange={(e) => setCoreOnly(e.target.checked)}
            className="rounded"
          />
          Core requirements
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 pb-1">
          <input
            type="checkbox"
            checked={majorOnly}
            onChange={(e) => setMajorOnly(e.target.checked)}
            className="rounded"
          />
          My major courses
        </label>
        <button
          type="button"
          onClick={applyFilters}
          className="bg-[#0C2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0a1d35] transition-colors"
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
                  seats.openSections === 0
                    ? "All sections full"
                    : seats.openSections === seats.total
                      ? `${seats.total} of ${seats.total} open`
                      : `${seats.openSections} of ${seats.total} open`;
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
                      {inPlan ? (
                        <span className="text-xs text-green-700 font-medium">
                          In Plan ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToPlan(course);
                          }}
                          aria-label={`Add ${course.subject} ${course.courseNumber} to Plan A`}
                          className="text-xs bg-[#1B6B3A] text-white px-3 py-1.5 rounded font-medium hover:bg-[#155a2f] transition-colors"
                        >
                          + Plan A
                        </button>
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
