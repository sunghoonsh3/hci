# 코드 잠재 문제점 분석 보고서 — Sprint 3 Gap Audit

> 작성일: 2026-04-20
> 기준: `docs/sprint3/sprint3_document.md` Figure 9 (Heuristic Evaluation Table) 및 `docs/sprint3/sprint3_additions.md`의 추가 2건
> 목적: 문서에 "수정 예정(Revising Plan)"으로 명시된 10개 항목 중 **현재 배포 코드에서 아직 충족하지 못한 부분**만 정리.
>
> 내부 리팩터링 이력(1~3차): `docs/fixes_applied.md`

---

## 1. 충족 상태 요약 (업데이트)

| # | 문제 (Sprint 3 Figure 9 / additions) | Severity | 상태 | 증빙 |
|---|---|---|---|---|
| S1 | Sidebar가 "Course #123" 플래시 후 이름 로드 | 2 | ✅ 수정 | `PlanEntry`에 `subject`/`courseNumber`/`courseTitle` 힌트 필드 추가, `addToPlan(hint)`, Sidebar/Plan이 힌트 우선 사용 |
| S2 | "Open seats only"가 Search 버튼 필요, 다른 두 체크박스는 즉시 적용 | 2 | ✅ 수정 | `search/page.tsx`의 prisma 필터 제거, `SearchClient.displayCourses` useMemo에서 client-side 적용 |
| S3 | Plan 테이블 "Remove" 시 Undo 없음 | 3 | ✅ 수정 | `handleRemove`가 `show(..., { undo })` |
| S4 | Search의 빈 Weekly Schedule에 설명 없음 | 2 | ✅ 수정 | `WeeklyCalendar.emptyMessage` prop + 페이지별 문구 (Search/Plan/Export) |
| S5 | "Join Waitlist"가 브라우저 `alert()` | 3 | ✅ 수정 | toast `show(...)` 사용 (추가로 `trackUnread: false` 지정) |
| S6 | Pre-check modal 오버레이 클릭으로 닫히지 않음 | 1 | ✅ 수정 | outer onPointerDown with target === currentTarget |
| S7 | Course Path / Guidance가 일부 과목에만 표시, 안내 없음 | 2 | ✅ 수정 | Course Path에도 "Course path data not yet available…" placeholder 추가 (Guidance와 동일 패턴) |
| S8 | Search "Seats" 합산만 표시 | 2 | ✅ 수정 | `sectionSummary()` + "N of M open" / "All sections full" 보조 라인 |
| A1 | Plan 테이블 행 로딩이 "Loading..." 텍스트 뿐 | 1 | ✅ 수정 | 코스/타이틀/크레딧/상태/Reqs 셀이 `animate-pulse` 회색 바로 교체 |
| A2 | Toast 3초 후 사라지고 다시 볼 방법 없음 | 1 | ✅ 수정 | `DEFAULT_DURATION=5000`, `unreadCount`/`markRead` 노출, Navbar Plan 탭 배지, Plan 방문 시 클리어 |

충족 10 / 부분 0 / 미충족 0. Sprint 3 Heuristic Evaluation에서 명시된 모든 revision plan이 현재 코드에 반영됨.

검증:
```bash
npm run typecheck    # ✅ no errors
npm run lint         # ✅ 0 errors (기존 e2e unused-var 경고 2건만 잔존)
npm run test:unit    # ✅ 36/36 통과
```

---

## 2. 구현 요약

### S1 — 낙관적 코스명 렌더 (Sidebar/Plan "Course #ID" 플래시 제거)
- `PlanEntry` / `PlanEntrySchema`에 optional `subject`, `courseNumber`, `courseTitle` 필드 추가.
- `PlansContext.addToPlan(courseId, sectionId, slot, hint?)` 시그니처 확장, 힌트는 그대로 localStorage에 저장.
- 호출부(SearchClient, CourseDetailClient, RecoveryDrawer, Plan 페이지 undo)가 동작 시점에 가진 코스 메타를 그대로 전달.
- Sidebar / Plan 테이블 렌더는 힌트를 우선 사용. Sidebar의 `/api/course/{id}` fetch는 힌트가 없는 legacy 엔트리 fallback 전용으로 유지.

