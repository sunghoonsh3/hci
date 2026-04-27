"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAudit } from "@/contexts/AuditContext";
import { usePlans } from "@/contexts/PlansContext";

export default function OnboardingPage() {
  const router = useRouter();
  const { audit, setAuditText, clearAudit } = useAudit();
  const { clearAll } = usePlans();
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  if (audit) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome back, {audit.studentName || "Student"}
        </h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Major:</span>{" "}
              <span className="font-medium">{audit.major}</span>
            </div>
            <div>
              <span className="text-gray-600">Classification:</span>{" "}
              <span className="font-medium">{audit.classification}</span>
            </div>
            <div>
              <span className="text-gray-600">Credits:</span>{" "}
              <span className="font-medium">
                {audit.creditsApplied}/{audit.creditsRequired}
              </span>
            </div>
            <div>
              <span className="text-gray-600">GPA:</span>{" "}
              <span className="font-medium">{audit.gpa.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-gray-600">Courses completed:</span>{" "}
              <span className="font-medium">
                {audit.completedCourses.length}
              </span>
            </div>
            <div>
              <span className="text-gray-600">In progress:</span>{" "}
              <span className="font-medium">
                {audit.inProgressCourses.length}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/search")}
            className="bg-[#1B6B3A] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#155a2f] transition-colors"
          >
            Continue to Search
          </button>
          <button
            type="button"
            onClick={() => {
              const proceed =
                typeof window === "undefined" ||
                window.confirm(
                  "This will clear your saved audit and remove any plans you added. Continue?",
                );
              if (!proceed) return;
              clearAudit();
              clearAll();
              setRawText("");
              setError("");
            }}
            className="bg-gray-100 text-gray-800 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Re-paste Audit
          </button>
        </div>
      </div>
    );
  }

  async function handleParse() {
    setError("");
    if (!rawText.trim()) {
      setError("Please paste your degree audit text.");
      return;
    }
    setIsParsing(true);
    try {
      const result = await setAuditText(rawText);
      if (!result.ok) {
        switch (result.error.kind) {
          case "empty":
            setError("Please paste your degree audit text.");
            break;
          case "too-long":
            setError(
              `Audit too long (${result.error.chars.toLocaleString()} chars). Trim it down and try again.`,
            );
            break;
          case "rate-limited": {
            const wait = result.error.retryAfterSeconds;
            setError(
              wait
                ? `Too many parse attempts. Try again in ${wait}s.`
                : "Too many parse attempts. Try again shortly.",
            );
            break;
          }
          case "invalid-shape":
            setError(
              "Parser returned an unexpected shape. Make sure you copied the full degree audit from GPS/Degree Works.",
            );
            break;
          case "server":
            setError(`Parse failed: ${result.error.message}`);
            break;
        }
      }
    } finally {
      setIsParsing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Welcome to PATH
      </h1>
      <p className="text-gray-700 mb-6">
        Paste your Degree Audit from GPS (Degree Works) below to get started.
        We&apos;ll parse your completed courses to check eligibility and
        prerequisites automatically.
      </p>

      <label htmlFor="audit-text" className="sr-only">
        Degree audit text
      </label>
      <textarea
        id="audit-text"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="Paste your full degree audit text here..."
        disabled={isParsing}
        className="w-full h-64 p-4 border border-gray-300 rounded-lg text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#1B6B3A] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleParse}
        disabled={isParsing}
        aria-busy={isParsing}
        className="mt-4 bg-[#1B6B3A] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#155a2f] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isParsing ? "Parsing audit…" : "Parse Audit"}
      </button>
      {isParsing && (
        <p className="mt-2 text-xs text-gray-600">
          This usually takes a few seconds.
        </p>
      )}
    </div>
  );
}
