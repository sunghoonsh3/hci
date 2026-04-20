"use client";

interface ToastProps {
  message: string;
  variant?: "success" | "warning" | "error";
  onUndo?: () => void;
  onDismiss?: () => void;
}

const STYLES: Record<NonNullable<ToastProps["variant"]>, string> = {
  success: "bg-[#1B6B3A] text-white",
  warning: "bg-amber-600 text-white",
  error: "bg-red-600 text-white",
};

export default function Toast({
  message,
  variant = "success",
  onUndo,
  onDismiss,
}: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-16 right-6 px-4 py-2 rounded-lg shadow-lg text-sm z-50 flex items-center gap-3 ${STYLES[variant]}`}
    >
      <span>{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="underline font-semibold hover:opacity-90"
        >
          Undo
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="opacity-80 hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}
