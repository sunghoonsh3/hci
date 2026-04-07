"use client";

import Link from "next/link";
import { useAudit } from "@/contexts/AuditContext";
import { usePlans } from "@/contexts/PlansContext";
import type { PlanSlot } from "@/types";
import { useState, useEffect } from "react";

export default function Sidebar() {
  const { audit } = useAudit();
  const { plans, removeFromPlan } = usePlans();
  const [activeSlot, setActiveSlot] = useState<PlanSlot>("A");
  const [courseNames, setCourseNames] = useState<
    Record<number, { subject: string; courseNumber: string }>
  >({});

  const slotEntries = plans.filter((p) => p.planSlot === activeSlot);

  // Fetch course names for plan entries
  useEffect(() => {
    const ids = [...new Set(plans.map((p) => p.courseId))];
    const missing = ids.filter((id) => !courseNames[id]);
    if (missing.length === 0) return;

    Promise.all(
      missing.map((id) =>
        fetch(`/api/course/${id}`)
          .then((r) => r.json())
          .then((c) => ({
            id,
            subject: c.subject as string,
            courseNumber: c.courseNumber as string,
          }))
          .catch(() => null)
      )
    ).then((results) => {
      setCourseNames((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r.id] = { subject: r.subject, courseNumber: r.courseNumber };
        }
        return next;
      });
    });
  }, [plans, courseNames]);

  // Compute major credits for progress
  const majorCredits = audit
    ? audit.completedCourses
        .filter((c) => c.subject === "CSE")
        .reduce((s, c) => s + c.credits, 0)
    : 0;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto shrink-0">
      {/* Term */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">
          Term
        </div>
        <div className="text-sm font-semibold mt-1">Summer 2026</div>
      </div>

      {/* My Plans */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
          My Plans
        </div>
        <div className="flex gap-1 mb-2">
          {(["A", "B", "C"] as PlanSlot[]).map((slot) => {
            const count = plans.filter((p) => p.planSlot === slot).length;
            return (
              <button
                key={slot}
                onClick={() => setActiveSlot(slot)}
                className={`flex-1 text-xs font-medium py-1.5 rounded transition-colors ${
                  activeSlot === slot
                    ? "bg-[#0C2340] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Plan {slot} ({count})
              </button>
            );
          })}
        </div>
        {slotEntries.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            No courses in Plan {activeSlot}
          </p>
        ) : (
          <ul className="space-y-1">
            {slotEntries.map((entry) => {
              const name = courseNames[entry.courseId];
              return (
                <li
                  key={entry.sectionId}
                  className="text-xs bg-gray-50 rounded px-2 py-1.5 flex justify-between items-center"
                >
                  <Link
                    href={`/course/${entry.courseId}`}
                    className="text-[#0C2340] font-medium hover:underline truncate"
                  >
                    {name
                      ? `${name.subject} ${name.courseNumber}`
                      : `Course #${entry.courseId}`}
                  </Link>
                  <button
                    onClick={() => removeFromPlan(entry.sectionId, activeSlot)}
                    className="text-gray-400 hover:text-red-500 ml-2 shrink-0"
                    title="Remove"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Progress */}
      {audit && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Progress
            </span>
            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
              On Track
            </span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Credits</span>
                <span>
                  {audit.creditsApplied}/{audit.creditsRequired}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1B6B3A] rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      (audit.creditsApplied / audit.creditsRequired) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Major (CS)</span>
                <span>{majorCredits}/42</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${Math.min(100, (majorCredits / 42) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Degree</span>
                <span>{audit.degreeProgress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1B6B3A] rounded-full"
                  style={{ width: `${audit.degreeProgress}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-gray-500">
              GPA: {audit.gpa.toFixed(3)} | {audit.classification}
            </div>
          </div>
        </div>
      )}

      {/* GPS Widget */}
      <div className="px-4 py-3">
        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
          My GPS
        </div>
        {audit ? (
          <div className="text-xs text-gray-600">
            <div className="font-medium">{audit.major}</div>
            <div className="text-gray-400 mt-0.5">{audit.college}</div>
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
