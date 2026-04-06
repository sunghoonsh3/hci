"use client";

import { useState, useEffect, useCallback } from "react";
import type { ParsedAudit } from "@/types";
import { parseAuditText, isValidAudit } from "@/lib/auditParser";

const STORAGE_KEY = "registration-clarity-audit";

function loadAudit(): ParsedAudit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAudit(audit: ParsedAudit | null) {
  if (audit) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(audit));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function useAudit() {
  const [audit, setAudit] = useState<ParsedAudit | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAudit(loadAudit());
    setLoaded(true);
  }, []);

  const setAuditText = useCallback((rawText: string): ParsedAudit | null => {
    const parsed = parseAuditText(rawText);
    if (isValidAudit(parsed)) {
      setAudit(parsed);
      saveAudit(parsed);
      return parsed;
    }
    return null;
  }, []);

  const clearAudit = useCallback(() => {
    setAudit(null);
    saveAudit(null);
  }, []);

  const isCourseTaken = useCallback(
    (subject: string, courseNumber: string): boolean => {
      if (!audit) return false;
      return audit.completedCourses.some(
        (c) => c.subject === subject && c.courseNumber === courseNumber
      );
    },
    [audit]
  );

  const isCourseInProgress = useCallback(
    (subject: string, courseNumber: string): boolean => {
      if (!audit) return false;
      return audit.inProgressCourses.some(
        (c) => c.subject === subject && c.courseNumber === courseNumber
      );
    },
    [audit]
  );

  return {
    audit,
    loaded,
    setAuditText,
    clearAudit,
    isCourseTaken,
    isCourseInProgress,
  };
}
