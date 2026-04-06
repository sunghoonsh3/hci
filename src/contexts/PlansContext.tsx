"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
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

interface PlansContextValue {
  plans: PlanEntry[];
  loaded: boolean;
  addToPlan: (courseId: number, sectionId: number, slot: PlanSlot) => void;
  removeFromPlan: (sectionId: number, slot: PlanSlot) => void;
  moveToPlan: (sectionId: number, fromSlot: PlanSlot, toSlot: PlanSlot) => void;
  getPlanEntries: (slot: PlanSlot) => PlanEntry[];
  isInPlan: (courseId: number, slot?: PlanSlot) => boolean;
  isSectionInPlan: (sectionId: number, slot?: PlanSlot) => boolean;
  clearPlan: (slot: PlanSlot) => void;
}

const PlansContext = createContext<PlansContextValue | null>(null);

export function PlansProvider({ children }: { children: ReactNode }) {
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
        // Prevent duplicate: same section in same slot
        if (prev.some((p) => p.sectionId === sectionId && p.planSlot === slot)) {
          return prev;
        }
        return [...prev, { courseId, sectionId, planSlot: slot }];
      });
    },
    []
  );

  const removeFromPlan = useCallback(
    (sectionId: number, slot: PlanSlot) => {
      setPlans((prev) =>
        prev.filter((p) => !(p.sectionId === sectionId && p.planSlot === slot))
      );
    },
    []
  );

  const moveToPlan = useCallback(
    (sectionId: number, fromSlot: PlanSlot, toSlot: PlanSlot) => {
      setPlans((prev) =>
        prev.map((p) =>
          p.sectionId === sectionId && p.planSlot === fromSlot
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

  const isSectionInPlan = useCallback(
    (sectionId: number, slot?: PlanSlot) =>
      plans.some(
        (p) => p.sectionId === sectionId && (slot ? p.planSlot === slot : true)
      ),
    [plans]
  );

  const clearPlan = useCallback((slot: PlanSlot) => {
    setPlans((prev) => prev.filter((p) => p.planSlot !== slot));
  }, []);

  return (
    <PlansContext.Provider
      value={{
        plans,
        loaded,
        addToPlan,
        removeFromPlan,
        moveToPlan,
        getPlanEntries,
        isInPlan,
        isSectionInPlan,
        clearPlan,
      }}
    >
      {children}
    </PlansContext.Provider>
  );
}

export function usePlans(): PlansContextValue {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error("usePlans must be used within PlansProvider");
  return ctx;
}
