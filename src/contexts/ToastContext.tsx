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
  /**
   * When false, the toast is not counted toward the unread badge. Use for
   * ephemeral confirmations (e.g. "Waitlist submitted") that do not reflect
   * a state change the user might want to review on the Plan page.
   */
  trackUnread?: boolean;
}

interface ToastContextValue {
  show: (message: string, opts?: ShowOptions) => void;
  dismiss: () => void;
  unreadCount: number;
  markRead: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
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
      if (opts.trackUnread !== false) {
        setUnreadCount((c) => c + 1);
      }
      const duration = opts.duration ?? DEFAULT_DURATION;
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, duration);
    },
    [clearTimer],
  );

  const markRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const runUndo = useCallback(() => {
    if (toast?.undo) toast.undo();
    dismiss();
  }, [toast, dismiss]);

  return (
    <ToastContext.Provider value={{ show, dismiss, unreadCount, markRead }}>
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
