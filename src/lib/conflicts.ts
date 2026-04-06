// Time conflict detection between planned sections

interface MeetingTime {
  days: string | null;    // JSON array: '["M","W","F"]'
  startTime: string | null; // "10:00"
  endTime: string | null;   // "11:15"
}

function parseDays(daysJson: string | null): string[] {
  if (!daysJson) return [];
  try {
    return JSON.parse(daysJson);
  } catch {
    return [];
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function daysOverlap(a: string[], b: string[]): boolean {
  return a.some((d) => b.includes(d));
}

export function meetingsConflict(a: MeetingTime, b: MeetingTime): boolean {
  if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false;

  const daysA = parseDays(a.days);
  const daysB = parseDays(b.days);

  if (!daysOverlap(daysA, daysB)) return false;

  const startA = timeToMinutes(a.startTime);
  const endA = timeToMinutes(a.endTime);
  const startB = timeToMinutes(b.startTime);
  const endB = timeToMinutes(b.endTime);

  return startA < endB && startB < endA;
}

export function sectionsConflict(
  meetingsA: MeetingTime[],
  meetingsB: MeetingTime[]
): boolean {
  for (const a of meetingsA) {
    for (const b of meetingsB) {
      if (meetingsConflict(a, b)) return true;
    }
  }
  return false;
}
