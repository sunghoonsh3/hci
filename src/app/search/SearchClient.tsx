"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";

import { useAudit } from "@/contexts/AuditContext";
import { computeEligibility } from "@/lib/eligibility";
import { getRequirementBadges } from "@/lib/requirements";
import EligibilityBadge from "@/components/EligibilityBadge";
import type { EligibilityStatus } from "@/types";

interface Section {
  id: number;
  seatsAvailable: number | null;
  maxEnrollment: number | null;
  specialApproval: string | null;
  meetings: { days: string | null; startTime: string | null; endTime: string | null }[];
  instructors: { name: string }[];
}

interface Course {
  id: number;
  subject: string;
  courseNumber: string;
  courseTitle: string;
  creditHoursMin: number | null;
  creditHoursMax: number | null;
  registrationRestrictions: string | null;
  sections: Section[];
}

export default function SearchClient({
  courses,
  subjects,
  initialSubject,
  initialKeyword,
  initialOpenOnly,
}: {
  courses: Course[];
  subjects: string[];
  initialSubject: string;
  initialKeyword: string;
  initialOpenOnly: boolean;
}) {
  const router = useRouter();
  const { audit } = useAudit();

  const [subject, setSubject] = useState(initialSubject);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [openOnly, setOpenOnly] = useState(initialOpenOnly);

  const applyFilters = useCallback(() => {
    const sp = new URLSearchParams();
    if (subject) sp.set("subject", subject);
    if (keyword) sp.set("keyword", keyword);
    if (openOnly) sp.set("open", "true");
    router.push(`/search?${sp.toString()}`);
  }, [subject, keyword, openOnly, router]);

  function getStatus(course: Course): EligibilityStatus {
    const allCourses = audit
      ? [...audit.completedCourses, ...audit.inProgressCourses]
      : [];
    return computeEligibility(
      course.subject,
      course.courseNumber,
      course.registrationRestrictions,
      course.sections,
      allCourses,
      !!audit
    );
  }

  function totalSeats(course: Course) {
    const avail = course.sections.reduce(
      (sum, s) => sum + (s.seatsAvailable ?? 0),
      0
    );
    const max = course.sections.reduce(
      (sum, s) => sum + (s.maxEnrollment ?? 0),
      0
    );
    return { avail, max };
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Course Search</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Subject</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Keyword</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Search courses..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 pb-1">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="rounded"
          />
          Open seats only
        </label>
        <button
          onClick={applyFilters}
          className="bg-[#0C2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0a1d35] transition-colors"
        >
          Search
        </button>
      </div>

      {/* Results */}
      <div className="text-sm text-gray-500 mb-3">
        {courses.length} course{courses.length !== 1 ? "s" : ""} found
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-auto max-h-[calc(100vh-220px)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Course</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Seats</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Reqs</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => {
              const status = getStatus(course);
              const seats = totalSeats(course);
              const badges = getRequirementBadges(
                course.subject,
                course.courseNumber
              );
              return (
                <tr
                  key={course.id}
                  onClick={() => router.push(`/course/${course.id}`)}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-[#0C2340]">
                      {course.subject} {course.courseNumber}
                    </span>
                    <div className="text-xs text-gray-400">
                      {course.creditHoursMin === course.creditHoursMax
                        ? `${course.creditHoursMin} cr`
                        : `${course.creditHoursMin}-${course.creditHoursMax} cr`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{course.courseTitle}</td>
                  <td className="px-4 py-3">
                    <EligibilityBadge status={status} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        seats.avail === 0
                          ? "text-red-600 font-medium"
                          : "text-gray-600"
                      }
                    >
                      {seats.avail}/{seats.max}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {badges.map((b) => (
                        <span
                          key={b}
                          className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
