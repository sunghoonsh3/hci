/**
 * Static advisor guidance and recommended-path data for demo courses.
 *
 * NOTE: This is seed data backing the prototype. Production should move
 * these tables to Prisma (e.g. `CourseGuidance` / `CoursePath`) or a
 * headless CMS so advisors can edit guidance without a code deploy.
 */

export interface CourseGuidance {
  commonPairings: string;
  typicalSemester: string;
  fillSpeed: string;
  majorTakeRate: string;
}

const GUIDANCE: Record<string, CourseGuidance> = {
  "ACCT 20100": {
    commonPairings: "FIN 20100, ECON 10010",
    typicalSemester: "Sophomore Fall",
    fillSpeed: "Usually fills by Week 1",
    majorTakeRate: "95% sophomore year",
  },
  "CSE 20311": {
    commonPairings: "MATH 10560, CSE 20110",
    typicalSemester: "Sophomore Fall",
    fillSpeed: "Usually fills by Week 2",
    majorTakeRate: "98% sophomore year",
  },
  "CSE 20312": {
    commonPairings: "CSE 20289, CSE 20311",
    typicalSemester: "Sophomore Spring",
    fillSpeed: "Usually fills by Week 2",
    majorTakeRate: "97% sophomore year",
  },
  "CSE 30151": {
    commonPairings: "CSE 20312, CSE 40113",
    typicalSemester: "Junior Fall",
    fillSpeed: "Moderate demand",
    majorTakeRate: "100% CS majors",
  },
  "CSE 20289": {
    commonPairings: "CSE 20312, CSE 20311",
    typicalSemester: "Sophomore Spring",
    fillSpeed: "Usually fills by Week 2",
    majorTakeRate: "98% CS majors",
  },
  "ECON 10010": {
    commonPairings: "MATH 10250, ECON 10020",
    typicalSemester: "Freshman Fall or Spring",
    fillSpeed: "Usually fills by Week 2",
    majorTakeRate: "92% freshman year",
  },
  "FIN 20100": {
    commonPairings: "ACCT 20100, ECON 10010",
    typicalSemester: "Sophomore Spring",
    fillSpeed: "Usually fills by Week 1",
    majorTakeRate: "88% sophomore year",
  },
  "MATH 10550": {
    commonPairings: "MATH 10560, CSE 20110",
    typicalSemester: "Freshman Fall",
    fillSpeed: "Usually available",
    majorTakeRate: "100% STEM majors",
  },
};

const PATHS: Record<string, string[]> = {
  "CSE 20311": ["No prerequisites", "CSE 20311", "CSE 20312", "CSE 30151"],
  "CSE 20312": ["CSE 20311", "CSE 20312", "CSE 30151", "CSE 40113"],
  "CSE 20289": ["CSE 20311", "CSE 20289", "CSE 40113"],
  "CSE 30151": ["CSE 20312", "CSE 30151", "CSE 40175"],
  "CSE 40113": ["CSE 20312", "CSE 40113"],
  "CSE 40175": ["CSE 30151", "CSE 40175"],
  "ACCT 20100": ["No prerequisites", "ACCT 20100", "ACCT 20210", "ACCT 30100"],
  "FIN 20100": ["ACCT 20100", "FIN 20100", "FIN 30100"],
  "ECON 10010": ["No prerequisites", "ECON 10010", "ECON 20010", "ECON 30020"],
  "MATH 10550": ["No prerequisites", "MATH 10550", "MATH 10560", "MATH 20550"],
};

export function getCourseGuidance(
  subject: string,
  courseNumber: string,
): CourseGuidance | null {
  return GUIDANCE[`${subject} ${courseNumber}`] ?? null;
}

export function getCoursePath(
  subject: string,
  courseNumber: string,
): string[] | null {
  return PATHS[`${subject} ${courseNumber}`] ?? null;
}
