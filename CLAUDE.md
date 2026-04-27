@AGENTS.md

# Registration Clarity, Agent Guide

A Next.js 16 / React 19 prototype that helps Notre Dame undergraduates plan registration: parse a pasted Degree Works audit, search the course catalog, check eligibility/restrictions, and build a weekly schedule. See `ARCHITECTURE.md` for the full design rationale.

## Stack snapshot

- **Next.js 16.2** (App Router) with **React 19.2** and **Turbopack** dev server
- **TypeScript** strict, **Tailwind CSS 4** (PostCSS plugin), **ESLint 9** flat config
- **Prisma 7** with `@prisma/adapter-pg` against **Neon PostgreSQL**
  - Generated client output: `src/generated/prisma` (not `node_modules/.prisma`); import from there
- **Playwright** for e2e, **`tsx --test`** (node:test) for unit tests
- No auth; user state (audit, plan) lives in `localStorage`

> Versions are recent and the public APIs may differ from your training data. Next 16, Prisma 7, React 19, and Tailwind 4 all have breaking changes. Read `node_modules/next/dist/docs/` and the relevant package's docs before writing code.

## Layout

```
src/
  app/                    # App Router routes
    api/course/[id]/      # Course detail JSON endpoint
    onboarding/           # Paste-audit flow
    search/               # Catalog search (server + SearchClient)
    course/[id]/          # Course detail page
    plan/                 # Weekly schedule builder
    layout.tsx, page.tsx, error.tsx, global-error.tsx, loading.tsx
  components/             # Navbar, Sidebar, Toast, WeeklyCalendar, EligibilityBadge, PreCheckModal, RecoveryDrawer, Providers
  contexts/               # React context providers
  hooks/                  # Custom hooks
  lib/
    auditParser.ts        # Degree Works text to structured audit
    conflicts.ts          # Time-conflict detection
    eligibility.ts        # Prereq/coreq/restriction checks
    requirements.ts       # BACS major requirements (hardcoded)
    restrictions.ts       # Registration restriction parsing
    guidance.ts           # Plain-language explanations
    fetchCourse.ts        # Validated client fetcher
    db.ts                 # Prisma client singleton (uses adapter-pg)
    rateLimit.ts          # In-memory rate limiter for API routes
    schemas.ts            # Zod-style validators
    localStore.ts         # Typed localStorage wrapper
    __tests__/            # Unit tests (run via tsx --test)
  generated/prisma/       # Generated Prisma client (committed)
prisma/
  schema.prisma           # Course, Section, Meeting, Instructor
  seed.js                 # Loads courses_2026_summer.json into Neon
  courses_2026_summer.json
e2e/                      # Playwright specs (registration flow + screenshot capture)
docs/                     # Sprint docs, gap analyses, code analysis
```

## Commands

```bash
npm run dev               # Next dev (Turbopack)
npm run build             # prisma generate && next build
npm run lint              # eslint
npm run typecheck         # tsc --noEmit
npm run test:unit         # tsx --test src/lib/__tests__/*.test.ts
npm run db:seed           # node prisma/seed.js (needs DATABASE_URL)
npm run db:migrate:dev    # prisma migrate dev
npm run db:migrate:deploy # prisma migrate deploy
npx playwright test       # e2e (Playwright config at repo root)
```

`DATABASE_URL` (Neon Postgres) is required for build (`prisma generate` runs first) and runtime. See `.env.example`.

## Conventions and gotchas

- **Prisma client import path is `src/generated/prisma`**, not `@prisma/client`. The schema sets `output = "../src/generated/prisma"` and `db.ts` wires it up with `@prisma/adapter-pg`.
- **Neon, not SQLite.** SQLite was used early but is incompatible with Vercel's ephemeral filesystem. Don't reintroduce file-based DBs.
- **No auth, no server-side user state.** Audit and plan are persisted client-side in `localStorage` via `lib/localStore.ts`. Adding server persistence is a real architecture change, so confirm scope first.
- **Audit parsing is deterministic regex** over Degree Works text. Don't swap in an LLM parser without discussion. The format is stable and tests assume regex behavior.
- **Major requirements (BACS) are hardcoded** in `lib/requirements.ts`. Adding new majors means extending that module, not generalizing it speculatively.
- **API routes apply rate limiting** via `lib/rateLimit.ts` and validate inputs with `lib/schemas.ts`. Keep both when adding endpoints.
- **Tests live in `src/lib/__tests__`** and use the built-in `node:test` runner via `tsx`. Don't add Jest/Vitest without a reason.
- **Playwright specs in `e2e/`** include screenshot-capture specs used for sprint deliverables, so be careful not to delete them when refactoring.
- **Demo persona** is "Alex Murphy" (BACS student); real audit data is anonymized to that name. Don't surface real student names in fixtures or screenshots.

## Before writing code

1. Read the relevant Next.js 16 docs in `node_modules/next/dist/docs/`. App Router, route handlers, and caching semantics have shifted.
2. For DB work, check `prisma/schema.prisma` and `lib/db.ts` first; the adapter-pg setup is non-default.
3. For UI changes, check `ARCHITECTURE.md` for the Sprint 2 design system Tailwind classes are matched against.
4. Run `npm run typecheck` and `npm run test:unit` before declaring a task done. For UI work, also exercise the affected page in `npm run dev`.

## Writing and commit style

- Do not add Claude attribution to commits or PRs. No `Co-Authored-By: Claude`, no "Generated with Claude Code" footer, no trailers identifying the agent.
- Do not use em dash or en dash in code, comments, commit messages, PR descriptions, or docs. Use a comma, colon, parentheses, or two sentences instead.

## Out of scope (don't propose without asking)

- Adding auth or user accounts
- Migrating off Neon or Prisma
- Replacing the regex audit parser with an LLM
- Generalizing requirements beyond BACS
- Introducing a state library (Redux/Zustand). Local state plus `localStorage` is intentional.
