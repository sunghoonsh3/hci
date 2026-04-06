"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePlans } from "@/contexts/PlansContext";
import { useAudit } from "@/contexts/AuditContext";
import { computeEligibility } from "@/lib/eligibility";
import EligibilityBadge from "@/components/EligibilityBadge";
import type { EligibilityStatus } from "@/types";

interface CourseData {
  id: number;
  subject: string;
  courseNumber: string;
  courseTitle: string;
  registrationRestrictions: string | null;
  sections: {
    id: number;
    seatsAvailable: number | null;
    specialApproval: string | null;
  }[];
}

interface ExportItem {
  course: CourseData;
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

export default function ExportPage() {
  const { plans, loaded } = usePlans();
  const { audit } = useAudit();
  const [activeSlot, setActiveSlot] = useState<Slot>("A");
  const [items, setItems] = useState<ExportItem[]>([]);
  const [exported, setExported] = useState(false);
  const [showPreCheck, setShowPreCheck] = useState(false);

  const slotEntries = plans.filter((p) => p.planSlot === activeSlot);

  // Reset state when switching plans
  function switchSlot(slot: Slot) {
    setActiveSlot(slot);
    setItems([]);
    setExported(false);
    setShowPreCheck(false);
  }

  // Fetch course data and run diagnostics
  useEffect(() => {
    if (!loaded || slotEntries.length === 0) {
      setItems([]);
      return;
    }

    Promise.all(
      slotEntries.map((entry) =>
        fetch(`/api/course/${entry.courseId}`)
          .then((r) => r.json())
          .then((course: CourseData) => {
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
            const blocked =
              status === "full" ||
              status === "needs-prereq" ||
              status === "restricted" ||
              status === "already-taken";
            return {
              course,
              sectionId: entry.sectionId,
              status,
              result: blocked ? "blocked" : "transferred",
              reason: blocked
                ? status === "full"
                  ? "Section full"
                  : status === "needs-prereq"
                  ? "Missing prerequisites"
                  : status === "restricted"
                  ? "Special approval required"
                  : "Already taken"
                : undefined,
            } as ExportItem;
          })
          .catch(() => null)
      )
    ).then((results) => {
      setItems(results.filter(Boolean) as ExportItem[]);
    });
  }, [loaded, plans, audit, activeSlot]);

  const transferred = items.filter((i) => i.result === "transferred");
  const blocked = items.filter((i) => i.result === "blocked");
  const allSuccess = blocked.length === 0 && transferred.length > 0;

  // Plan tabs — shared across all views
  const planTabs = (
    <div className="flex gap-2 mb-6">
      {(["A", "B", "C"] as Slot[]).map((slot) => {
        const count = plans.filter((p) => p.planSlot === slot).length;
        return (
          <button
            key={slot}
            onClick={() => switchSlot(slot)}
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
    </div>
  );

  if (!exported && !showPreCheck) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-xl font-bold text-gray-900 mb-4">
          Export to NOVO
        </h1>

        {planTabs}

        {slotEntries.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No courses in Plan {activeSlot} to export.</p>
            <Link
              href="/search"
              className="text-[#1B6B3A] font-medium text-sm hover:underline mt-2 inline-block"
            >
              Search for courses
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-6">
              Review your Plan {activeSlot} courses before exporting to NOVO registration.
            </p>
            <button
              onClick={() => setShowPreCheck(true)}
              className="text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              style={{ backgroundColor: PLAN_COLORS[activeSlot] }}
            >
              Run Pre-check & Export
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
          Export Pre-check — Plan {activeSlot}
        </h1>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Course
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Diagnosis
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.sectionId}
                  className="border-b border-gray-100"
                >
                  <td className="px-4 py-3 font-medium">
                    {item.course.subject} {item.course.courseNumber}
                    <div className="text-xs text-gray-400 font-normal">
                      {item.course.courseTitle}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <EligibilityBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {item.result === "transferred"
                      ? "Ready to export"
                      : item.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className={`rounded-lg p-4 mb-6 ${
          allSuccess
            ? "bg-green-50 border border-green-200"
            : "bg-yellow-50 border border-yellow-200"
        }`}>
          <div className={`text-sm font-semibold ${allSuccess ? "text-green-800" : "text-yellow-800"}`}>
            {allSuccess
              ? `All ${transferred.length} courses eligible`
              : `${transferred.length} of ${items.length} eligible — ${blocked.length} blocked`}
          </div>
        </div>

        <div className="flex gap-3">
          {allSuccess ? (
            <button
              onClick={() => setExported(true)}
              className="text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              style={{ backgroundColor: PLAN_COLORS[activeSlot] }}
            >
              Export All
            </button>
          ) : (
            <button
              onClick={() => setExported(true)}
              className="bg-yellow-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-yellow-700 transition-colors"
            >
              Export Eligible Only ({transferred.length})
            </button>
          )}
          <button
            onClick={() => setShowPreCheck(false)}
            className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // Export results
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">
        Export to NOVO — Plan {activeSlot} Results
      </h1>

      {allSuccess ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="font-semibold text-green-800">
            All courses transferred successfully
          </div>
          <p className="text-sm text-green-600 mt-1">
            Confirm your schedule in NOVO to complete registration.
          </p>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="font-semibold text-yellow-800">
            Partial export: {transferred.length} of {items.length} courses
            transferred
          </div>
          <p className="text-sm text-yellow-600 mt-1">
            Some courses could not be transferred. See details below.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Course
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Result
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Next Steps
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.sectionId} className="border-b border-gray-100">
                <td className="px-4 py-3 font-medium">
                  {item.course.subject} {item.course.courseNumber}
                  <div className="text-xs text-gray-400 font-normal">
                    {item.course.courseTitle}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {item.result === "transferred" ? (
                    <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                      <span>✓</span> Transferred
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                      <span>✗</span> Not Transferred
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {item.result === "transferred" ? (
                    <span className="text-gray-500">Confirm in NOVO</span>
                  ) : (
                    <Link
                      href={`/course/${item.course.id}`}
                      className="text-[#1B6B3A] font-medium hover:underline"
                    >
                      View Options
                    </Link>
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
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Back to Plan
        </Link>
        <Link
          href="/search"
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Search More Courses
        </Link>
      </div>
    </div>
  );
}
