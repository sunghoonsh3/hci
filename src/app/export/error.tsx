"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ExportError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("Export error:", error);
    }
  }, [error]);

  return (
    <div role="alert" aria-live="assertive" className="max-w-lg py-12">
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        Export pre-check failed
      </h2>
      <p className="text-sm text-gray-700 mb-6">
        Nothing was sent to NOVO. Your plan is preserved. Retry the export or
        return to your plan to make adjustments.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="bg-[#1B6B3A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#155a2f] transition-colors"
        >
          Try again
        </button>
        <Link
          href="/plan"
          className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Back to plan
        </Link>
      </div>
    </div>
  );
}
