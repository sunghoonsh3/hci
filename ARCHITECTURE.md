# Registration Clarity — Architecture & Sprint Plan

## Project Overview

**Registration Clarity at Notre Dame** — A redesigned PATH-to-NOVO workflow that helps students build requirement-safe schedules, understand eligibility/restrictions in plain language, and recover quickly from blocked or full courses.

**Target user:** Notre Dame undergraduates planning and registering for courses.
**Platform:** Web, desktop-first (1440x900 reference resolution).
**Demo persona:** BACS (BA Computer Science, Arts & Letters) student using real audit data with display name "Alex Murphy" for anonymity.

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Framework** | Next.js 16+ (App Router) | Full-stack in one project, server components for fast data loading, great DX |
| **Language** | TypeScript | Type-safe queries, better refactoring, Prisma integration |
| **Styling** | Tailwind CSS v4 | Matches Sprint 2 design system, rapid iteration |
| **Database** | Neon PostgreSQL | Hosted Postgres, free tier, supports Vercel deployment with DB writes |
| **ORM** | Prisma | Type-safe client, auto-generated types, schema migrations |
| **Search/Filter** | SQL queries with LIKE + indexed columns | Dataset is small (569 courses, 1179 sections) — no search engine needed |
| **State (plans)** | localStorage | No auth needed for Sprint 3, clean migration to DB later |
| **State (audit)** | localStorage | Parsed from paste, persists across pages |
| **Hosting** | Vercel | Zero-config Next.js deployment, auto-deploys from GitHub |
| **Dev environment** | Local `next dev`, Neon DB | No Docker, env vars in `.env` |

### Why not alternatives

- **JSON files only:** No query layer for filtering, sorting, joining sections. A database gives this for free.
- **SQLite:** Used initially for zero-config dev, but incompatible with Vercel's ephemeral filesystem. Migrated to Neon PostgreSQL.
- **Supabase:** Neon was simpler for our needs (just Postgres, no extra services).
- **Separate frontend + backend:** Two projects, CORS, separate deploys — pointless for prototype.
- **Python backend:** Scraper is Python, but web app benefits from React/Next.js ecosystem for UI quality.
- **Vector DB:** Data is structured and small. No semantic search needed.

---

## Data Sources

### 1. Scraped course data (`courses_2026_summer.json`)
- 569 courses, 1179 sections, 92 subjects
- Rich structured data: restrictions, prerequisites, seat counts, meetings, instructors
- Seeded into Neon PostgreSQL via seed script (uses `pg` driver directly)

### 2. Student degree audit (pasted raw text from GPS/Degree Works)
- Parsed client-side with deterministic regex parser
- Extracts: completed courses, grades, credits, terms, requirement blocks, in-progress courses, classification, major, college
- Stored in localStorage
- Format is consistent across all ND students (Ellucian Degree Works)

### 3. BACS major requirements (hardcoded)
- CS core: CSE 20311, 20312, 20289, 30151, 40113, 40175 (20 credits)
- CS electives: 12 credits of CSE 30000+ level
- Math: MATH 10550, 10560, CSE 20110, + 6 credits from [MATH 20550, 20610, 20580, ACMS 30440, 30530]
- Plus University Core + College of Arts & Letters requirements

---

## Database Schema

