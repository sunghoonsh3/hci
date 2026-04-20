"use client";

/**
 * Small helpers for keyboard navigation inside WAI-ARIA widgets
 * (tablist with horizontal layout, menu with vertical layout).
 */

export function cycleIndex(
  current: number,
  key: string,
  total: number,
  orientation: "horizontal" | "vertical" = "horizontal",
): number | null {
  if (total === 0) return null;
  const forward =
    orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  const back = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  switch (key) {
    case forward:
      return (current + 1) % total;
    case back:
      return (current - 1 + total) % total;
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return null;
  }
}
