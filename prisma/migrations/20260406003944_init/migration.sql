-- CreateTable
CREATE TABLE "Course" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subject" TEXT NOT NULL,
    "courseNumber" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "description" TEXT,
    "creditHoursMin" INTEGER,
    "creditHoursMax" INTEGER,
    "cannotHaveTaken" TEXT,
    "registrationRestrictions" TEXT,
    "crosslistedWith" TEXT,
    "attributes" TEXT
);

-- CreateTable
CREATE TABLE "Section" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "courseId" INTEGER NOT NULL,
    "sectionNumber" TEXT,
    "crn" INTEGER,
    "status" TEXT,
    "maxEnrollment" INTEGER,
    "seatsAvailable" INTEGER,
    "waitlistCurrent" INTEGER,
    "waitlistCapacity" INTEGER,
    "campus" TEXT,
    "gradeMode" TEXT,
    "specialApproval" TEXT,
    "sectionNotes" TEXT,
    CONSTRAINT "Section_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sectionId" INTEGER NOT NULL,
    "room" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "days" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    CONSTRAINT "Meeting_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Instructor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sectionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Instructor_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Course_subject_idx" ON "Course"("subject");

-- CreateIndex
CREATE INDEX "Course_courseNumber_idx" ON "Course"("courseNumber");

-- CreateIndex
CREATE INDEX "Course_subject_courseNumber_idx" ON "Course"("subject", "courseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Section_crn_key" ON "Section"("crn");
