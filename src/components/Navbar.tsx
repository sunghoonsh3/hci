"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

const NAV_ITEMS = [
  { href: "/search", label: "Search" },
  { href: "/plan", label: "Plan" },
  { href: "/export", label: "Export" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { unreadCount } = useToast();

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
          const showBadge = href === "/plan" && unreadCount > 0;
          return (
            <Link
              key={href}
              href={href}
              aria-label={
                showBadge
                  ? `${label} — ${unreadCount} new plan update${unreadCount === 1 ? "" : "s"}`
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
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-sm text-white/70">Summer 2026</span>
        <div className="w-8 h-8 rounded-full bg-[#1B6B3A] flex items-center justify-center text-sm font-medium">
          AM
        </div>
        <span className="text-sm font-medium">Alex Murphy</span>
      </div>
    </nav>
  );
}
