// Parse raw Degree Works audit text into structured data
import type { ParsedAudit, CompletedCourse } from "@/types";

export function parseAuditText(rawText: string): ParsedAudit {
  const lines = rawText.split("\n").map((l) => l.trim());

  const audit: ParsedAudit = {
    studentName: "",
    studentId: "",
    classification: "",
    college: "",
    major: "",
    catalogYear: "",
    gpa: 0,
    creditsRequired: 0,
    creditsApplied: 0,
    degreeProgress: 0,
    completedCourses: [],
    inProgressCourses: [],
  };

  let currentBlock = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Student name (typically first line or "Name: ...")
    if (/^Name[:\s]/i.test(line)) {
      audit.studentName = line.replace(/^Name[:\s]+/i, "").trim();
    }

    // Student ID
    const idMatch = line.match(/(?:ID|Student\s*ID)[:\s]+(\d+)/i);
    if (idMatch) {
      audit.studentId = idMatch[1];
    }

    // Classification
    const classMatch = line.match(/Classification[:\s]+(\w+)/i);
    if (classMatch) {
      audit.classification = classMatch[1];
    }

    // College
    const collegeMatch = line.match(/College[:\s]+(College of .+)/i);
    if (collegeMatch) {
      audit.college = collegeMatch[1].trim();
    }

    // Major
    const majorMatch = line.match(/Major[:\s]+(.+)/i);
    if (majorMatch && !line.match(/Major\s+in/i)) {
      audit.major = majorMatch[1].trim();
    }

    // Catalog year
    const catMatch = line.match(/Catalog\s*Year[:\s]+(\d{4})/i);
    if (catMatch) {
      audit.catalogYear = catMatch[1];
    }

    // GPA
    const gpaMatch = line.match(/(?:Overall\s+)?GPA[:\s]+([\d.]+)/i);
    if (gpaMatch) {
      audit.gpa = parseFloat(gpaMatch[1]);
    }

    // Credits required
    const reqMatch = line.match(/(?:Credits?\s+)?Required[:\s]+([\d.]+)/i);
    if (reqMatch && !line.match(/prerequisite/i)) {
      audit.creditsRequired = parseFloat(reqMatch[1]);
    }

    // Credits applied
    const appMatch = line.match(/(?:Credits?\s+)?Applied[:\s]+([\d.]+)/i);
    if (appMatch) {
      audit.creditsApplied = parseFloat(appMatch[1]);
    }

    // Degree progress percentage
    const progMatch = line.match(/(\d+)\s*%\s*(?:complete|progress|done)/i);
    if (progMatch) {
      audit.degreeProgress = parseInt(progMatch[1]);
    }
    // Also check "Progress: 98%"
    const prog2Match = line.match(/Progress[:\s]+([\d.]+)\s*%?/i);
    if (prog2Match) {
      audit.degreeProgress = parseFloat(prog2Match[1]);
    }

    // Requirement block headers
    if (
      /(?:University\s+Core|College\s+Requirements?|Major\s+in|Minor\s+in|Free\s+Elective|Concentration)/i.test(
        line
      )
    ) {
      currentBlock = line;
    }

    // Course lines — tab-separated or multi-space-separated
    // Format: SUBJECT COURSENUM  TITLE  GRADE  CREDITS  TERM
    // Or: SUBJECT COURSENUM\tTITLE\tGRADE\tCREDITS\tTERM
    const courseMatch = line.match(
      /^([A-Z]{2,5})\s+(\d{4,5})\s+(.+?)\s+((?:A[+-]?|B[+-]?|C[+-]?|D|F|S|U|IP|P|W|I|NR))\s+([\d.]+)\s+(.+)$/
    );
    if (courseMatch) {
      const course: CompletedCourse = {
        subject: courseMatch[1],
        courseNumber: courseMatch[2],
        title: courseMatch[3].trim(),
        grade: courseMatch[4],
        credits: parseFloat(courseMatch[5]),
        term: courseMatch[6].trim(),
        requirementBlock: currentBlock || undefined,
        status: courseMatch[4] === "IP" ? "in-progress" : "completed",
      };

      if (course.status === "in-progress") {
        audit.inProgressCourses.push(course);
      } else {
        audit.completedCourses.push(course);
      }
      continue;
    }

    // Alternative: tab-separated format
    const tabParts = line.split("\t").map((p) => p.trim());
    if (tabParts.length >= 5) {
      const subjectNum = tabParts[0].match(/^([A-Z]{2,5})\s+(\d{4,5})$/);
      if (subjectNum) {
        const grade = tabParts.length >= 4 ? tabParts[tabParts.length - 3] : "";
        const credits = tabParts.length >= 3 ? tabParts[tabParts.length - 2] : "";
        const term = tabParts[tabParts.length - 1];

        if (/^(?:A[+-]?|B[+-]?|C[+-]?|D|F|S|U|IP|P|W|I|NR)$/.test(grade)) {
          const course: CompletedCourse = {
            subject: subjectNum[1],
            courseNumber: subjectNum[2],
            title: tabParts.slice(1, tabParts.length - 3).join(" ").trim(),
            grade,
            credits: parseFloat(credits) || 0,
            term: term,
            requirementBlock: currentBlock || undefined,
            status: grade === "IP" ? "in-progress" : "completed",
          };

          if (course.status === "in-progress") {
            audit.inProgressCourses.push(course);
          } else {
            audit.completedCourses.push(course);
          }
        }
      }
    }
  }

  return audit;
}

export function isValidAudit(audit: ParsedAudit): boolean {
  return (
    audit.completedCourses.length > 0 ||
    audit.inProgressCourses.length > 0
  );
}
