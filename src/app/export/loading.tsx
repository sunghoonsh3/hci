export default function ExportLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="animate-pulse max-w-3xl"
    >
      <span className="sr-only">Preparing export…</span>
      <div className="h-6 w-48 bg-gray-200 rounded mb-6" />
      <div className="flex gap-2 mb-6">
        <div className="h-9 w-24 bg-gray-200 rounded" />
        <div className="h-9 w-24 bg-gray-100 rounded" />
        <div className="h-9 w-24 bg-gray-100 rounded" />
      </div>
      <div className="border border-gray-200 rounded-lg bg-white">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 border-b border-gray-100" />
        ))}
      </div>
    </div>
  );
}
