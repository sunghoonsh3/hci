"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { PlanEntry, PlanSlot } from "@/types";
import { PlanEntriesSchema } from "@/lib/schemas";

const STORAGE_KEY = "registration-clarity-plans";

function loadPlans(): PlanEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = PlanEntriesSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Discarding invalid plans in localStorage", parsed.error);
      }
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed.data;
  } catch {
    return [];
  }
}

function savePlans(plans: PlanEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

export interface AddToPlanResult {
  added: boolean;
  alreadyInSlots: PlanSlot[];
}

interface PlansContextValue {
  plans: PlanEntry[];
  loaded: boolean;
  addToPlan: (
    courseId: number,
    sectionId: number,
    slot: PlanSlot,
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
  const [plans, setPlans] = useState<PlanEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage on mount. This is the canonical pattern
    // for client-only state that is unavailable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlans(loadPlans());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) savePlans(plans);
  }, [plans, loaded]);

  const addToPlan = useCallback(
    (
      courseId: number,
      sectionId: number,
      slot: PlanSlot,
    ): AddToPlanResult => {
      let result: AddToPlanResult = { added: false, alreadyInSlots: [] };
      setPlans((prev) => {
        const existingSlots = prev
          .filter((p) => p.sectionId === sectionId)
          .map((p) => p.planSlot);
        if (existingSlots.includes(slot)) {
          result = { added: false, alreadyInSlots: existingSlots };
          return prev;
        }
        result = {
          added: true,
          alreadyInSlots: existingSlots,
        };
        return [...prev, { courseId, sectionId, planSlot: slot }];
      });
      return result;
    },
    [],
  );

  const removeFromPlan = useCallback((sectionId: number, slot: PlanSlot) => {
    setPlans((prev) =>
      prev.filter(
        (p) => !(p.sectionId === sectionId && p.planSlot === slot),
      ),
    );
  }, []);

  const moveToPlan = useCallback(
    (sectionId: number, fromSlot: PlanSlot, toSlot: PlanSlot) => {
      setPlans((prev) =>
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
    setPlans((prev) => prev.filter((p) => p.planSlot !== slot));
  }, []);

  const clearAll = useCallback(() => {
    setPlans([]);
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
