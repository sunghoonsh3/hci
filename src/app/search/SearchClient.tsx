"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";

import { useAudit } from "@/contexts/AuditContext";
import { usePlans } from "@/contexts/PlansContext";
import { computeEligibility } from "@/lib/eligibility";
import { getRequirementBadges } from "@/lib/requirements";
import EligibilityBadge from "@/components/EligibilityBadge";
import WeeklyCalendar from "@/components/WeeklyCalendar";
import type { CalendarEvent } from "@/components/WeeklyCalendar";
import type { EligibilityStatus } from "@/types";

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

const PLAN_COLORS: Record<string, string> = {
  A: "#1B6B3A",
  B: "#2563eb",
  C: "#6b7280",
};

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
  const { plans, addToPlan, isInPlan } = usePlans();

  const [subject, setSubject] = useState(initialSubject);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [openOnly, setOpenOnly] = useState(initialOpenOnly);
  const [coreOnly, setCoreOnly] = useState(false);
  const [majorOnly, setMajorOnly] = useState(false);
  const [toast, setToast] = useState("");
  const [showAllPlans, setShowAllPlans] = useState(false);

  // Build calendar events from planned courses
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  useEffect(() => {
    if (plans.length === 0) {
      setCalendarEvents([]);
      return;
    }
    const courseIds = [...new Set(plans.map((p) => p.courseId))];
    Promise.all(
      courseIds.map((id) =>
        fetch(`/api/course/${id}`)
          .then((r) => r.json())
          .catch(() => null)
      )
    ).then((results) => {
      const events: CalendarEvent[] = [];
      for (const entry of plans) {
        const c = results.find((r: { id: number }) => r?.id === entry.courseId);
        if (!c) continue;
        const sec = c.sections.find(
          (s: { id: number }) => s.id === entry.sectionId
        );
        if (!sec) continue;
        for (const m of sec.meetings) {
          if (!m.days || !m.startTime || !m.endTime) continue;
          let days: string[];
          try {
            days = JSON.parse(m.days);
          } catch {
            continue;
          }
          events.push({
            id: entry.sectionId,
            label: `${c.subject} ${c.courseNumber}`,
            days,
            startTime: m.startTime,
            endTime: m.endTime,
            color: PLAN_COLORS[entry.planSlot] || "#1B6B3A",
          });
        }
      }
      setCalendarEvents(events);
    });
  }, [plans]);

  const applyFilters = useCallback(() => {
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
      !!audit
    );
  }

  function totalSeats(course: Course) {
    const avail = course.sections.reduce(
      (sum, s) => sum + (s.seatsAvailable ?? 0),
      0
    );
    const max = course.sections.reduce(
      (sum, s) => sum + (s.maxEnrollment ?? 0),
      0
    );
    return { avail, max };
  }

  // Client-side advanced filters
  let displayCourses = courses;
  if (coreOnly) {
    displayCourses = displayCourses.filter(
      (c) => getRequirementBadges(c.subject, c.courseNumber).length > 0
    );
  }
  if (majorOnly) {
    displayCourses = displayCourses.filter(
      (c) =>
        c.subject === "CSE" || c.subject === "ACMS" || c.subject === "MATH"
    );
  }

  function handleAddToPlan(course: Course) {
    const openSection = course.sections.find(
      (s) => s.seatsAvailable === null || s.seatsAvailable > 0
    );
    if (openSection) {
      addToPlan(course.id, openSection.id, "A");
      setToast(`${course.subject} ${course.courseNumber} added to Plan A`);
      setTimeout(() => setToast(""), 3000);
    }
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 right-6 bg-[#1B6B3A] text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          Search Results{" "}
          <span className="text-sm font-normal text-gray-500">
            — {displayCourses.length} course
            {displayCourses.length !== 1 ? "s" : ""}
          </span>
        </h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Subject</label>
          <select
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
          <label className="block text-xs text-gray-500 mb-1">Keyword</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Search courses..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 pb-1">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="rounded"
          />
          Open seats only
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 pb-1">
          <input
            type="checkbox"
            checked={coreOnly}
            onChange={(e) => setCoreOnly(e.target.checked)}
            className="rounded"
          />
          Core requirements
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 pb-1">
          <input
            type="checkbox"
            checked={majorOnly}
            onChange={(e) => setMajorOnly(e.target.checked)}
            className="rounded"
          />
          My major courses
        </label>
        <button
          onClick={applyFilters}
          className="bg-[#0C2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0a1d35] transition-colors"
        >
          Search
        </button>
      </div>

      {/* Main content + Weekly Schedule */}
      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* Results table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto max-h-[calc(100vh-260px)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Course
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Title
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Seats
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
              {displayCourses.map((course) => {
                const status = getStatus(course);
                const seats = totalSeats(course);
                const badges = getRequirementBadges(
                  course.subject,
                  course.courseNumber
                );
                const inPlan = isInPlan(course.id);
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
                    <td className="px-4 py-3 text-gray-700">
                      {course.courseTitle}
                    </td>
                    <td className="px-4 py-3">
                      <EligibilityBadge status={status} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          seats.avail === 0
                            ? "text-red-600 font-medium"
                            : "text-gray-600"
                        }
                      >
                        {seats.avail}/{seats.max}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {badges.map((b) => (
                          <span
                            key={b}
                            className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inPlan ? (
                        <span className="text-xs text-green-600 font-medium">
                          In Plan ✓
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToPlan(course);
                          }}
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
        </div>

        {/* Weekly Schedule */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Weekly Schedule
            </h2>
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={showAllPlans}
                onChange={(e) => setShowAllPlans(e.target.checked)}
                className="rounded"
              />
              Show All Plans
            </label>
          </div>
          <WeeklyCalendar events={calendarEvents} compact />
        </div>
      </div>
    </div>
  );
}