```prisma
model Course {
  id                      Int       @id @default(autoincrement())
  subject                 String    // "ACMS"
  courseNumber             String    // "30617"
  courseTitle              String
  description             String?
  creditHoursMin          Int?
  creditHoursMax          Int?
  cannotHaveTaken         String?   // JSON string array
  registrationRestrictions String?  // JSON string array
  crosslistedWith         String?   // JSON string array
  attributes              String?   // JSON array of {code, description}
  sections                Section[]

  @@index([subject])
  @@index([courseNumber])
  @@index([subject, courseNumber])
}

model Section {
  id               Int          @id @default(autoincrement())
  course           Course       @relation(fields: [courseId], references: [id])
  courseId          Int
  sectionNumber    String?      // "01"
  crn              Int?
  status           String?      // "Active"
  maxEnrollment    Int?
  seatsAvailable   Int?
  waitlistCurrent  Int?
  waitlistCapacity Int?
  campus           String?
  gradeMode        String?
  specialApproval  String?
  sectionNotes     String?
  meetings         Meeting[]
  instructors      Instructor[]
}

model Meeting {
  id        Int     @id @default(autoincrement())
  section   Section @relation(fields: [sectionId], references: [id])
  sectionId Int
  room      String?
  startDate String? // "2026-06-15"
  endDate   String?
  days      String? // JSON array: ["M","W","F"]
  startTime String? // "10:00"
  endTime   String? // "11:15"
}

model Instructor {
  id        Int     @id @default(autoincrement())
  section   Section @relation(fields: [sectionId], references: [id])
  sectionId Int
  name      String
}
```

### Design decisions
- **Sections and meetings normalized** — needed for time-based queries and seat filtering
- **Restrictions/attributes as JSON strings** — display-only for now, parsed by regex at render time
- **Instructors as separate table** — one section can have multiple, and searchable
- **Plans in localStorage** — `{ courseId, sectionId, planSlot: "A"|"B"|"C" }[]`, keyed by **sectionId** (not courseId) — multiple sections of the same course can be added to the same or different plans
- **Audit data in localStorage** — `{ completedCourses, inProgressCourses, classification, major, college, creditsApplied, creditsRequired, gpa }`

---

## Pages & Routes

```
/                       → redirects to /search
/onboarding             → paste audit text, parse, store
/search                 → search/filter courses, clickable rows → course detail
/course/[id]            → course detail with eligibility, sections (Select button per section), restrictions
/plan                   → Plan A/B/C table + weekly calendar with conflict detection + click-to-highlight
/export                 → Plan A/B/C tabs, per-plan pre-check diagnostics + export
/api/course/[id]        → API route for client-side course data fetching (used by plan + export pages)
```

---

## Core Feature Logic

### Eligibility Status (deterministic, computed at render time)

For each course, given the student's audit data:

| Status | Condition |
|--------|-----------|
| **Already Taken** | `subject + courseNumber` found in `completedCourses` with `status === "completed"` |
| **Full** | All sections have `seatsAvailable == 0` |
| **Restricted** | `specialApproval != null` on selected/all sections |
| **Needs Prereq** | Restriction text matches prerequisite regex AND prereq not in `completedCourses` |
| **Eligible** | None of the above apply |

### Restriction Parsing (regex, ~5 patterns cover 90%+)

| Pattern | Regex |
|---------|-------|
| Prerequisites | `Prerequisites:\s*\(([^)]+)\)` |
| Level restriction | `limited to .+ level students` |
| Campus restriction | `limited to students in the .+ campus` |
| Program exclusion | `cannot enroll who have a program in` |
| Special approval | Read from `section.specialApproval` |

Cross-reference prerequisites against `completedCourses` to show:
- "Requires CSE 20312 — **completed Fall 2024** (A)" (green)
- "Requires ECON 10010 — **not completed**" (red)

### Conflict Detection (time overlap arithmetic)

For each pair of planned sections, check if any meetings overlap:
```
conflict = (daysOverlap) && (startA < endB) && (startB < endA)
```

### Pre-check (deterministic checklist)

For a course/section, run all checks:
1. Prerequisites — parsed from restriction text, checked against audit
2. Class standing — parsed from restriction text, checked against audit classification
3. Seat availability — `seatsAvailable > 0`
4. Time conflicts — overlap check against all other planned sections
5. Repeat check — course in `completedCourses`?
6. Permission — `specialApproval != null`?

### BACS Requirement Badges

Hardcoded mapping for the demo persona:
- CS Core courses → "CS Core" badge
- CSE 30000+ courses → "CS Elective" badge (if not in core)
- Math requirements → "Math Req" badge
- University Core attributes from scraped data → "University Core" badge
- College requirements → "College Req" badge

---

## Audit Text Parser

Parses the raw text from Degree Works copy-paste. Key extraction targets:

