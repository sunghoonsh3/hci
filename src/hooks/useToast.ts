"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ToastState {
  message: string;
  variant: "success" | "warning" | "error";
  undo?: () => void;
}

interface ShowOptions {
  variant?: "success" | "warning" | "error";
  undo?: () => void;
  duration?: number;
}

const DEFAULT_DURATION = 4000;

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (message: string, opts: ShowOptions = {}) => {
      clearTimer();
      setToast({
        message,
        variant: opts.variant ?? "success",
        undo: opts.undo,
      });
      const duration = opts.duration ?? DEFAULT_DURATION;
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, duration);
    },
    [clearTimer],
  );

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const runUndo = useCallback(() => {
    if (toast?.undo) toast.undo();
    dismiss();
  }, [toast, dismiss]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { toast, show, dismiss, runUndo };
}
