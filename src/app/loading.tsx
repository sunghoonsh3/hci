export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="animate-pulse space-y-3"
    >
      <span className="sr-only">Loading…</span>
      <div className="h-6 w-48 bg-gray-200 rounded" />
      <div className="h-4 w-full max-w-xl bg-gray-100 rounded" />
      <div className="h-4 w-full max-w-lg bg-gray-100 rounded" />
      <div className="h-64 w-full bg-gray-100 rounded mt-4" />
    </div>
  );
}
