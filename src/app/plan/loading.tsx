import { isDemoMode } from "@/lib/demoMode";

export default async function PlanLoading() {
  if (await isDemoMode()) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="animate-pulse"
    >
      <span className="sr-only">Loading your plan…</span>
      <div className="h-6 w-40 bg-gray-200 rounded mb-6" />
      <div className="flex gap-2 mb-4">
        <div className="h-9 w-24 bg-gray-200 rounded" />
        <div className="h-9 w-24 bg-gray-100 rounded" />
        <div className="h-9 w-24 bg-gray-100 rounded" />
      </div>
      <div className="grid grid-cols-[1fr_320px] gap-6">
        <div className="border border-gray-200 rounded-lg bg-white">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 border-b border-gray-100 bg-gray-50/50"
            />
          ))}
        </div>
        <div className="h-96 border border-gray-200 rounded-lg bg-white" />
      </div>
    </div>
  );
}
