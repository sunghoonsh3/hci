"use client";

import { useMemo } from "react";

interface CalendarEvent {
  id: number;
  label: string;
  days: string[];
  startTime: string; // "10:00"
  endTime: string;   // "11:15"
  color: string;
  conflict?: boolean;
}

const DAYS = ["M", "T", "W", "R", "F"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const START_HOUR = 8;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function timeToOffset(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h - START_HOUR) * 60 + m) / 60;
}

interface LayoutSlot {
  event: CalendarEvent;
  col: number;
  totalCols: number;
  hasConflict: boolean;
}

/** Assign side-by-side columns to overlapping events and flag conflicts. */
function layoutEvents(dayEvents: CalendarEvent[]): LayoutSlot[] {
  if (dayEvents.length === 0) return [];

  // Sort by start time, then by end time
  const sorted = [...dayEvents].sort((a, b) => {
    const diff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    return diff !== 0 ? diff : timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
  });

  // Detect overlap groups — events that transitively overlap
  const groups: CalendarEvent[][] = [];
  let currentGroup: CalendarEvent[] = [sorted[0]];
  let groupEnd = timeToMinutes(sorted[0].endTime);

  for (let i = 1; i < sorted.length; i++) {
    const ev = sorted[i];
    if (timeToMinutes(ev.startTime) < groupEnd) {
      // Overlaps with current group
      currentGroup.push(ev);
      groupEnd = Math.max(groupEnd, timeToMinutes(ev.endTime));
    } else {
      groups.push(currentGroup);
      currentGroup = [ev];
      groupEnd = timeToMinutes(ev.endTime);
    }
  }
  groups.push(currentGroup);

  // Assign columns within each group
  const result: LayoutSlot[] = [];
  for (const group of groups) {
    const hasConflict = group.length > 1;
    const cols: number[] = []; // end time per column
    for (const ev of group) {
      const start = timeToMinutes(ev.startTime);
      // Find first column where this event fits
      let col = cols.findIndex((end) => end <= start);
      if (col === -1) {
        col = cols.length;
        cols.push(0);
      }
      cols[col] = timeToMinutes(ev.endTime);
      result.push({ event: ev, col, totalCols: group.length, hasConflict });
    }
    // Update totalCols to actual columns used
    const actualCols = cols.length;
    for (const slot of result) {
      if (group.includes(slot.event)) {
        slot.totalCols = actualCols;
      }
    }
  }

  return result;
}

export default function WeeklyCalendar({
  events = [],
  compact = false,
  highlightedId,
  onEventClick,
}: {
  events?: CalendarEvent[];
  compact?: boolean;
  highlightedId?: number | null;
  onEventClick?: (id: number) => void;
}) {
  const hourHeight = compact ? 24 : 40;
  const totalHeight = HOURS.length * hourHeight;

  const layoutByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const day of DAYS) map[day] = [];
    for (const ev of events) {
      for (const d of ev.days) {
        if (map[d]) map[d].push(ev);
      }
    }
    const result: Record<string, LayoutSlot[]> = {};
    for (const day of DAYS) {
      result[day] = layoutEvents(map[day]);
    }
    return result;
  }, [events]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-[calc(100vh-200px)] bg-white">
      {/* Day headers */}
      <div className="grid grid-cols-[48px_repeat(5,1fr)] border-b border-gray-200">
        <div className="p-1" />
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-gray-500 py-1 border-l border-gray-100"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div
        className="grid grid-cols-[48px_repeat(5,1fr)] relative"
        style={{ height: totalHeight }}
      >
        {/* Hour labels */}
        <div className="relative">
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute text-[10px] text-gray-400 pr-1 text-right w-full"
              style={{ top: (h - START_HOUR) * hourHeight - 6 }}
            >
              {h > 12 ? h - 12 : h}
              {h >= 12 ? "p" : "a"}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAYS.map((day) => (
          <div key={day} className="relative border-l border-gray-100">
            {/* Hour lines */}
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute w-full border-t border-gray-50"
                style={{ top: (h - START_HOUR) * hourHeight }}
              />
            ))}

            {/* Events */}
            {layoutByDay[day].map((slot) => {
              const ev = slot.event;
              const top = timeToOffset(ev.startTime) * hourHeight;
              const bottom = timeToOffset(ev.endTime) * hourHeight;
              const height = bottom - top;
              const widthPct = 100 / slot.totalCols;
              const leftPct = slot.col * widthPct;
              const isHighlighted = highlightedId === ev.id;
              return (
                <div
                  key={`${ev.id}-${day}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onEventClick?.(ev.id);
                  }}
                  className={`absolute rounded text-[9px] leading-tight px-1 py-0.5 overflow-hidden transition-opacity ${
                    onEventClick ? "cursor-pointer select-none" : ""
                  } ${
                    slot.hasConflict
                      ? "border-2 border-red-500 ring-1 ring-red-300"
                      : ""
                  } ${
                    isHighlighted
                      ? "ring-2 ring-yellow-400 ring-offset-1 z-10"
                      : highlightedId != null
                        ? "opacity-40"
                        : ""
                  }`}
                  style={{
                    top,
                    height: Math.max(height, 12),
                    left: `calc(${leftPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                    backgroundColor: ev.color,
                  }}
                  title={`${ev.label} ${ev.startTime}-${ev.endTime}${slot.hasConflict ? " ⚠ CONFLICT" : ""}`}
                >
                  <span className="font-medium text-white drop-shadow-sm">
                    {ev.label}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export type { CalendarEvent };
