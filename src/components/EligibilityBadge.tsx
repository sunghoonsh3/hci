import type { EligibilityStatus } from "@/types";

const CONFIG: Record<
  EligibilityStatus,
  { label: string; bg: string; text: string }
> = {
  eligible: { label: "Eligible", bg: "bg-green-100", text: "text-green-800" },
  full: { label: "Full", bg: "bg-red-100", text: "text-red-800" },
  restricted: {
    label: "Restricted",
    bg: "bg-yellow-100",
    text: "text-yellow-800",
  },
  "needs-prereq": {
    label: "Restricted",
    bg: "bg-yellow-100",
    text: "text-yellow-800",
  },
  "already-taken": {
    label: "Taken",
    bg: "bg-gray-100",
    text: "text-gray-700",
  },
  "time-conflict": {
    label: "Conflict",
    bg: "bg-red-100",
    text: "text-red-800",
  },
  unknown: {
    label: "Unknown",
    bg: "bg-gray-100",
    text: "text-gray-700",
  },
};

export default function EligibilityBadge({
  status,
  size = "sm",
}: {
  status: EligibilityStatus;
  size?: "sm" | "md";
}) {
  const { label, bg, text } = CONFIG[status];
  return (
    <span
      role="status"
      aria-label={`Eligibility: ${label}`}
      className={`inline-flex items-center rounded-full font-medium ${bg} ${text} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      {label}
    </span>
  );
}
