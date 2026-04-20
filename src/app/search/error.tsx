"use client";

import { useEffect } from "react";

export default function SearchError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("Search error:", error);
    }
  }, [error]);

  return (
    <div role="alert" aria-live="assertive" className="max-w-lg py-12">
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        Could not load course search
      </h2>
      <p className="text-sm text-gray-700 mb-6">
        The course catalogue is temporarily unavailable. Try again, or reduce
        the filters and retry.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-500 mb-6">
          Error ID: <code>{error.digest}</code>
        </p>
      )}
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="bg-[#1B6B3A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#155a2f] transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