```typescript
interface ParsedAudit {
  studentName: string;
  studentId: string;
  classification: string;     // "Senior"
  college: string;            // "College of Arts and Letters"
  major: string;              // "Computer Science (BA)"
  catalogYear: string;        // "2022"
  gpa: number;                // 3.419
  creditsRequired: number;    // 122
  creditsApplied: number;     // 134.5
  degreeProgress: number;     // 98
  completedCourses: CompletedCourse[];
  inProgressCourses: CompletedCourse[];
}

interface CompletedCourse {
  subject: string;            // "CSE"
  courseNumber: string;        // "20312"
  title: string;              // "Data Structures"
  grade: string;              // "A"
  credits: number;            // 4
  term: string;               // "Fall 2024"
  requirementBlock?: string;  // "Major in Computer Science"
  status: "completed" | "in-progress";
}
```

The parser uses line-by-line regex matching on the consistent Degree Works format. No LLM needed.

---

## What Gets Built vs Mocked vs Skipped

### Built fully (data-backed, interactive):
1. **Audit paste onboarding** — text box → parse → localStorage, "welcome back" flow if audit exists
2. **Search page** — SQL queries, subject/keyword/availability filters, eligibility badges, clickable rows navigate to course detail, "+ Plan A" quick-add button per row
3. **Course Detail** — sections table with "Select" button per section row (adds to Plan A), inline seat progress bars, prereq checks, restrictions, pre-check modal, recovery drawer
4. **Plan view** — Plan A/B/C tabs, course table with kebab dropdown (move between plans, remove), weekly calendar with side-by-side conflict layout + red conflict borders, click calendar event to highlight table row
5. **Pre-check modal** — 6-item deterministic checklist (prerequisites, class standing, seats, conflicts, repeat, permission)
6. **Export page** — Plan A/B/C tabs, per-plan diagnostics with eligibility checks, export eligible only or all
7. **Recovery drawer** — swap section (real), find alternatives (same-subject search), move to Plan B (real), permission draft (mocked)
8. **Shared state** — PlansContext + AuditContext via React Context for real-time updates across all components (sidebar, search, plan, export)

### Mocked (visible, scripted):
9. **Permission draft modal** — pre-filled text, "Send" shows toast
10. **GPS progress widget** — shows parsed credit totals from audit, static
11. **Guidance section** — hardcoded for a few demo courses

### Skipped for Sprint 3:
- User authentication
- Server-side plan persistence
- Multi-term support
- Real NOVO integration
- Waitlist monitoring
- Cross-semester planning

---

## AI / LLM Strategy

| Feature | AI needed? | Notes |
|---------|-----------|-------|
| Course search & filter | No | SQL queries |
| Eligibility status | No | Deterministic checks |
| Restriction display | No | Regex parsing, ~5 patterns |
| Conflict detection | No | Time overlap arithmetic |
| Pre-check | No | All checks deterministic |
| Requirement badges | No | Hardcoded BACS mapping |
| Audit parsing | No | Regex on structured text |
| "Why blocked" explanation | No | Template-based from check results |
| Course recommendations | Maybe later | Embeddings on descriptions |
| Policy Q&A | Unnecessary | Out of scope |

**No AI infrastructure for Sprint 3. Possibly light LLM for edge-case explanations in final product.**

---

## Sprint Plan

### Sprint 3 (current — class demo)
1. Project setup: Next.js + Prisma + Neon PostgreSQL + Tailwind
2. Prisma schema + seed script from `courses_2026_summer.json`
3. Audit text parser (client-side TypeScript)
4. Onboarding page (paste audit)
5. Search page with real data
6. Course Detail page with eligibility logic
7. Plan view + localStorage + weekly calendar
8. Pre-check modal
9. Export pre-check + result page
10. Recovery drawer + swap section
11. Visual polish to match Sprint 2 designs

### Sprint 4 (post-demo)
- Persist plans to DB, add user table
- Full restriction parsing coverage
- "Find Alternatives" with smart filtering
- Requirement badges from audit data
- Responsive design polish

