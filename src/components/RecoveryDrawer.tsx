"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePlans } from "@/contexts/PlansContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";

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
  const { addToPlan } = usePlans();
  const [showSwap, setShowSwap] = useState(false);
  const [showPermission, setShowPermission] = useState(false);
  const [permissionSent, setPermissionSent] = useState(false);
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

  function handleSwapSection(sectionId: number) {
    addToPlan(course.id, sectionId, "A");
    onClose();
  }

  function handleMoveToPlanB() {
    const open = course.sections.find(
      (s) => s.seatsAvailable === null || (s.seatsAvailable ?? 0) > 0,
    );
    if (open) {
      addToPlan(course.id, open.id, "B");
    }
    onClose();
  }

  const options = [
    {
      title: "Swap Section",
      desc: "Try a different section of this course",
      action: () => setShowSwap(true),
      icon: "↔",
    },
    {
      title: "Find Alternatives",
      desc: `Search for other ${course.subject} courses`,
      action: () => router.push(`/search?subject=${course.subject}`),
      icon: "🔍",
    },
    {
      title: "Move to Plan B",
      desc: "Keep as backup option",
      action: handleMoveToPlanB,
      icon: "📋",
    },
    {
      title: "Request Permission",
      desc: "Draft an override request email",
      action: () => setShowPermission(true),
      icon: "✉",
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

        {showSwap && (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Swap Section — {course.subject} {course.courseNumber}
            </h3>
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
                          <button
                            type="button"
                            onClick={() => handleSwapSection(s.id)}
                            aria-label={`Select section ${s.sectionNumber ?? s.id}`}
                            className="text-xs bg-[#1B6B3A] text-white px-3 py-1 rounded font-medium"
                          >
                            Select
                          </button>
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

        {showPermission && (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Permission Request Draft
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-gray-600 mb-1">To</label>
                <input
                  readOnly
                  value={`${course.sections[0]?.instructors[0]?.name ?? "Instructor"}@nd.edu`}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Subject
                </label>
                <input
                  readOnly
                  value={`Permission to enroll: ${course.subject} ${course.courseNumber}`}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Message
                </label>
                <textarea
                  readOnly
                  rows={5}
                  value={`Dear Professor,\n\nI am writing to request permission to enroll in ${course.subject} ${course.courseNumber}: ${course.courseTitle} for Summer 2026.\n\nI am a senior in the College of Arts and Letters, majoring in Computer Science (BA). I believe this course aligns with my academic goals.\n\nThank you for your consideration.\n\nBest regards,\nAlex Murphy`}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-700"
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

        {!showSwap && !showPermission && (
          <div className="p-6 grid grid-cols-2 gap-3">
            {options.map((opt) => (
              <button
                key={opt.title}
                type="button"
                onClick={opt.action}
                className="text-left p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
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
