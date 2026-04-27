import { isDemoMode } from "@/lib/demoMode";

export default async function SearchLoading() {
  if (await isDemoMode()) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="animate-pulse"
    >
      <span className="sr-only">Loading courses…</span>
      <div className="h-6 w-60 bg-gray-200 rounded mb-4" />
      <div className="flex gap-3 mb-6">
        <div className="h-9 w-40 bg-gray-200 rounded" />
        <div className="h-9 w-56 bg-gray-200 rounded" />
        <div className="h-9 w-36 bg-gray-200 rounded" />
      </div>
      <div className="border border-gray-200 rounded-lg bg-white">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-12 border-b border-gray-100 bg-gray-50/50"
          />
        ))}
      </div>
    </div>
  );
}
