"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Toast from "@/components/Toast";

export type ToastVariant = "success" | "warning" | "error";

interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
  undo?: () => void;
}

export interface ShowOptions {
  variant?: ToastVariant;
  undo?: () => void;
  duration?: number;
}

interface ToastContextValue {
  show: (message: string, opts?: ShowOptions) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const show = useCallback(
    (message: string, opts: ShowOptions = {}) => {
      clearTimer();
      idRef.current += 1;
      setToast({
        id: idRef.current,
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

  useEffect(() => () => clearTimer(), [clearTimer]);

  const runUndo = useCallback(() => {
    if (toast?.undo) toast.undo();
    dismiss();
  }, [toast, dismiss]);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          onUndo={toast.undo ? runUndo : undefined}
          onDismiss={dismiss}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
