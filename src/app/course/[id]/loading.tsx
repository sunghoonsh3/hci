import { isDemoMode } from "@/lib/demoMode";

export default async function CourseLoading() {
  if (await isDemoMode()) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="animate-pulse"
    >
      <span className="sr-only">Loading course…</span>
      <div className="h-4 w-48 bg-gray-100 rounded mb-4" />
      <div className="grid grid-cols-[1fr_280px] gap-6">
        <div>
          <div className="h-8 w-2/3 bg-gray-200 rounded mb-3" />
          <div className="h-4 w-1/2 bg-gray-100 rounded mb-6" />
          <div className="flex gap-3 mb-6">
            <div className="h-9 w-28 bg-gray-200 rounded" />
            <div className="h-9 w-24 bg-gray-100 rounded" />
          </div>
          <div className="h-24 w-full bg-gray-100 rounded mb-6" />
          <div className="h-48 w-full bg-gray-100 rounded" />
        </div>
        <div className="h-64 bg-gray-100 rounded" />
      </div>
    </div>
  );
}
