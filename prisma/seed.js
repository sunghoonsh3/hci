const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

require("dotenv/config");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const jsonPath = path.join(__dirname, "courses_2026_summer.json");
const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
const courses = raw.courses || raw;

console.log(`Found ${courses.length} courses to seed`);

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clear existing data (order matters for foreign keys)
    await client.query('DELETE FROM "Instructor"');
    await client.query('DELETE FROM "Meeting"');
    await client.query('DELETE FROM "Section"');
    await client.query('DELETE FROM "Course"');

    let courseCount = 0;
    let sectionCount = 0;
    let meetingCount = 0;
    let instructorCount = 0;

    for (const c of courses) {
      const { rows } = await client.query(
        `INSERT INTO "Course" (subject, "courseNumber", "courseTitle", description, "creditHoursMin", "creditHoursMax", "cannotHaveTaken", "registrationRestrictions", "crosslistedWith", attributes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          c.subject,
          c.course_number,
          c.course_title,
          c.course_description || null,
          c.credit_hours_min || null,
          c.credit_hours_max || null,
          c.cannot_have_taken ? JSON.stringify(c.cannot_have_taken) : null,
          c.registration_restrictions ? JSON.stringify(c.registration_restrictions) : null,
          c.crosslisted_with ? JSON.stringify(c.crosslisted_with) : null,
          c.attributes ? JSON.stringify(c.attributes) : null,
        ]
      );
      const courseId = rows[0].id;
      courseCount++;

      for (const s of c.sections || []) {
        const sRes = await client.query(
          `INSERT INTO "Section" ("courseId", "sectionNumber", crn, status, "maxEnrollment", "seatsAvailable", "waitlistCurrent", "waitlistCapacity", campus, "gradeMode", "specialApproval", "sectionNotes")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [
            courseId,
            s.section || null,
            s.crn || null,
            s.status || null,
            s.max_enrollment || null,
            s.seats_available != null ? s.seats_available : null,
            s.waitlist_current || null,
            s.waitlist_capacity || null,
            s.campus || null,
            s.grade_mode || null,
            s.special_approval || null,
            s.section_notes || null,
          ]
        );
        const sectionId = sRes.rows[0].id;
        sectionCount++;

        for (const m of s.meetings || []) {
          await client.query(
            `INSERT INTO "Meeting" ("sectionId", room, "startDate", "endDate", days, "startTime", "endTime")
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              sectionId,
              m.room || null,
              m.start_date || null,
              m.end_date || null,
              m.days ? JSON.stringify(m.days) : null,
              m.start_time || null,
              m.end_time || null,
            ]
          );
          meetingCount++;
        }

        for (const instructor of s.instructors || []) {
          await client.query(
            `INSERT INTO "Instructor" ("sectionId", name) VALUES ($1,$2)`,
            [sectionId, instructor]
          );
          instructorCount++;
        }
      }
    }

    await client.query("COMMIT");
    console.log(
      `Seeded: ${courseCount} courses, ${sectionCount} sections, ${meetingCount} meetings, ${instructorCount} instructors`
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
