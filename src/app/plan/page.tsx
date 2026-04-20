"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cycleIndex } from "@/hooks/useRovingTabIndex";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlans } from "@/contexts/PlansContext";
import { useAudit } from "@/contexts/AuditContext";
import { getRequirementBadges } from "@/lib/requirements";
import { computeEligibility } from "@/lib/eligibility";
import { fetchCourses, toCourseMap } from "@/lib/fetchCourse";
import { useToast } from "@/contexts/ToastContext";
import type { CourseDTO } from "@/lib/schemas";
import EligibilityBadge from "@/components/EligibilityBadge";
import WeeklyCalendar, {
  type CalendarEvent,
} from "@/components/WeeklyCalendar";
import type { PlanSlot } from "@/types";

function RowMenu({
  sectionId,
  courseLabel,
  currentSlot,
  onMove,
  onRemove,
}: {
  sectionId: number;
  courseLabel: string;
  currentSlot: PlanSlot;
  onMove: (sectionId: number, from: PlanSlot, to: PlanSlot) => void;
  onRemove: (sectionId: number, slot: PlanSlot) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const otherSlots = (["A", "B", "C"] as PlanSlot[]).filter(
    (s) => s !== currentSlot,
  );
  const itemCount = otherSlots.length + 1; // + Remove

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    itemRefs.current[0]?.focus();
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function handleMenuKey(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    const next = cycleIndex(idx, e.key, itemCount, "vertical");
    if (next === null) return;
    e.preventDefault();
    itemRefs.current[next]?.focus();
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${courseLabel}`}
        className="text-gray-500 hover:text-gray-800 p-1.5 rounded hover:bg-gray-100 transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${courseLabel}`}
          className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 w-40"
        >
          {otherSlots.map((slot, idx) => (
            <button
              key={slot}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              role="menuitem"
              type="button"
              onClick={() => {
                onMove(sectionId, currentSlot, slot);
                setOpen(false);
              }}
              onKeyDown={(e) => handleMenuKey(e, idx)}
              className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 transition-colors"
            >
              Move to Plan {slot}
            </button>
          ))}
          <div className="border-t border-gray-100 my-1" />
          <button
            ref={(el) => {
              itemRefs.current[otherSlots.length] = el;
            }}
            role="menuitem"
            type="button"
            onClick={() => {
              onRemove(sectionId, currentSlot);
              setOpen(false);
            }}
            onKeyDown={(e) => handleMenuKey(e, otherSlots.length)}
            className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

const PLAN_COLORS: Record<PlanSlot, string> = {
  A: "#1B6B3A",
  B: "#2563eb",
  C: "#6b7280",
};

const SLOTS: PlanSlot[] = ["A", "B", "C"];

function parseDays(days: string | null): string[] {
  if (!days) return [];
  try {
    const parsed = JSON.parse(days);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function PlanPage() {
  const router = useRouter();
  const { plans, removeFromPlan, moveToPlan, addToPlan, loaded } = usePlans();
  const { audit } = useAudit();
  const [activeSlot, setActiveSlot] = useState<PlanSlot>("A");
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [courseDataMap, setCourseDataMap] = useState<
    Record<number, CourseDTO>
  >({});
  const [highlightedSection, setHighlightedSection] = useState<number | null>(
    null,
  );
  const { show } = useToast();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleTabKey(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    const next = cycleIndex(idx, e.key, SLOTS.length, "horizontal");
    if (next === null) return;
    e.preventDefault();
    setActiveSlot(SLOTS[next]);
    tabRefs.current[next]?.focus();
  }

  const planIdsKey = useMemo(
    () => [...new Set(plans.map((p) => p.courseId))].sort((a, b) => a - b).join(","),
    [plans],
  );

  useEffect(() => {
    if (!loaded) return;
    if (!planIdsKey) {
      setCourseDataMap({});
      return;
    }
    const ids = planIdsKey.split(",").map((n) => parseInt(n, 10));
    const controller = new AbortController();
    const missing = ids.filter((id) => !courseDataMap[id]);
    if (missing.length === 0) return;
    fetchCourses(missing, controller.signal).then((results) => {
      setCourseDataMap((prev) => ({ ...prev, ...toCourseMap(results) }));
    });
    return () => controller.abort();
    // courseDataMap intentionally excluded; planIdsKey is stable for plans
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, planIdsKey]);

  // Prune cached course data for ids no longer referenced by any plan entry.
  useEffect(() => {
    const referenced = new Set(plans.map((p) => p.courseId));
    setCourseDataMap((prev) => {
      let changed = false;
      const next: typeof prev = {};
      for (const [key, value] of Object.entries(prev)) {
        const id = Number(key);
        if (referenced.has(id)) next[id] = value;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [plans]);

  const slotEntries = plans.filter((p) => p.planSlot === activeSlot);

  const calendarEntries = showAllPlans ? plans : slotEntries;
  const events: CalendarEvent[] = [];
  for (const entry of calendarEntries) {
    const course = courseDataMap[entry.courseId];
    if (!course) continue;
    const section = course.sections.find((s) => s.id === entry.sectionId);
    if (!section) continue;
    for (const meeting of section.meetings) {
      if (!meeting.startTime || !meeting.endTime) continue;
      const days = parseDays(meeting.days);
      if (days.length === 0) continue;
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

  const totalCredits = slotEntries.reduce((sum, entry) => {
    const c = courseDataMap[entry.courseId];
    return sum + (c?.creditHoursMin ?? 0);
  }, 0);

  const handleRemove = useCallback(
    (sectionId: number, slot: PlanSlot) => {
      const entry = plans.find(
        (p) => p.sectionId === sectionId && p.planSlot === slot,
      );
      if (!entry) return;
      const course = courseDataMap[entry.courseId];
      const label = course
        ? `${course.subject} ${course.courseNumber}`
        : "Course";
      removeFromPlan(sectionId, slot);
      show(`Removed ${label} from Plan ${slot}`, {
        undo: () => addToPlan(entry.courseId, sectionId, slot),
      });
    },
    [plans, courseDataMap, removeFromPlan, addToPlan, show],
  );

  const handleMove = useCallback(
    (sectionId: number, from: PlanSlot, to: PlanSlot) => {
      moveToPlan(sectionId, from, to);
      const entry = plans.find(
        (p) => p.sectionId === sectionId && p.planSlot === from,
      );
      const course = entry ? courseDataMap[entry.courseId] : null;
      const label = course
        ? `${course.subject} ${course.courseNumber}`
        : "Course";
      show(`Moved ${label} to Plan ${to}`, {
        undo: () => moveToPlan(sectionId, to, from),
      });
    },
    [plans, courseDataMap, moveToPlan, show],
  );

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

      <div
        className="flex gap-2 mb-4"
        role="tablist"
        aria-label="Plan slots"
      >
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
              onClick={() => setActiveSlot(slot)}
              onKeyDown={(e) => handleTabKey(e, idx)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              style={isActive ? { backgroundColor: PLAN_COLORS[slot] } : undefined}
            >
              Plan {slot} ({count})
            </button>
          );
        })}
        <label className="flex items-center gap-2 ml-4 text-sm text-gray-700">
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
        <div>
          {slotEntries.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-700">
                No courses in Plan {activeSlot}.
              </p>
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
                    <th className="text-left px-4 py-3 font-medium text-gray-700">
                      Course
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">
                      Title
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">
                      Credits
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">
                      Status
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
                  {slotEntries.map((entry) => {
                    const course = courseDataMap[entry.courseId];
                    const section = course?.sections.find(
                      (s) => s.id === entry.sectionId,
                    );
                    const label = course
                      ? `${course.subject} ${course.courseNumber}`
                      : `Course #${entry.courseId}`;
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
                            <span className="text-gray-500">Loading…</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {course ? (
                            <Link
                              href={`/course/${course.id}`}
                              className="text-gray-800 hover:underline block"
                            >
                              {course.courseTitle}
                            </Link>
                          ) : (
                            <span className="text-gray-500">…</span>
                          )}
                          <span className="text-xs text-gray-500">
                            {section
                              ? `Sec ${section.sectionNumber ?? "-"}`
                              : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
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
                                  : [],
                              )}
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {course ? (
                            <div className="flex gap-1 flex-wrap">
                              {getRequirementBadges(
                                course.subject,
                                course.courseNumber,
                              ).map((b) => (
                                <span
                                  key={b}
                                  className="inline-flex items-center rounded-full bg-blue-50 text-blue-800 px-2 py-0.5 text-xs font-medium"
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
                              type="button"
                              onClick={() =>
                                handleRemove(entry.sectionId, activeSlot)
                              }
                              aria-label={`Remove ${label} from Plan ${activeSlot}`}
                              className="text-red-700 hover:text-red-900 font-medium hover:underline"
                            >
                              Remove
                            </button>
                            {course && (
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(`/course/${course.id}`)
                                }
                                className="text-gray-700 hover:text-gray-900 font-medium hover:underline"
                              >
                                Options
                              </button>
                            )}
                            <RowMenu
                              sectionId={entry.sectionId}
                              courseLabel={label}
                              currentSlot={activeSlot}
                              onMove={handleMove}
                              onRemove={handleRemove}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-gray-50 text-sm text-gray-700 border-t border-gray-200">
                Total: {totalCredits} credits · {slotEntries.length} course
                {slotEntries.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-2">
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
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: "#1B6B3A" }}
                  aria-hidden="true"
                />
                <span>Plan A</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: "#2563eb" }}
                  aria-hidden="true"
                />
                <span>Plan B</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: "#6b7280" }}
                  aria-hidden="true"
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
