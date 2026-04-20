"use client";

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("Route error:", error);
    }
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="max-w-lg mx-auto py-12 text-center"
    >
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        We hit an unexpected error loading this page. You can try again, or
        return to search.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-400 mb-6">
          Error ID: <code>{error.digest}</code>
        </p>
      )}
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => unstable_retry()}
          className="bg-[#1B6B3A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#155a2f] transition-colors"
        >
          Try again
        </button>
        <a
          href="/search"
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Back to search
        </a>
      </div>
    </div>
  );
}
