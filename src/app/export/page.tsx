"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cycleIndex } from "@/hooks/useRovingTabIndex";
import Link from "next/link";
import { usePlans } from "@/contexts/PlansContext";
import { useAudit } from "@/contexts/AuditContext";
import {
  computeEligibility,
  isRegisterable,
  registrationBlockedReason,
} from "@/lib/eligibility";
import {
  fetchCoursesReport,
  toCourseMap,
} from "@/lib/fetchCourse";
import { useToast } from "@/contexts/ToastContext";
import type { CourseDTO } from "@/lib/schemas";
import EligibilityBadge from "@/components/EligibilityBadge";
import WeeklyCalendar, {
  type CalendarEvent,
} from "@/components/WeeklyCalendar";
import type { EligibilityStatus } from "@/types";

interface ExportItem {
  course: CourseDTO;
  sectionId: number;
  status: EligibilityStatus;
  result: "transferred" | "blocked";
  reason?: string;
}

type Slot = "A" | "B" | "C";

const PLAN_COLORS: Record<Slot, string> = {
  A: "#1B6B3A",
  B: "#2563eb",
  C: "#6b7280",
};

const SLOTS: Slot[] = ["A", "B", "C"];

function parseDays(days: string | null): string[] {
  if (!days) return [];
  try {
    const parsed = JSON.parse(days);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ExportPage() {
  const { plans, loaded } = usePlans();
  const { audit } = useAudit();
  const [activeSlot, setActiveSlot] = useState<Slot>("A");
  const [exported, setExported] = useState(false);
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [courseMap, setCourseMap] = useState<Record<number, CourseDTO>>({});
  const { show } = useToast();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleTabKey(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    const next = cycleIndex(idx, e.key, SLOTS.length, "horizontal");
    if (next === null) return;
    e.preventDefault();
    switchSlot(SLOTS[next]);
    tabRefs.current[next]?.focus();
  }

  const slotEntries = useMemo(
    () => plans.filter((p) => p.planSlot === activeSlot),
    [plans, activeSlot],
  );

  const idsKey = useMemo(
    () => [...new Set(slotEntries.map((p) => p.courseId))]
      .sort((a, b) => a - b)
      .join(","),
    [slotEntries],
  );

  useEffect(() => {
    if (!loaded || !idsKey) return;
    const controller = new AbortController();
    const ids = idsKey.split(",").map((n) => parseInt(n, 10));
    const missing = ids.filter((id) => !courseMap[id]);
    if (missing.length === 0) return;
    fetchCoursesReport(missing, controller.signal).then((report) => {
      setCourseMap((prev) => ({
        ...prev,
        ...toCourseMap(report.data),
      }));
      if (report.failures.length > 0) {
        const reasons = new Set(report.failures.map((f) => f.reason));
        const hint = reasons.has("network")
          ? "Network error while loading course data"
          : reasons.has("http")
            ? "Course data server error"
            : reasons.has("shape")
              ? "Course data shape changed unexpectedly"
              : "Could not load all course data";
        show(`${hint} (${report.failures.length} missing)`, {
          variant: "warning",
        });
      }
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, idsKey]);

  // Prune cached course data once plans no longer reference it.
  useEffect(() => {
    const referenced = new Set(slotEntries.map((p) => p.courseId));
    setCourseMap((prev) => {
      let changed = false;
      const next: typeof prev = {};
      for (const [key, value] of Object.entries(prev)) {
        const id = Number(key);
        if (referenced.has(id)) next[id] = value;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [slotEntries]);

  const items: ExportItem[] = useMemo(() => {
    const out: ExportItem[] = [];
    const allCourses = audit
      ? [...audit.completedCourses, ...audit.inProgressCourses]
      : [];
    for (const entry of slotEntries) {
      const course = courseMap[entry.courseId];
      if (!course) continue;
      const status = computeEligibility(
        course.subject,
        course.courseNumber,
        course.registrationRestrictions,
        course.sections,
        allCourses,
        !!audit,
      );
      const blocked = !isRegisterable(status);
      out.push({
        course,
        sectionId: entry.sectionId,
        status,
        result: blocked ? "blocked" : "transferred",
        reason: registrationBlockedReason(status) ?? undefined,
      });
    }
    return out;
  }, [slotEntries, courseMap, audit]);

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const events: CalendarEvent[] = [];
    for (const entry of slotEntries) {
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
          color: PLAN_COLORS[activeSlot],
        });
      }
    }
    return events;
  }, [slotEntries, courseMap, activeSlot]);

  function switchSlot(slot: Slot) {
    setActiveSlot(slot);
    setExported(false);
    setShowPreCheck(false);
  }

  const transferred = items.filter((i) => i.result === "transferred");
  const blocked = items.filter((i) => i.result === "blocked");
  const allSuccess = blocked.length === 0 && transferred.length > 0;

  const planTabs = (
    <div className="flex gap-2 mb-6" role="tablist" aria-label="Plan slots">
      {SLOTS.map((slot, idx) => {
        const count = plans.filter((p) => p.planSlot === slot).length;
        const isActive = activeSlot === slot;
        return (
          <button
            key={slot}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            tabIndex={isActive ? 0 : -1}
            aria-selected={isActive}
            onClick={() => switchSlot(slot)}
            onKeyDown={(e) => handleTabKey(e, idx)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive ? "text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            style={isActive ? { backgroundColor: PLAN_COLORS[slot] } : undefined}
          >
            Plan {slot} ({count})
          </button>
        );
      })}
    </div>
  );

  const currentStep: 1 | 2 | 3 = exported ? 3 : showPreCheck ? 2 : 1;
  const stepLabels: Record<1 | 2 | 3, string> = {
    1: "Review",
    2: "Pre-check",
    3: "Results",
  };
  const stepper = (
    <ol
      className="flex items-center gap-2 mb-6"
      aria-label="Export progress"
    >
      {([1, 2, 3] as const).map((n, idx) => {
        const isDone = n < currentStep;
        const isCurrent = n === currentStep;
        return (
          <li
            key={n}
            className="flex items-center gap-2"
            aria-current={isCurrent ? "step" : undefined}
          >
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border ${
                isDone
                  ? "bg-[#1B6B3A] text-white border-[#1B6B3A]"
                  : isCurrent
                    ? "bg-white text-[#1B6B3A] border-[#1B6B3A]"
                    : "bg-white text-gray-500 border-gray-300"
              }`}
              aria-hidden="true"
            >
              {isDone ? "✓" : n}
            </span>
            <span
              className={`text-sm ${
                isCurrent
                  ? "font-semibold text-gray-900"
                  : isDone
                    ? "text-gray-700"
                    : "text-gray-500"
              }`}
            >
              Step {n}: {stepLabels[n]}
            </span>
            {idx < 2 && (
              <span aria-hidden="true" className="text-gray-300 mx-2">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );

  if (!exported && !showPreCheck) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Export to NOVO</h1>
        {stepper}
        {planTabs}
        {slotEntries.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-700">
              No courses in Plan {activeSlot} to export.
            </p>
            <Link
              href="/search"
              className="text-[#1B6B3A] font-medium text-sm hover:underline mt-2 inline-block"
            >
              Search for courses
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-700 mb-4">
              Review your Plan {activeSlot} courses below. When ready, run the
              pre-check to see which courses are eligible to transfer to NOVO.
            </p>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-700">
                      Course
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">
                      Section
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const section = item.course.sections.find(
                      (s) => s.id === item.sectionId,
                    );
                    return (
                      <tr
                        key={item.sectionId}
                        className="border-b border-gray-100"
                      >
                        <td className="px-4 py-3 font-medium">
                          {item.course.subject} {item.course.courseNumber}
                          <div className="text-xs text-gray-500 font-normal">
                            {item.course.courseTitle}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {section?.sectionNumber ?? "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setShowPreCheck(true)}
              className="text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              style={{ backgroundColor: PLAN_COLORS[activeSlot] }}
            >
              Run Pre-check
            </button>
          </>
        )}
      </div>
    );
  }

  if (showPreCheck && !exported) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-xl font-bold text-gray-900 mb-4">
          Export to NOVO
        </h1>
        {stepper}
        {planTabs}
        <p className="text-sm text-gray-700 mb-4">
          Pre-check diagnostics for Plan {activeSlot}. Each course was checked
          against your audit, prerequisites, seat availability, and time
          conflicts.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Course
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Diagnosis
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.sectionId} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium">
                    {item.course.subject} {item.course.courseNumber}
                    <div className="text-xs text-gray-500 font-normal">
                      {item.course.courseTitle}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <EligibilityBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {item.result === "transferred"
                      ? "Ready to export"
                      : item.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className={`rounded-lg p-4 mb-6 ${
            allSuccess
              ? "bg-green-50 border border-green-200"
              : "bg-yellow-50 border border-yellow-200"
          }`}
          role="status"
        >
          <div
            className={`text-sm font-semibold ${
              allSuccess ? "text-green-900" : "text-yellow-900"
            }`}
          >
            {allSuccess
              ? `All ${transferred.length} courses eligible`
              : `${transferred.length} of ${items.length} eligible — ${blocked.length} blocked`}
          </div>
        </div>

        <div className="flex gap-3">
          {allSuccess ? (
            <button
              type="button"
              onClick={() => setExported(true)}
              className="text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              style={{ backgroundColor: PLAN_COLORS[activeSlot] }}
            >
              Export to NOVO
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExported(true)}
              className="bg-yellow-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-yellow-700 transition-colors"
            >
              Export Eligible Only ({transferred.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPreCheck(false)}
            className="bg-gray-100 text-gray-800 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Back to Review
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">
        Export to NOVO
      </h1>
      {stepper}
      {planTabs}

      <div className="grid grid-cols-[1fr_280px] gap-6">
        <div>
          {allSuccess ? (
            <div
              className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6"
              role="status"
            >
              <div className="font-semibold text-green-900">
                All courses transferred successfully
              </div>
              <p className="text-sm text-green-800 mt-1">
                Confirm your schedule in NOVO to complete registration.
              </p>
            </div>
          ) : (
            <div
              className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6"
              role="status"
            >
              <div className="font-semibold text-yellow-900">
                Partial export: {transferred.length} of {items.length} courses
                transferred
              </div>
              <p className="text-sm text-yellow-800 mt-1">
                Some courses could not be transferred. See details below.
              </p>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">
                    Course
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">
                    Result
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">
                    Next Steps
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.sectionId} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium">
                      {item.course.subject} {item.course.courseNumber}
                      <div className="text-xs text-gray-500 font-normal">
                        {item.course.courseTitle}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.result === "transferred" ? (
                        <span className="inline-flex items-center gap-1 text-green-800 font-medium">
                          <span aria-hidden="true">✓</span> Transferred
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                          <span aria-hidden="true">✗</span> Not Transferred
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {item.result === "transferred" ? (
                        <span className="text-gray-700">Confirm in NOVO</span>
                      ) : (
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              show(
                                "Waitlist request submitted via NOVO (demo)",
                                { trackUnread: false },
                              )
                            }
                            className="bg-gray-100 text-gray-800 px-2 py-1 rounded font-medium hover:bg-gray-200 transition-colors"
                          >
                            Join Waitlist
                          </button>
                          <Link
                            href={`/course/${item.course.id}`}
                            className="bg-gray-100 text-gray-800 px-2 py-1 rounded font-medium hover:bg-gray-200 transition-colors"
                          >
                            Request Override
                          </Link>
                          <Link
                            href={`/search?subject=${item.course.subject}`}
                            className="bg-gray-100 text-gray-800 px-2 py-1 rounded font-medium hover:bg-gray-200 transition-colors"
                          >
                            Find Alternative
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Link
              href="/plan"
              className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Back to Plan
            </Link>
            <Link
              href="/search"
              className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Search More Courses
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-2">
            Weekly Schedule
          </h2>
          <WeeklyCalendar
            events={calendarEvents}
            compact
            emptyMessage={`No courses in Plan ${activeSlot} yet.`}
          />
        </div>
      </div>
    </div>
  );
}
