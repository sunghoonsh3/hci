"use client";

import { PlansProvider } from "@/contexts/PlansContext";
import { AuditProvider } from "@/contexts/AuditContext";
import { ToastProvider } from "@/contexts/ToastContext";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuditProvider>
      <PlansProvider>
        <ToastProvider>{children}</ToastProvider>
      </PlansProvider>
    </AuditProvider>
  );
}
