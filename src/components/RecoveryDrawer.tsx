"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlans } from "@/contexts/PlansContext";
import { useToast } from "@/contexts/ToastContext";
import { useAudit } from "@/contexts/AuditContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { deriveName, formatStudentSelfDescription } from "@/lib/persona";
import type { PlanSlot } from "@/types";

interface Course {
  id: number;
  subject: string;
  courseNumber: string;
  courseTitle: string;
  sections: {
    id: number;
    sectionNumber: string | null;
    seatsAvailable: number | null;
    maxEnrollment: number | null;
    specialApproval: string | null;
    meetings: {
      days: string | null;
      startTime: string | null;
      endTime: string | null;
    }[];
    instructors: { name: string }[];
  }[];
}

const ALL_SLOTS: PlanSlot[] = ["A", "B", "C"];

const PLAN_COLORS: Record<PlanSlot, string> = {
  A: "#1B6B3A",
  B: "#2563eb",
  C: "#6b7280",
};

function formatDays(daysJson: string | null): string {
  if (!daysJson) return "TBA";
  try {
    const parsed = JSON.parse(daysJson);
    if (!Array.isArray(parsed)) return "TBA";
    return parsed.join("");
  } catch {
    return "TBA";
  }
}

export default function RecoveryDrawer({
  course,
  onClose,
}: {
  course: Course;
  onClose: () => void;
}) {
  const router = useRouter();
  const {
    addToPlan,
    removeFromPlan,
    moveToPlan,
    findSlotsForCourse,
    findEntryInSlot,
  } = usePlans();
  const { show } = useToast();
  const { audit } = useAudit();
  const { display: signoffName } = deriveName(audit?.studentName);
  const selfDescription = formatStudentSelfDescription(audit);
  const [showSwap, setShowSwap] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [showPermission, setShowPermission] = useState(false);
  const [permissionSent, setPermissionSent] = useState(false);
  const [permissionTo, setPermissionTo] = useState(
    () =>
      `${course.sections[0]?.instructors[0]?.name ?? "Instructor"}@nd.edu`,
  );
  const [permissionSubject, setPermissionSubject] = useState(
    () => `Permission to enroll: ${course.subject} ${course.courseNumber}`,
  );
  const [permissionMessage, setPermissionMessage] = useState(
    () =>
      `Dear Professor,\n\nI am writing to request permission to enroll in ${course.subject} ${course.courseNumber}: ${course.courseTitle} for Summer 2026.\n\n${selfDescription} I believe this course aligns with my academic goals.\n\nThank you for your consideration.\n\nBest regards,\n${signoffName}`,
  );
  const sentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(drawerRef, { onEscape: onClose });

  useEffect(
    () => () => {
      if (sentTimerRef.current !== null) {
        clearTimeout(sentTimerRef.current);
      }
    },
    [],
  );

  const nameHint = {
    subject: course.subject,
    courseNumber: course.courseNumber,
    courseTitle: course.courseTitle,
  };

  const courseLabel = `${course.subject} ${course.courseNumber}`;

  const currentSlots = useMemo(
    () => findSlotsForCourse(course.id),
    [findSlotsForCourse, course.id],
  );
  const inAnyPlan = currentSlots.length > 0;
  const targetSlots = useMemo(
    () => ALL_SLOTS.filter((s) => !currentSlots.includes(s)),
    [currentSlots],
  );

  // (source, target) move pairs the user can take.
  const movePairs = useMemo(
    () =>
      currentSlots.flatMap((from) =>
        targetSlots.map((to) => ({ from, to })),
      ),
    [currentSlots, targetSlots],
  );

  function handleSwap(toSlot: PlanSlot, newSectionId: number) {
    const entry = findEntryInSlot(course.id, toSlot);
    if (!entry) return;
    if (entry.sectionId === newSectionId) {
      show(`${courseLabel} already uses that section in Plan ${toSlot}`, {
        variant: "warning",
      });
      onClose();
      return;
    }
    const oldSectionId = entry.sectionId;
    removeFromPlan(oldSectionId, toSlot);
    addToPlan(course.id, newSectionId, toSlot, nameHint);
    show(`${courseLabel} section swapped in Plan ${toSlot}`, {
      undo: () => {
        removeFromPlan(newSectionId, toSlot);
        addToPlan(course.id, oldSectionId, toSlot, nameHint);
      },
    });
    onClose();
  }

  function handleMove(fromSlot: PlanSlot, toSlot: PlanSlot) {
    const entry = findEntryInSlot(course.id, fromSlot);
    if (!entry) return;
    moveToPlan(entry.sectionId, fromSlot, toSlot);
    show(`${courseLabel} moved Plan ${fromSlot} → Plan ${toSlot}`, {
      undo: () => moveToPlan(entry.sectionId, toSlot, fromSlot),
    });
    onClose();
  }

  const planActionsAvailable = inAnyPlan;

  const options: {
    title: string;
    desc: string;
    action: () => void;
    icon: string;
    disabled?: boolean;
    disabledReason?: string;
    testId?: string;
  }[] = [
    {
      title: "Swap Section",
      desc: planActionsAvailable
        ? `Choose a different section within ${currentSlots.map((s) => `Plan ${s}`).join(" / ")}`
        : "Add this course to a plan first to swap sections",
      action: () => setShowSwap(true),
      icon: "↔",
      disabled: !planActionsAvailable,
      disabledReason: "Course is not in any plan yet",
      testId: "recovery-swap",
    },
    {
      title: "Find Alternatives",
      desc: `Search for other ${course.subject} courses`,
      action: () =>
        router.push(
          `/search?subject=${course.subject}&from=recovery&fromCourse=${course.id}`,
        ),
      icon: "🔍",
      testId: "recovery-find-alternatives",
    },
    {
      title:
        targetSlots.length === 0
          ? "Move Between Plans"
          : currentSlots.length === 0
            ? "Move to Another Plan"
            : `Move to ${targetSlots.map((s) => `Plan ${s}`).join(" or ")}`,
      desc: !planActionsAvailable
        ? "Add this course to a plan first to move it"
        : targetSlots.length === 0
          ? "Already in every plan"
          : "Reassign to a different plan slot",
      action: () => setShowMove(true),
      icon: "📋",
      disabled: !planActionsAvailable || targetSlots.length === 0,
      disabledReason: !planActionsAvailable
        ? "Course is not in any plan yet"
        : "Already in every plan",
      testId: "recovery-move",
    },
    {
      title: "Request Permission",
      desc: "Draft an override request email",
      action: () => setShowPermission(true),
      icon: "✉",
      testId: "recovery-request-permission",
    },
  ];

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-title"
    >
      <div
        className="fixed inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={drawerRef}
        className="relative bg-white rounded-t-xl shadow-2xl max-h-[70vh] overflow-y-auto"
        data-testid="recovery-drawer"
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 id="recovery-title" className="text-lg font-bold text-gray-900">
            Recovery Options
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close recovery options"
            className="text-gray-500 hover:text-gray-800 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {!planActionsAvailable && (
          <div className="mx-6 mt-4 px-4 py-2 rounded-lg text-xs bg-amber-50 text-amber-900 border border-amber-200">
            This course is blocked and not in any plan, so you can&apos;t swap
            sections or move it between plans. Try Find Alternatives or Request
            Permission instead.
          </div>
        )}

        {showSwap && planActionsAvailable && (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Swap Section &mdash; {course.subject} {course.courseNumber}
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Pick a section to use in{" "}
              {currentSlots.map((s) => `Plan ${s}`).join(" or ")}.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-700">
                    Sec
                  </th>
                  <th className="text-left py-2 font-medium text-gray-700">
                    Time
                  </th>
                  <th className="text-left py-2 font-medium text-gray-700">
                    Seats
                  </th>
                  <th className="text-right py-2 font-medium text-gray-700">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {course.sections.map((s) => {
                  const m = s.meetings[0];
                  const isFull =
                    s.seatsAvailable !== null && s.seatsAvailable <= 0;
                  const timeLabel = m
                    ? `${formatDays(m.days)} ${m.startTime ?? ""}-${m.endTime ?? ""}`
                    : "TBA";
                  return (
                    <tr key={s.id} className="border-b border-gray-100">
                      <td className="py-2">{s.sectionNumber ?? "-"}</td>
                      <td className="py-2">{timeLabel}</td>
                      <td className="py-2">
                        <span
                          className={isFull ? "text-red-700 font-medium" : ""}
                        >
                          {s.seatsAvailable ?? "?"}/{s.maxEnrollment ?? "?"}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {isFull ? (
                          <span className="text-xs text-red-700">Full</span>
                        ) : (
                          <div className="flex justify-end gap-1.5">
                            {currentSlots.map((slot) => {
                              const entry = findEntryInSlot(course.id, slot);
                              const isCurrent = entry?.sectionId === s.id;
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => handleSwap(slot, s.id)}
                                  aria-label={`Use section ${s.sectionNumber ?? s.id} in Plan ${slot}`}
                                  disabled={isCurrent}
                                  className="text-xs px-2.5 py-1 rounded font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                  style={{
                                    backgroundColor: PLAN_COLORS[slot],
                                  }}
                                >
                                  {isCurrent
                                    ? `✓ ${slot}`
                                    : currentSlots.length === 1
                                      ? "Select"
                                      : slot}
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
            <button
              type="button"
              onClick={() => setShowSwap(false)}
              className="mt-3 text-sm text-gray-700 hover:text-gray-900"
            >
              ← Back to options
            </button>
          </div>
        )}

        {showMove && planActionsAvailable && targetSlots.length > 0 && (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Move {courseLabel} between plans
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Moving removes the course from the source plan and adds it to the
              target plan. The same section is kept.
            </p>
            <ul className="space-y-2">
              {movePairs.map(({ from, to }) => (
                <li key={`${from}-${to}`}>
                  <button
                    type="button"
                    onClick={() => handleMove(from, to)}
                    aria-label={`Move ${courseLabel} from Plan ${from} to Plan ${to}`}
                    data-testid={`recovery-move-${from}-${to}`}
                    className="w-full text-left px-3 py-2 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-sm flex items-center gap-3"
                  >
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: PLAN_COLORS[from] }}
                    >
                      Plan {from}
                    </span>
                    <span aria-hidden="true" className="text-gray-500">
                      →
                    </span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: PLAN_COLORS[to] }}
                    >
                      Plan {to}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowMove(false)}
              className="mt-3 text-sm text-gray-700 hover:text-gray-900"
            >
              ← Back to options
            </button>
          </div>
        )}

        {showPermission && (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Permission Request Draft
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <label
                  htmlFor="permission-to"
                  className="block text-xs text-gray-600 mb-1"
                >
                  To
                </label>
                <input
                  id="permission-to"
                  type="text"
                  value={permissionTo}
                  onChange={(e) => setPermissionTo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0C2340]/20 focus:border-[#0C2340]"
                />
              </div>
              <div>
                <label
                  htmlFor="permission-subject"
                  className="block text-xs text-gray-600 mb-1"
                >
                  Subject
                </label>
                <input
                  id="permission-subject"
                  type="text"
                  value={permissionSubject}
                  onChange={(e) => setPermissionSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0C2340]/20 focus:border-[#0C2340]"
                />
              </div>
              <div>
                <label
                  htmlFor="permission-message"
                  className="block text-xs text-gray-600 mb-1"
                >
                  Message
                </label>
                <textarea
                  id="permission-message"
                  rows={8}
                  value={permissionMessage}
                  onChange={(e) => setPermissionMessage(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0C2340]/20 focus:border-[#0C2340]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPermission(false)}
                  className="text-sm text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPermissionSent(true);
                    if (sentTimerRef.current !== null) {
                      clearTimeout(sentTimerRef.current);
                    }
                    sentTimerRef.current = setTimeout(() => {
                      setPermissionSent(false);
                      setShowPermission(false);
                      sentTimerRef.current = null;
                    }, 2000);
                  }}
                  className="text-sm bg-[#1B6B3A] text-white px-4 py-2 rounded-lg font-medium"
                >
                  {permissionSent ? "Sent!" : "Send Request"}
                </button>
              </div>
            </div>
          </div>
        )}

        {!showSwap && !showMove && !showPermission && (
          <div className="p-6 grid grid-cols-2 gap-3">
            {options.map((opt) => (
              <button
                key={opt.title}
                type="button"
                onClick={opt.action}
                disabled={opt.disabled}
                title={opt.disabled ? opt.disabledReason : undefined}
                data-testid={opt.testId}
                className="text-left p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
              >
                <div className="text-xl mb-2" aria-hidden="true">
                  {opt.icon}
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {opt.title}
                </div>
                <div className="text-xs text-gray-600 mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
