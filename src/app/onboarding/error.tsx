"use client";

import { useEffect } from "react";

export default function OnboardingError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("Onboarding error:", error);
    }
  }, [error]);

  return (
    <div role="alert" aria-live="assertive" className="max-w-2xl mx-auto py-12">
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        Onboarding couldn&apos;t load
      </h2>
      <p className="text-sm text-gray-700 mb-6">
        Retry to reload the onboarding flow. Your existing audit, if any, is
        still saved locally.
      </p>
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
