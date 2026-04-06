"use client";

import { useState, useEffect, useCallback } from "react";
import type { PlanEntry, PlanSlot } from "@/types";

const STORAGE_KEY = "registration-clarity-plans";

function loadPlans(): PlanEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePlans(plans: PlanEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

export function usePlans() {
  const [plans, setPlans] = useState<PlanEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPlans(loadPlans());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) savePlans(plans);
  }, [plans, loaded]);

  const addToPlan = useCallback(
    (courseId: number, sectionId: number, slot: PlanSlot) => {
      setPlans((prev) => {
        // Remove existing entry for this course in this slot
        const filtered = prev.filter(
          (p) => !(p.courseId === courseId && p.planSlot === slot)
        );
        return [...filtered, { courseId, sectionId, planSlot: slot }];
      });
    },
    []
  );

  const removeFromPlan = useCallback(
    (courseId: number, slot: PlanSlot) => {
      setPlans((prev) =>
        prev.filter((p) => !(p.courseId === courseId && p.planSlot === slot))
      );
    },
    []
  );

  const moveToPlan = useCallback(
    (courseId: number, fromSlot: PlanSlot, toSlot: PlanSlot) => {
      setPlans((prev) =>
        prev.map((p) =>
          p.courseId === courseId && p.planSlot === fromSlot
            ? { ...p, planSlot: toSlot }
            : p
        )
      );
    },
    []
  );

  const getPlanEntries = useCallback(
    (slot: PlanSlot) => plans.filter((p) => p.planSlot === slot),
    [plans]
  );

  const isInPlan = useCallback(
    (courseId: number, slot?: PlanSlot) =>
      plans.some(
        (p) => p.courseId === courseId && (slot ? p.planSlot === slot : true)
      ),
    [plans]
  );

  const clearPlan = useCallback((slot: PlanSlot) => {
    setPlans((prev) => prev.filter((p) => p.planSlot !== slot));
  }, []);

  return {
    plans,
    loaded,
    addToPlan,
    removeFromPlan,
    moveToPlan,
    getPlanEntries,
    isInPlan,
    clearPlan,
  };
}
