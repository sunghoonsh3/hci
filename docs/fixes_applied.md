# 수정 내역 (potential_issues.md 기준)

작성일: 2026-04-19. `docs/potential_issues.md`의 27개 항목 중 26개를 수정했으며, 검증: `tsc --noEmit` 통과, `eslint` 에러 0건, `tsx --test` 25/25 통과.

## 새로 추가된 인프라

| 파일 | 목적 |
|---|---|
| `src/lib/schemas.ts` | Zod 스키마: Course/Section/Meeting/PlanEntry/ParsedAudit |
| `src/lib/fetchCourse.ts` | 검증된 fetcher + AbortSignal + `fetchCourses` 배치 |
| `src/lib/rateLimit.ts` | 인메모리 토큰 버킷 + `clientIp` 헬퍼 |
| `src/hooks/useToast.ts` | cleanup-safe 토스트 훅 (undo, variant, dismiss) |
| `src/components/Toast.tsx` | 공용 토스트 UI (role="status", aria-live) |
| `src/app/error.tsx` | 세그먼트 에러 바운더리 (`unstable_retry`) |
| `src/app/global-error.tsx` | 루트 에러 바운더리 |
| `src/app/loading.tsx` | 기본 로딩 스켈레톤 |
| `src/lib/__tests__/*.test.ts` | eligibility/conflicts/restrictions/auditParser 유닛 테스트 |
| `.env.example` | DATABASE_URL 템플릿 |

## 이슈별 대응

### Critical
1. **Sidebar 무한 fetch 루프** — `courseNames`를 deps에서 제거, `useRef<Set<number>>`로 in-flight 추적, `AbortController`로 언마운트 시 취소.
2. **Promise 체인의 조용한 null** — 모든 페치가 `fetchCourse`/`fetchCourses`로 통합되어 `res.ok` 확인 + Zod 검증 후 null 반환, export 페이지는 로드 실패 시 toast 경고.
3. **setTimeout 클린업 누락** — 모든 토스트가 `useToast` 훅으로 이동(timer ref + unmount cleanup). `RecoveryDrawer`의 "Sent!" 타이머도 ref 기반으로 교체.
4. **onboarding `window.location.reload()`** — `clearAudit()` + `clearAll()` 호출로 대체, confirm 다이얼로그로 사용자 의도 확인.

### High
5. **선수과목 정규식** — 괄호 없는 `"Prerequisites: CSE 20312"` 케이스 처리, 배열 값 타입 가드, dedupe. 유닛 테스트 6건으로 회귀 방지.
6. **null seats eligibility** — sections 배열이 빈 경우 `"unknown"` 반환. null seat는 “열려있음”으로 유지(기존 로직 보존).
7. **localStorage Zod 검증** — `AuditContext`/`PlansContext`가 `safeParse` 후 실패 시 스토리지 삭제 + 콘솔 경고.

### Medium
8. **API 레이트 리밋** — `/api/course/[id]`에 IP별 120req/min 버킷 + `Retry-After` 헤더 + `Cache-Control: private, max-age=60`.
9. **Search N+1 직렬화** — `findMany`가 `select` 사용해 필요한 필드만 반환. `JSON.parse(JSON.stringify(...))` 제거.
10. **ErrorBoundary 부재** — `app/error.tsx`, `app/global-error.tsx`, `app/loading.tsx` 추가. Next 16.2 `unstable_retry` prop 사용.
11. **ARIA 라벨** — Sidebar/Navbar/PreCheckModal/RecoveryDrawer/Plan 드롭다운 아이콘 버튼 전부 `aria-label` 부여. 이모지는 `aria-hidden="true"`.
12. **키보드 내비게이션** — 드롭다운 `aria-haspopup`/`aria-expanded`, Escape로 close + 포커스 복귀. 모달 Escape 핸들러.
13. **인라인 구조 타입** — 모든 fetch 결과가 `CourseDTO` (Zod 추론)로 통일. 인라인 `{ id: number }` 제거.
14. **플랜 간 중복 섹션** — `PlansContext`에 `findSlotsForSection` 추가. Search/CourseDetail/Plan 페이지에서 추가 시 "(also in Plan X)" 토스트 경고.
15. **useEffect deps 배열 참조** — Plan/Export에 `planIdsKey = ids.sort().join(",")` stable string으로 교체.
16. **Prisma 마이그레이션** — `db:migrate:dev`, `db:migrate:deploy` 스크립트 추가 (수동 실행 권장).
17. **Seed 스크립트** — `db:seed` 별도 스크립트로 문서화.
18. **로드 UI 일관성** — `app/loading.tsx` 스켈레톤 추가 + 각 페이지의 "Loading…" 문구 다듬음.
19. **HTTP 상태 확인** — `fetchCourse`가 `res.ok` 체크, dev 환경에서 `console.warn`.

### Low
20. **하드코딩 guidance** — 대상 과목 아닐 때 "No advisor guidance available for this course yet." 대체 안내.
21. **한국어 i18n** — 제품 결정 필요 판단으로 적용 보류 (작성 필요 범위가 대화와 별개의 제품 변경).
22. **.env.example** — 추가 완료.
23. **JSON.parse 반복** — `parseDays` 헬퍼 통일 + `useMemo`로 파생 상태 캐싱.
24. **색 대비** — `text-gray-400/500` → `gray-600/700/800`, `text-red-500` → `red-700`, `green-600` → `green-700/800`으로 WCAG AA 상향.
25. **Undo 토스트** — `useToast.show(..., { undo })` + `Toast` 컴포넌트에서 Undo 버튼 노출. Add/Remove/Move 액션 모두 적용.
26. **이모지 로고** — `aria-hidden="true"` + Link에 `aria-label="PATH — Registration Clarity home"`.
27. **유닛 테스트** — `node:test` + `tsx` 기반 25개 테스트 추가. `npm run test:unit`.

## 검증

```bash
npm run typecheck    # ✅ no errors
npm run lint         # ✅ 0 errors (기존 e2e 파일의 unused-var 경고 2건만 잔존)
npm run test:unit    # ✅ 25/25 통과
```

## 참고

- `package.json` 스크립트 확장: `typecheck`, `test:unit`, `db:seed`, `db:migrate:dev`, `db:migrate:deploy`.
- `eslint.config.mjs`에 `src/generated/**` 및 `prisma/seed.js` globalIgnores 추가 (Prisma 생성 코드 및 기존 Node 스타일 시드 스크립트).
- Next 16.2 API: error 바운더리에서 `unstable_retry` prop 사용 (README는 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md` 참조).
- Zod v4.3 전역 의존성이 이미 설치되어 있어 별도 패키지 추가 없음.
