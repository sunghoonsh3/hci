"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlans } from "@/contexts/PlansContext";
import { useAudit } from "@/contexts/AuditContext";
import { deriveName } from "@/lib/persona";

const NAV_ITEMS = [
  { href: "/search", label: "Search" },
  { href: "/plan", label: "Plan" },
  { href: "/export", label: "Export" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { plans } = usePlans();
  const { audit } = useAudit();
  const planCount = plans.length;
  const { display: profileName, initials } = deriveName(audit?.studentName);

  return (
    <nav
      aria-label="Main navigation"
      className="bg-[#0C2340] text-white h-14 flex items-center px-6 shrink-0"
    >
      <Link
        href="/search"
        aria-label="PATH — Registration Clarity home"
        className="flex items-center gap-2 mr-8"
      >
        <span className="text-xl" aria-hidden="true">
          ☘️
        </span>
        <span className="text-lg font-bold tracking-wide">PATH</span>
      </Link>

      <div className="flex gap-1">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          const showBadge = href === "/plan" && planCount > 0;
          return (
            <Link
              key={href}
              href={href}
              aria-label={
                showBadge
                  ? `${label} — ${planCount} course${planCount === 1 ? "" : "s"} planned`
                  : undefined
              }
              className={`px-4 py-2 rounded text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                active
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <span>{label}</span>
              {showBadge && (
                <span
                  className="inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full bg-[#C99700] text-[#0C2340] text-[10px] font-bold leading-none"
                  aria-hidden="true"
                >
                  {planCount > 9 ? "9+" : planCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-sm text-white/70">Summer 2026</span>
        <div
          aria-hidden="true"
          className="w-8 h-8 rounded-full bg-[#1B6B3A] flex items-center justify-center text-sm font-medium"
        >
          {initials}
        </div>
        <span className="text-sm font-medium">{profileName}</span>
      </div>
    </nav>
  );
}
