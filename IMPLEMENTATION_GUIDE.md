# Registration Clarity — Implementation Guide

## Context

This is an HCI Sprint 3 project for Notre Dame. Full architecture decisions are documented in `/Users/tristanshin/Downloads/digging-scraper/ARCHITECTURE.md`. The Sprint 2 PDF mockups are at `/Users/tristanshin/Downloads/digging-scraper/HCI Demo Sprint 2.pdf` (21 pages of high-fidelity screen designs).

**Project:** Registration Clarity at Notre Dame — redesigned PATH-to-NOVO course planning & registration workflow.
**Demo persona:** BACS (BA Computer Science) student. Real audit data, display name "Alex Murphy".
**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS + Prisma + Neon PostgreSQL.
**Deployed:** Vercel — https://hci-opal-sigma.vercel.app (auto-deploys from `main` branch).
**Working directory:** `/Users/tristanshin/Downloads/registration-clarity`
**Node.js:** Installed via nvm (v24 LTS). Always run: `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"` before any node/npm/npx commands.

---

## What Is Done

All steps (1–10) are now implemented and functional. See details below.

### 1. Project Setup ✅
- Next.js 16.2.2 (App Router, Turbopack) with TypeScript, Tailwind, src directory
- Prisma 7.6.0 with Neon PostgreSQL via `@prisma/adapter-pg`
- Deployed to Vercel (auto-deploys from GitHub `main` branch)
- Dev server on localhost:3000

### 2. Database Schema & Seeding ✅
- Four tables: Course, Section, Meeting, Instructor (see `prisma/schema.prisma`)
- Seed script: `prisma/seed.js` (uses `pg` driver directly against Neon)
- **569 courses, 1179 sections, 1434 meetings, 1251 instructors**
- Database hosted on Neon (AWS US East 1), connection string in `.env` (gitignored) and Vercel env vars

### 3. Prisma Client ✅
- Generated at `src/generated/prisma/` — import from `@/generated/prisma/client` (not `/prisma`)
- DB singleton at `src/lib/db.ts` using `PrismaPg` adapter from `@prisma/adapter-pg` (Prisma 7 requires adapter, not zero-arg constructor)
- `prisma generate` runs as part of the build command for Vercel (`"build": "prisma generate && next build"`)

### 4. Types & Utility Libraries ✅
- `src/types/index.ts` — CompletedCourse, ParsedAudit, PlanEntry, EligibilityStatus, PlanSlot, etc.
- `src/lib/auditParser.ts` — regex parser for Degree Works paste
- `src/lib/eligibility.ts` — deterministic status computation (order: already-taken → full → restricted → needs-prereq → eligible), accepts `hasAudit` parameter
- `src/lib/restrictions.ts` — 5 regex patterns, prereq cross-referencing
- `src/lib/conflicts.ts` — time overlap detection
- `src/lib/requirements.ts` — hardcoded BACS requirement mapping

### 5. Shared State (React Context) ✅
- `src/contexts/PlansContext.tsx` — shared plan state, localStorage-backed
  - Plan entries keyed by **sectionId** (not courseId) — allows multiple sections of same course
  - Functions: `addToPlan`, `removeFromPlan(sectionId, slot)`, `moveToPlan(sectionId, from, to)`, `isInPlan`, `isSectionInPlan`
- `src/contexts/AuditContext.tsx` — shared audit state, localStorage-backed
- `src/components/Providers.tsx` — wraps both providers, used in layout.tsx
- `src/hooks/usePlans.ts` and `useAudit.ts` have been **deleted** — all components import from contexts directly