### Final product
- Multi-term support (scrape Fall 2026)
- Deploy to Vercel
- User accounts + saved plans
- Optional: LLM for edge-case restriction explanations
- Optional: embeddings for "similar course" suggestions

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Calendar UI complexity | Use CSS grid, not a calendar library. Keep it simple: 5-day, hourly rows |
| Audit parser edge cases | Test with the known audit format. Fail gracefully on unparseable lines |
| Restriction parsing coverage | Regex covers ~90%. Show raw text as fallback for unmatched patterns |
| Plan state management | Keep it simple: plan = array of {courseId, sectionId}. No nested state |
| Demo polish timeline | Build data flow first, polish last. Functional > pretty for initial pass |

---

## File Structure (current)

```
registration-clarity/
├── prisma/
│   ├── schema.prisma
│   ├── seed.js              (seed script — uses pg driver against Neon)
│   ├── courses_2026_summer.json (source data)
│   └── migrations/
├── e2e/                         (Playwright end-to-end tests)
│   ├── capture-fig5-fig6.spec.ts
│   ├── capture-screenshots.spec.ts
│   ├── registration-flow.spec.ts
│   └── sprint2-screens.spec.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx       (shell: Providers + nav + sidebar + main content)
│   │   ├── page.tsx         (redirect to /search)
│   │   ├── globals.css
│   │   ├── onboarding/
│   │   │   └── page.tsx
│   │   ├── search/
│   │   │   ├── page.tsx          (server component — Prisma queries)
│   │   │   └── SearchClient.tsx  (client component — clickable rows, filters)
│   │   ├── course/
│   │   │   └── [id]/
│   │   │       ├── page.tsx              (server component — await params)
│   │   │       └── CourseDetailClient.tsx (client — sections table, pre-check, recovery)
│   │   ├── plan/
│   │   │   └── page.tsx     (Plan A/B/C tabs, course table, kebab menu, weekly calendar)
│   │   ├── export/
│   │   │   └── page.tsx     (Plan A/B/C tabs, diagnostics, export)
│   │   └── api/
│   │       └── course/[id]/
│   │           └── route.ts (API route for client-side course fetching)
│   ├── components/
│   │   ├── Navbar.tsx           (dark navy nav, PATH logo, tabs, user name)
│   │   ├── Sidebar.tsx          (term, plan counts, progress bars, GPS link)
│   │   ├── Providers.tsx        (wraps AuditProvider + PlansProvider)
│   │   ├── WeeklyCalendar.tsx   (Mon-Fri 8am-10pm, conflict layout, click-to-highlight)
│   │   ├── EligibilityBadge.tsx (color-coded status badges)
│   │   ├── PreCheckModal.tsx    (6-item checklist modal)
│   │   └── RecoveryDrawer.tsx   (bottom drawer: swap, alternatives, Plan B, permission)
│   ├── contexts/
│   │   ├── PlansContext.tsx  (shared plan state via React Context)
│   │   └── AuditContext.tsx  (shared audit state via React Context)
│   ├── lib/
│   │   ├── db.ts            (Prisma client singleton with adapter)
│   │   ├── auditParser.ts   (parse degree audit text)
│   │   ├── eligibility.ts   (compute eligibility status)
│   │   ├── restrictions.ts  (parse restriction text)
│   │   ├── conflicts.ts     (time overlap detection)
│   │   └── requirements.ts  (BACS requirement mapping)
│   ├── generated/prisma/    (auto-generated Prisma client)
│   └── types/
│       └── index.ts
├── .env                     (DATABASE_URL for Neon — gitignored)
├── prisma.config.ts
├── playwright.config.ts     (Playwright e2e test config)
├── postcss.config.mjs       (Tailwind CSS v4 PostCSS plugin)
├── eslint.config.mjs        (ESLint v9 flat config)
├── ARCHITECTURE.md          (this file)
├── IMPLEMENTATION_GUIDE.md
├── CLAUDE.md
├── AGENTS.md
├── package.json
└── tsconfig.json
```
