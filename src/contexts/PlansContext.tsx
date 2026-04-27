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
import {
  addEntry,
  removeEntry,
  moveEntry,
  findSlotsForCourse as findSlotsForCourseEntries,
  findEntryInSlot as findEntryInSlotEntries,
} from "@/lib/planEntries";

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
  findSlotsForCourse: (courseId: number) => PlanSlot[];
  findEntryInSlot: (courseId: number, slot: PlanSlot) => PlanEntry | undefined;
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
      const result = addEntry(current, courseId, sectionId, slot, hint);
      if (result.added) plansStore.set(result.entries);
      return { added: result.added, alreadyInSlots: result.alreadyInSlots };
    },
    [],
  );

  const removeFromPlan = useCallback((sectionId: number, slot: PlanSlot) => {
    plansStore.update((prev) => removeEntry(prev, sectionId, slot));
  }, []);

  const moveToPlan = useCallback(
    (sectionId: number, fromSlot: PlanSlot, toSlot: PlanSlot) => {
      plansStore.update((prev) => moveEntry(prev, sectionId, fromSlot, toSlot));
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

  const findSlotsForCourse = useCallback(
    (courseId: number): PlanSlot[] =>
      findSlotsForCourseEntries(plans, courseId),
    [plans],
  );

  const findEntryInSlot = useCallback(
    (courseId: number, slot: PlanSlot): PlanEntry | undefined =>
      findEntryInSlotEntries(plans, courseId, slot),
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
        findSlotsForCourse,
        findEntryInSlot,
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