### 6. App Shell ✅
- `src/app/layout.tsx` — root layout wraps body with `<Providers>`, includes Navbar + Sidebar + main
- `src/components/Navbar.tsx` — dark navy (#0C2340), PATH logo, Search/Plan/Export tabs, "Alex Murphy"
- `src/components/Sidebar.tsx` — term display, Plan A/B/C tabs with real-time counts, progress bars (when audit loaded), GPS "Import Degree Audit" link to /onboarding

### 7. All Pages ✅
- **Onboarding** (`/onboarding`) — paste audit, parse, "welcome back" if audit exists
- **Search** (`/search`) — server component queries Prisma, client component renders scrollable table with sticky header. Entire rows are clickable (navigate to course detail). Has a "+ Plan A" quick-add button in the Actions column (with `stopPropagation` to not trigger row click).
- **Course Detail** (`/course/[id]`) — server component uses `await params` (Next.js 16 async params). Client component shows: header with eligibility badge, description, prereq checks, restrictions, requirement badges, sections table with **"Select" button per section row** (adds to Plan A) and **inline seat progress bars**. Pre-check modal and recovery drawer.
- **Plan** (`/plan`) — Plan A/B/C tabs, course table with section column, kebab dropdown menu (move to other plans, remove). Weekly calendar with **side-by-side conflict layout** and **red conflict borders**. Click calendar event to highlight corresponding table row (uses `onPointerDown` for Safari compatibility). "Show all plans on calendar" checkbox.
- **Export** (`/export`) — **Plan A/B/C tabs** (not just Plan A), per-plan diagnostics table with eligibility status and diagnosis column, summary banner, export eligible or all.

### 8. Components ✅
- `WeeklyCalendar.tsx` — Mon-Fri 8am-10pm, scrollable, CSS grid. Side-by-side column layout for overlapping events. Red border + ring on conflicts. Click-to-highlight with dimming of non-highlighted events. Uses `onPointerDown` (not `onClick`) for Safari compatibility. `transition-opacity` (not `transition-all`) to avoid Safari layout thrashing.
- `EligibilityBadge.tsx` — color-coded badges (green/red/yellow/orange/gray)
- `PreCheckModal.tsx` — 6-item checklist (prereqs, class standing, seats, conflicts, repeat, permission)
- `RecoveryDrawer.tsx` — bottom drawer with swap section, find alternatives, move to Plan B, permission draft

### 9. API Routes ✅
- `src/app/api/course/[id]/route.ts` — returns course data with sections/meetings/instructors for client-side fetching (used by plan and export pages)

### 10. E2E Tests ✅
- Playwright e2e tests in `e2e/` directory, configured via `playwright.config.ts`
- Tests run against deployed Vercel URL (`https://hci-opal-sigma.vercel.app`)
- 4 spec files: `registration-flow.spec.ts`, `sprint2-screens.spec.ts`, `capture-screenshots.spec.ts`, `capture-fig5-fig6.spec.ts`
- Chromium-only, headless, screenshots on failure
- Dev dependency: `@playwright/test@^1.59.1`

---

## Important Technical Notes

### Next.js 16 Breaking Changes
- `params` and `searchParams` are **Promises** — must use `await params` in server components
- Check `node_modules/next/dist/docs/` for current API docs before writing new code

### Prisma 7 Breaking Changes
- `PrismaClient` requires `adapter` option — cannot use zero-arg constructor
- Import from `@/generated/prisma/client` (not `@/generated/prisma`)
- Adapter: `PrismaPg` from `@prisma/adapter-pg` with `connectionString` from `process.env.DATABASE_URL`
- `datasource` block in `schema.prisma` must NOT have `url` — connection URL goes in `prisma.config.ts` (for migrations) and adapter constructor (for runtime)

### Deployment (Vercel + Neon)
- GitHub repo: `sunghoonsh3/hci` — Vercel auto-deploys on push to `main`
- `DATABASE_URL` env var set in Vercel project settings (same value as local `.env`)
- `pg` listed in `serverExternalPackages` in `next.config.ts` (required for Node.js runtime on Vercel)
- Prisma client is gitignored and regenerated during build via `"build": "prisma generate && next build"`

### Safari Compatibility
- Calendar events use `onPointerDown` with `e.preventDefault()` instead of `onClick` to prevent double-fire on DOM re-render
- Use `transition-opacity` not `transition-all` on elements that change opacity to avoid layout thrashing

### Plan Data Model
- Plan entries are keyed by **sectionId + planSlot** (not courseId)
- Multiple sections of the same course can exist in the same or different plans
- `removeFromPlan` and `moveToPlan` take `sectionId` (not `courseId`)
- `isInPlan(courseId)` checks course-level, `isSectionInPlan(sectionId)` checks section-level

---

## Potential Future Enhancements

These are not yet built. Prioritize based on demo needs.

- ~~**Time conflict check in pre-check modal**~~ — now wired up: `conflicts.ts` checks against planned section meetings, shows "Conflicts with {course}" or "No conflicts with current plan".
- ~~**Sidebar course names**~~ — now fetches course data and shows "CSE 20311" instead of IDs (falls back to "Course #123" while loading).
- **Responsive design** — currently desktop-only (1440x900 reference). Could add mobile breakpoints.
- **"Find Alternatives" in recovery drawer** — navigates to search filtered by subject. Could be smarter (same requirement badge, similar level).
- **Real time conflict detection on add** — warn when adding a section that conflicts with existing plan entries.
- **Waitlist support** — show waitlist position, "Join Waitlist" action for full sections.
- **Multi-term support** — currently hardcoded to Summer 2026.
- **Course recommendations** — embeddings on descriptions for "similar course" suggestions.
- **User auth + server-side plans** — replace localStorage with DB persistence.

### Sprint 5 — User Accounts & Requirement Management

- **Login & user profiles** — add authentication (login/signup page) so each user has a persistent account. Migrate plan and audit data from localStorage to server-side DB storage tied to the user.
- **PDF degree audit upload** — replace the current copy-paste audit flow with PDF upload on the profile/onboarding page. Parse the GPS (degree progress) PDF server-side and persist the extracted data per user. Track audit history so users can re-upload when progress changes.
- **Editable college requirements** — allow users to upload or manually configure their college/major requirements (e.g. BACS, ECON, etc.) from their profile page. Replace the current hardcoded BACS requirement mapping in `src/lib/requirements.ts` with per-user requirement sets stored in the DB.
- **Onboarding gate** — require both steps (audit upload + requirement configuration) before the user can access Search, Plan, or Export. Show a guided onboarding flow for new users.

---

## Design Reference

Sprint 2 mockups (21 pages) at: `/Users/tristanshin/Downloads/digging-scraper/HCI Demo Sprint 2.pdf`

Key screens by page number:
- Page 1: Course detail — Restricted status
- Page 2: Course detail — Needs Prerequisite
- Page 3: Course detail — Already Taken
- Page 4: Course detail — Eligible (full layout with sidebar, calendar, sections, requirements, guidance)
- Page 5: Plan view
- Page 6: Search results (default)
- Page 7: Added to Plan toast
- Page 8: Pre-check modal
- Page 9: Export Result (partial)
- Page 10: Export Pre-check modal
- Page 11: Full course detail (default)
- Page 12: Full course — Register Blocked banner (richest screen)
- Page 13: Search — Alternatives view
- Page 14: Swap Section dialog
- Page 15: Export Result (full success)
- Page 16: Plan — Show All Plans calendar
- Page 17-18: Duplicate of 11-12
- Page 19: Recovery Drawer
- Page 20: Permission Draft panel
- Page 21: Duplicate of 14

---

## Key Design Decisions

1. **Plans in localStorage** — no auth, no DB persistence for Sprint 3. Plans only persist within the same browser (not across devices/browsers/incognito). Sprint 5 will migrate to DB.
2. **Plans are section-level** — keyed by sectionId, not courseId. Multiple sections of same course allowed.
3. **Audit in localStorage** — parsed from copy-paste text, no PDF parsing
4. **Eligibility is deterministic** — computed from section data + audit data, no AI. Order: already-taken → full → restricted → needs-prereq → eligible. Accepts `hasAudit` param to skip audit-dependent checks when no audit loaded.
5. **Restrictions parsed with regex** — 5 patterns cover 90%, raw text fallback
6. **BACS requirements hardcoded** — CS core, electives, math reqs
7. **No AI/LLM/RAG** — everything is deterministic for Sprint 3
8. **Semester:** Summer 2026 (that's what the scraped data covers)
9. **Demo persona:** real audit data from Tristan Shin (CS BA senior, 134.5 credits, 3.419 GPA), displayed as "Alex Murphy"
10. **Shared state via React Context** — PlansContext + AuditContext (not standalone hooks). All components read from context for real-time updates across sidebar, search, plan, export.
11. **Search has quick-add** — entire row is clickable (navigates to course detail), plus a "+ Plan A" button in the Actions column for fast adds
12. **Calendar uses onPointerDown** — not onClick, for Safari compatibility
13. **Calendar conflicts shown side-by-side** — Google Calendar-style column layout + red borders, not overlapping

---

## Student Audit Data (for testing the parser)

The raw text for the demo persona was provided in conversation. Key facts:
- Senior, College of Arts and Letters, Computer Science (BA), Catalog Year 2022
- 134.5 credits applied, 122 required, 3.419 GPA, 98% degree progress
- Completed CS courses: CSE 20110, 20311, 20312, 20289, 30151, 40175, 30872, 40693, 40883, 40923
- In-progress: CSE 40113, CSE 40424
- Completed math: MATH 10550, 10560, 20550, 20580
- All university core mostly complete, college requirements mostly complete

---

## Running the Project

```bash
# Always load nvm first
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /Users/tristanshin/Downloads/registration-clarity

# Dev server
npm run dev

# Regenerate Prisma client after schema changes
npx prisma generate

# Re-seed database (seeds remote Neon DB)
node prisma/seed.js

# Push schema changes to Neon (no migration files)
npx prisma db push

# New migration after schema changes
npx prisma migrate dev --name description
```

### Deploying

Push to `main` — Vercel auto-deploys. No manual steps needed.

```bash
git push origin main
```

If you need to update the Neon connection string, change it in:
1. Local `.env` file
2. Vercel project settings → Environment Variables → `DATABASE_URL`