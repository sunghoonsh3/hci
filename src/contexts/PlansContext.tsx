"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import type { PlanEntry, PlanSlot } from "@/types";
import { PlanEntriesSchema } from "@/lib/schemas";
import { createLocalStore, useLocalStoreValue } from "@/lib/localStore";

const plansStore = createLocalStore<PlanEntry[]>(
  "registration-clarity-plans",
  PlanEntriesSchema,
  [],
);

export interface AddToPlanResult {
  added: boolean;
  alreadyInSlots: PlanSlot[];
}

export interface CourseNameHint {
  subject?: string;
  courseNumber?: string;
  courseTitle?: string;
}

interface PlansContextValue {
  plans: PlanEntry[];
  loaded: boolean;
  addToPlan: (
    courseId: number,
    sectionId: number,
    slot: PlanSlot,
    hint?: CourseNameHint,
  ) => AddToPlanResult;
  removeFromPlan: (sectionId: number, slot: PlanSlot) => void;
  moveToPlan: (
    sectionId: number,
    fromSlot: PlanSlot,
    toSlot: PlanSlot,
  ) => void;
  getPlanEntries: (slot: PlanSlot) => PlanEntry[];
  isInPlan: (courseId: number, slot?: PlanSlot) => boolean;
  isSectionInPlan: (sectionId: number, slot?: PlanSlot) => boolean;
  findSlotsForSection: (sectionId: number) => PlanSlot[];
  clearPlan: (slot: PlanSlot) => void;
  clearAll: () => void;
}

const PlansContext = createContext<PlansContextValue | null>(null);

export function PlansProvider({ children }: { children: ReactNode }) {
  const plans = useLocalStoreValue(plansStore);

  const addToPlan = useCallback(
    (
      courseId: number,
      sectionId: number,
      slot: PlanSlot,
      hint?: CourseNameHint,
    ): AddToPlanResult => {
      const current = plansStore.getSnapshot();
      const existingSlots = current
        .filter((p) => p.sectionId === sectionId)
        .map((p) => p.planSlot);
      if (existingSlots.includes(slot)) {
        return { added: false, alreadyInSlots: existingSlots };
      }
      plansStore.set([
        ...current,
        {
          courseId,
          sectionId,
          planSlot: slot,
          subject: hint?.subject,
          courseNumber: hint?.courseNumber,
          courseTitle: hint?.courseTitle,
        },
      ]);
      return { added: true, alreadyInSlots: existingSlots };
    },
    [],
  );

  const removeFromPlan = useCallback((sectionId: number, slot: PlanSlot) => {
    plansStore.update((prev) =>
      prev.filter(
        (p) => !(p.sectionId === sectionId && p.planSlot === slot),
      ),
    );
  }, []);

  const moveToPlan = useCallback(
    (sectionId: number, fromSlot: PlanSlot, toSlot: PlanSlot) => {
      plansStore.update((prev) =>
        prev.map((p) =>
          p.sectionId === sectionId && p.planSlot === fromSlot
            ? { ...p, planSlot: toSlot }
            : p,
        ),
      );
    },
    [],
  );

  const getPlanEntries = useCallback(
    (slot: PlanSlot) => plans.filter((p) => p.planSlot === slot),
    [plans],
  );

  const isInPlan = useCallback(
    (courseId: number, slot?: PlanSlot) =>
      plans.some(
        (p) => p.courseId === courseId && (slot ? p.planSlot === slot : true),
      ),
    [plans],
  );

  const isSectionInPlan = useCallback(
    (sectionId: number, slot?: PlanSlot) =>
      plans.some(
        (p) =>
          p.sectionId === sectionId && (slot ? p.planSlot === slot : true),
      ),
    [plans],
  );

  const findSlotsForSection = useCallback(
    (sectionId: number): PlanSlot[] =>
      plans.filter((p) => p.sectionId === sectionId).map((p) => p.planSlot),
    [plans],
  );

  const clearPlan = useCallback((slot: PlanSlot) => {
    plansStore.update((prev) => prev.filter((p) => p.planSlot !== slot));
  }, []);

  const clearAll = useCallback(() => {
    plansStore.set([]);
  }, []);

  return (
    <PlansContext.Provider
      value={{
        plans,
        loaded: true,
        addToPlan,
        removeFromPlan,
        moveToPlan,
        getPlanEntries,
        isInPlan,
        isSectionInPlan,
        findSlotsForSection,
        clearPlan,
        clearAll,
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
