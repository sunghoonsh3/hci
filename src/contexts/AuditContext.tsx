"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import type { ParsedAudit } from "@/types";
import { ParsedAuditSchema } from "@/lib/schemas";
import { parseAuditViaApi, type ParseAuditResult } from "@/lib/parseAuditClient";
import { createLocalStore, useLocalStoreValue } from "@/lib/localStore";

const auditStore = createLocalStore<ParsedAudit | null>(
  "registration-clarity-audit",
  ParsedAuditSchema.nullable(),
  null,
);

interface AuditContextValue {
  audit: ParsedAudit | null;
  loaded: boolean;
  setAuditText: (rawText: string) => Promise<ParseAuditResult>;
  clearAudit: () => void;
  isCourseTaken: (subject: string, courseNumber: string) => boolean;
  isCourseInProgress: (subject: string, courseNumber: string) => boolean;
}

const AuditContext = createContext<AuditContextValue | null>(null);

export function AuditProvider({ children }: { children: ReactNode }) {
  const audit = useLocalStoreValue(auditStore);

  const setAuditText = useCallback(
    async (rawText: string): Promise<ParseAuditResult> => {
      const result = await parseAuditViaApi(rawText);
      if (result.ok) {
        auditStore.set(result.audit);
      }
      return result;
    },
    [],
  );

  const clearAudit = useCallback(() => {
    auditStore.set(null);
  }, []);

  const isCourseTaken = useCallback(
    (subject: string, courseNumber: string): boolean => {
      if (!audit) return false;
      return audit.completedCourses.some(
        (c) => c.subject === subject && c.courseNumber === courseNumber,
      );
    },
    [audit],
  );

  const isCourseInProgress = useCallback(
    (subject: string, courseNumber: string): boolean => {
      if (!audit) return false;
      return audit.inProgressCourses.some(
        (c) => c.subject === subject && c.courseNumber === courseNumber,
      );
    },
    [audit],
  );

  return (
    <AuditContext.Provider
      value={{
        audit,
        loaded: true,
        setAuditText,
        clearAudit,
        isCourseTaken,
        isCourseInProgress,
      }}
    >
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit(): AuditContextValue {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error("useAudit must be used within AuditProvider");
  return ctx;
}