### S2 — "Open seats only" client-side 이전
- `src/app/search/page.tsx`의 prisma 레벨 `filter` 제거, 항상 전체 목록 반환.
- `SearchClient.displayCourses` useMemo에 `openOnly` 분기 추가(`coreOnly`/`majorOnly`와 동일 레이어).
- 체크박스 토글이 즉시 적용되면서 URL의 `?open=true`는 북마크용으로 유지.

### S4 — Weekly Schedule Empty State
- `WeeklyCalendar`에 `emptyMessage?: string` prop 추가. events가 0일 때 role=note, aria-live=polite 오버레이 렌더.
- 페이지별 메시지:
  - Search: "Add courses to your plan to see them on the schedule."
  - Plan: `No courses in Plan {slot} yet.` / 전체 플랜 모드일 때는 "No courses planned across any slot yet."
  - Export: `No courses in Plan {slot} yet.`

### S7 — Course Path placeholder
- 섹션 헤더는 항상 렌더. `coursePath`가 null이면 "Course path data not yet available for this course." italic fallback.
- Guidance 섹션(이미 적용되어 있던 fallback)과 동일 패턴.

### S8 — Sections-open indicator
- `sectionSummary(course)` → `{ avail, max, openSections, total }`.
- Seats 셀을 2행 구조로: 상단 `12/50`, 하단 `1 of 3 open` / `All sections full` (전체 full이면 빨간색).

### A1 — Plan 테이블 row 스켈레톤
- 코스/타이틀/크레딧/상태/Reqs 각 셀에 `animate-pulse` 회색 바 fallback.
- 힌트가 있으면 즉시 코스명 표시, 미 도착 셀만 스켈레톤으로 교체.

### A2 — Toast 5초 + Plan 탭 배지
- `DEFAULT_DURATION`: 4000 → 5000.
- `ToastContext`에 `unreadCount: number`, `markRead(): void` 추가.
- 모든 `show()` 호출이 기본적으로 `unreadCount`를 +1. "Waitlist submitted"처럼 상태 변화가 아닌 경우에는 `{ trackUnread: false }`로 제외.
- Navbar의 Plan 링크에 노란색 배지 (`#C99700` on navy) 렌더. `aria-label`에 숫자 포함.
- Plan 페이지 마운트 시 `markRead()` 호출하여 배지 클리어.

---

## 3. 향후 고려 사항 (Sprint 3 문서 범위 밖)

- **Toast 히스토리 뷰어**: 현재는 배지 숫자만 노출. 추후 클릭 시 최근 5건을 드롭다운으로 보여주는 UI를 붙이면 "무엇이 새로 추가됐는지 다시 볼 방법"이 더 명확해짐.
- **WeeklyCalendar empty 상태 아이콘**: 현재는 순수 텍스트. 작은 달력 아이콘을 추가하면 시각적 인식이 더 빨라짐.
- **Sections-open indicator 정렬**: 추후 search 결과를 "열린 섹션 많은 순" 정렬 옵션 추가 고려.
- **Hint 마이그레이션**: 기존 사용자의 localStorage에 저장된 엔트리는 힌트 필드가 비어 있음. Sidebar는 fallback fetch로 보완하지만, Plan 테이블도 상위 `fetchCourses`가 완료되기 전까진 skeleton. 필요하면 context mount 시 force-refetch + rewrite로 일괄 업그레이드 가능.

## 4. 참고

- Sprint 3 본문: `docs/sprint3/sprint3_document.md`
- Sprint 3 추가 평가 항목: `docs/sprint3/sprint3_additions.md`
- 이전 라운드 수정 이력: `docs/fixes_applied.md`
- 아키텍처: `ARCHITECTURE.md`
- AGENTS.md: Next.js 16 breaking change 주의 — 수정 전 `node_modules/next/dist/docs/` 확인.
