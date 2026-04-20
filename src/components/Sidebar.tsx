"use client";

import Link from "next/link";
import { useAudit } from "@/contexts/AuditContext";
import { usePlans } from "@/contexts/PlansContext";
import { fetchCourse } from "@/lib/fetchCourse";
import { cycleIndex } from "@/hooks/useRovingTabIndex";
import type { PlanSlot } from "@/types";
import { useState, useEffect, useRef, type KeyboardEvent } from "react";

const SLOTS: PlanSlot[] = ["A", "B", "C"];

type CourseName = { subject: string; courseNumber: string };

export default function Sidebar() {
  const { audit } = useAudit();
  const { plans, removeFromPlan } = usePlans();
  const [activeSlot, setActiveSlot] = useState<PlanSlot>("A");
  const [courseNames, setCourseNames] = useState<Record<number, CourseName>>(
    {},
  );
  const inFlight = useRef<Set<number>>(new Set());

  const slotEntries = plans.filter((p) => p.planSlot === activeSlot);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleTabKey(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    const next = cycleIndex(idx, e.key, SLOTS.length, "horizontal");
    if (next === null) return;
    e.preventDefault();
    setActiveSlot(SLOTS[next]);
    tabRefs.current[next]?.focus();
  }

  useEffect(() => {
    const controller = new AbortController();
    const uniqueIds = [...new Set(plans.map((p) => p.courseId))];
    const toFetch = uniqueIds.filter(
      (id) => !courseNames[id] && !inFlight.current.has(id),
    );
    if (toFetch.length === 0) return;

    for (const id of toFetch) inFlight.current.add(id);

    Promise.all(
      toFetch.map(async (id) => {
        const course = await fetchCourse(id, controller.signal);
        return course
          ? { id, subject: course.subject, courseNumber: course.courseNumber }
          : null;
      }),
    ).then((results) => {
      setCourseNames((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r.id] = { subject: r.subject, courseNumber: r.courseNumber };
        }
        return next;
      });
      for (const id of toFetch) inFlight.current.delete(id);
    });

    const inFlightRef = inFlight.current;
    return () => {
      controller.abort();
      for (const id of toFetch) inFlightRef.delete(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  // Prune cached names that are no longer referenced by any plan entry.
  useEffect(() => {
    const referenced = new Set(plans.map((p) => p.courseId));
    setCourseNames((prev) => {
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

  const majorCredits = audit
    ? audit.completedCourses
        .filter((c) => c.subject === "CSE")
        .reduce((s, c) => s + c.credits, 0)
    : 0;

  return (
    <aside
      aria-label="Plans and progress"
      className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto shrink-0"
    >
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-xs text-gray-600 uppercase tracking-wide font-medium">
          Term
        </div>
        <div className="text-sm font-semibold mt-1">Summer 2026</div>
      </div>

      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-2">
          My Plans
        </div>
        <div className="flex gap-1 mb-2" role="tablist" aria-label="Plan slots">
          {SLOTS.map((slot, idx) => {
            const count = plans.filter((p) => p.planSlot === slot).length;
            const isActive = activeSlot === slot;
            return (
              <button
                key={slot}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                role="tab"
                tabIndex={isActive ? 0 : -1}
                aria-selected={isActive}
                aria-controls={`plan-panel-${slot}`}
                onClick={() => setActiveSlot(slot)}
                onKeyDown={(e) => handleTabKey(e, idx)}
                className={`flex-1 text-xs font-medium py-1.5 rounded transition-colors ${
                  isActive
                    ? "bg-[#0C2340] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Plan {slot} ({count})
              </button>
            );
          })}
        </div>
        <div id={`plan-panel-${activeSlot}`} role="tabpanel">
          {slotEntries.length === 0 ? (
            <p className="text-xs text-gray-500 italic">
              No courses in Plan {activeSlot}
            </p>
          ) : (
            <ul className="space-y-1">
              {slotEntries.map((entry) => {
                const name = courseNames[entry.courseId];
                const label = name
                  ? `${name.subject} ${name.courseNumber}`
                  : `Course #${entry.courseId}`;
                return (
                  <li
                    key={`${entry.sectionId}-${entry.planSlot}`}
                    className="text-xs bg-gray-50 rounded px-2 py-1.5 flex justify-between items-center"
                  >
                    <Link
                      href={`/course/${entry.courseId}`}
                      className="text-[#0C2340] font-medium hover:underline truncate"
                    >
                      {label}
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        removeFromPlan(entry.sectionId, activeSlot)
                      }
                      aria-label={`Remove ${label} from Plan ${activeSlot}`}
                      className="text-gray-500 hover:text-red-600 ml-2 shrink-0"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {audit && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 uppercase tracking-wide font-medium">
              Progress
            </span>
            <span className="text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full font-medium">
              On Track
            </span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs text-gray-700 mb-1">
                <span>Credits</span>
                <span>
                  {audit.creditsApplied}/{audit.creditsRequired}
                </span>
              </div>
              <div
                className="h-2 bg-gray-100 rounded-full overflow-hidden"
                role="progressbar"
                aria-label="Credits progress"
                aria-valuemin={0}
                aria-valuemax={audit.creditsRequired}
                aria-valuenow={audit.creditsApplied}
              >
                <div
                  className="h-full bg-[#1B6B3A] rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      (audit.creditsApplied / audit.creditsRequired) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-700 mb-1">
                <span>Major (CS)</span>
                <span>{majorCredits}/42</span>
              </div>
              <div
                className="h-2 bg-gray-100 rounded-full overflow-hidden"
                role="progressbar"
                aria-label="Major credits progress"
                aria-valuemin={0}
                aria-valuemax={42}
                aria-valuenow={majorCredits}
              >
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{
                    width: `${Math.min(100, (majorCredits / 42) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-700 mb-1">
                <span>Degree</span>
                <span>{audit.degreeProgress}%</span>
              </div>
              <div
                className="h-2 bg-gray-100 rounded-full overflow-hidden"
                role="progressbar"
                aria-label="Degree progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={audit.degreeProgress}
              >
                <div
                  className="h-full bg-[#1B6B3A] rounded-full"
                  style={{ width: `${audit.degreeProgress}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-gray-600">
              GPA: {audit.gpa.toFixed(3)} | {audit.classification}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-3">
        <div className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-2">
          My GPS
        </div>
        {audit ? (
          <div className="text-xs text-gray-700">
            <div className="font-medium">{audit.major}</div>
            <div className="text-gray-500 mt-0.5">{audit.college}</div>
            <Link
              href="/onboarding"
              className="text-[#1B6B3A] hover:underline mt-1 inline-block"
            >
              Retrieve What-if Audit
            </Link>
          </div>
        ) : (
          <Link
            href="/onboarding"
            className="flex items-center gap-2 text-xs bg-[#1B6B3A]/10 text-[#1B6B3A] font-medium px-3 py-2 rounded-lg hover:bg-[#1B6B3A]/20 transition-colors"
          >
            Import Degree Audit
          </Link>
        )}
      </div>
    </aside>
  );
}
