# 코드 잠재 문제점 분석 보고서 (3차)

> 작성일: 2026-04-20 (2차 이슈 전부 수정 후 재검토)
> 이전 수정 내역: `docs/fixes_applied.md`

---

## 1. 2차 이슈 처리 요약

직전 리포트의 Medium 6 / Low 11 중 **16건 수정 완료**, 1건(`L6 i18n`)만 제품 결정 대기.

| 이슈 | 상태 | 커밋 증빙 |
|---|---|---|
| M1 Export `"unknown"` 오분류 | ✅ 수정 | `isRegisterable(status)` 공유 헬퍼로 전환 |
| M2 Detail/Export 블로킹 규칙 불일치 | ✅ 수정 | 동일 헬퍼 공유 + `registrationBlockedReason` |
| M3 `extractPrereqCourses` 과잉 추출 | ✅ 수정 | `extractPrereqGroups`로 AND/OR 구조 보존 + 코어퀴지트 스킵 |
| M4 인메모리 레이트 리미터 한계 | ✅ 문서화 | `rateLimit.ts` 상단 주석에 Upstash/Firewall 대안 명시 |
| M5 모달 focus trap 부재 | ✅ 수정 | `useFocusTrap` 훅으로 PreCheckModal/RecoveryDrawer Tab 사이클 + 원 포커스 복원 |
| M6 tab/menu 화살표 키 | ✅ 수정 | `cycleIndex` 유틸 + Sidebar/Plan/Export tablist + RowMenu roving tabindex |
| L1 토스트 컴포넌트별 독립 상태 | ✅ 수정 | `ToastProvider`로 전역화, 단일 `<Toast>` 렌더 |
| L2 `course/[id]/page.tsx` JSON.parse 직렬화 | ✅ 수정 | Prisma `select`로 필드 명시, 직렬화 hack 제거 |
| L3 하드코딩 guidance/paths | ✅ 수정 | `src/lib/guidance.ts`로 이관 (DB 이관 TODO 명시) |
| L4 `clientIp` "unknown" 버킷 공유 | ✅ 수정 | 다중 헤더 fallback + production에선 null 시 400 |
| L5 `set-state-in-effect` suppress | ✅ 수정 | `useSyncExternalStore` + `createLocalStore` 유틸 |
| L6 한국어 i18n | ⏸️ 보류 | 제품 결정 필요 |
| L7 검색 569행 전량 렌더 | ✅ 수정 | 페이지네이션(50건) + Load more |
| L8 클라이언트 캐시 누적 | ✅ 수정 | 모든 courseMap/courseNames를 plans 기반 prune |
| L9 루트 세그먼트만 error/loading | ✅ 수정 | `/search`, `/plan`, `/export`, `/course/[id]`, `/onboarding`에 각각 추가 |
| L10 `fetchCourse` 에러 구분 불가 | ✅ 수정 | `fetchCourseResult` discriminated union + Export에서 원인별 토스트 |
| L11 tsconfig `target: ES2017` | ✅ 수정 | ES2022로 상향 |

검증:
```bash
npm run typecheck    # ✅ no errors
npm run lint         # ✅ 0 errors (기존 e2e unused-var 경고 2건만 잔존)
npm run test:unit    # ✅ 36/36 통과
```

---

## 2. 이번 라운드 검토에서 확인한 남은/새 이슈

### 🟡 Medium

#### M1. ToastProvider의 단일 슬롯 정책 — 빠른 연속 액션 시 정보 손실
**파일:** `src/contexts/ToastContext.tsx:55-70`

- `show()` 호출 시 이전 토스트를 즉시 대체. 사용자가 빠르게 여러 과목을 추가하면 마지막 토스트만 보임.
- Undo가 중첩되면 직전 작업만 복구 가능 → 사용자가 여러 작업을 연쇄 취소할 수 없음.
- **수정안:** 큐 방식(최대 3개 스택 렌더) 또는 "3개 일괄 추가됨" 형태로 메시지 묶기.

#### M2. `computeEligibility`의 `hasAudit` 기본값이 오해 소지
**파일:** `src/lib/eligibility.ts:10-16`

```ts
hasAudit: boolean = completedCourses.length > 0,
```

- `audit`가 있지만 `completedCourses`가 빈 배열인 신입생 시나리오에서 `hasAudit=false`로 간주되어 선수과목/이미수강 체크가 스킵됨.
- 현재 모든 callers가 `!!audit` 또는 별도 플래그를 명시적으로 넘기므로 실무 영향은 제한적이지만, 기본값 로직이 트랩이 될 수 있음.
- **수정안:** 기본값 제거 후 필수 인자로 변경.

#### M3. Prereq 파서가 여전히 문장 구조에 취약
**파일:** `src/lib/restrictions.ts:92-114`

- `extractPrereqGroups`는 단순 split("and")/split("or") 기반. "A and (B or C and D)" 같은 복합 중첩, "at least 6 credits of CSE" 같은 자연어, "sophomore standing" 같은 비과목 조건은 놓침.
- 대부분의 실제 데이터엔 충분하지만, 프로덕션 전에 데이터 샘플 10~20건 수동 검증 필요.
- **수정안:** 실제 데이터 샘플로 회귀 테스트 확장, 필요 시 PEG/ANTLR 기반 파서로 교체.

#### M4. `clientIp`가 spoofable 헤더에 의존
**파일:** `src/lib/rateLimit.ts:65-81`

- `x-forwarded-for`는 클라이언트가 위조 가능. Vercel 배포 시엔 Vercel이 마지막 홉으로 세팅하므로 **마지막** 값이 신뢰 가능 IP. 현재는 첫 번째 값(`split(",")[0]`)을 사용 → 쉬운 우회.
- Vercel 환경에서는 정확히 하나의 IP만 xff에 들어가는 경우가 많지만, 다중 프록시 시나리오에서는 취약.
- **수정안:** Vercel은 `x-vercel-forwarded-for` 또는 `request.geo`/`request.ip` 사용 권장. 헤더 체인 마지막 신뢰 홉 IP 추출 로직 추가.

---

### 🟢 Low

#### L1. `useFocusTrap`이 초기 포커스를 "가장 첫 focusable"로 고정
**파일:** `src/hooks/useFocusTrap.ts:40-44`

- 모달이 열릴 때 Close 버튼(첫 focusable)에 포커스 → 사용자가 바로 Enter 치면 모달이 닫힘.
- WAI-ARIA는 "주된 액션에 포커스"를 권장하는 경우도 있음.
- **수정안:** `initialFocusRef` 옵션을 추가해 primary 액션(예: "Add to Plan") 버튼을 우선.

#### L2. `useRovingTabIndex`는 헬퍼 함수일 뿐 — 각 tablist가 직접 refs 관리
- 중복 로직이 Sidebar/Plan/Export에 복제됨. 향후 네 번째 tablist가 생기면 다시 복붙.
- **수정안:** `useRovingTabIndex(items)` 훅으로 승격하거나 Radix/Headless UI 도입.

#### L3. `localStore`가 모듈 로드 시점에 `window.addEventListener` 호출
**파일:** `src/lib/localStore.ts:75-81`

- `createLocalStore`는 모듈 import만으로 "storage"/custom 이벤트 리스너를 등록. 테스트 환경(JSDOM)이나 SSR 핫-리로드에서 리스너가 누적될 수 있음.
- **수정안:** 구독자가 처음 생길 때 등록, 마지막이 해제될 때 정리 (subscribe lazy init).

#### L4. Toast z-index/레이아웃 책임을 `Toast.tsx`가 직접 고정
**파일:** `src/components/Toast.tsx:22`

- `fixed top-16 right-6` 하드코딩. 다른 fixed 요소(모달 스피너 등)와 겹침 가능성.
- **수정안:** Provider가 Portal로 body 말단에 렌더, 스태킹 컨텍스트 분리.

#### L5. RecoveryDrawer의 "Sent!" 타이머 이중 안전장치
**파일:** `src/components/RecoveryDrawer.tsx:260-270`

- `sentTimerRef` 클린업은 있지만 "Send Request" 빠르게 두 번 누르면 첫 타이머를 취소하고 새로 시작 → 올바르지만, 실제로는 sending 상태를 disabled로 묶는 편이 UX 상 명확.
- **수정안:** 전송 중 버튼 `disabled`.

#### L6. 한국어 i18n 미적용 (유지)
- 2차 리포트 `L6`. 제품 결정 대기.

#### L7. 검색 페이지네이션 상태가 URL에 반영되지 않음
**파일:** `src/app/search/SearchClient.tsx`

- 새로고침/공유 시 "Load More" 상태가 초기화됨.
- **수정안:** `?page=` 쿼리 파라미터 + `router.replace` 또는 Intersection Observer 기반 infinite scroll.

#### L8. `fetchCoursesReport` 실패는 배치 전체에 대해 한 번만 토스트
**파일:** `src/app/export/page.tsx:87-103`

- 부분 실패 시 어떤 코스가 누락됐는지 알 수 없음 (숫자만 표시).
- **수정안:** 실패한 ID → 코스 코드 매핑해 "CSE 20311 could not be loaded" 형태로 나열.

#### L9. `attributes` JSON 파싱 안 함
**파일:** `src/app/course/[id]/page.tsx:10`, `src/app/course/[id]/CourseDetailClient.tsx:54`

- `course.attributes`는 DB에 `JSON array of {code, description}`으로 저장되지만 현재 UI는 참조하지 않음. 죽은 필드.
- **수정안:** 사용하지 않으면 `select`에서 빼기, 혹은 UI에 표시.

#### L10. E2E 테스트가 새 ToastProvider 기반 흐름과 호환되는지 미검증
**파일:** `e2e/*.spec.ts`

- 테스트 실행은 이번 작업에서 하지 않음. Toast 렌더링 위치/텍스트가 바뀌지는 않았지만 확인 필요.
- **수정안:** `playwright test` 실행하여 회귀 유무 확인.

#### L11. `next-env.d.ts` 누락 (TS target 변경 영향 가능)
- `next-env.d.ts`는 Next이 자동 생성하지만 커밋에서 제외됨. `target: ES2022`로 바꾼 뒤 처음 `next dev`/`next build` 실행 시 재생성됨.

---

## 3. 우선순위 추천

1. **프로덕션 전 (권장)**
   - M4: `x-forwarded-for` 마지막 홉 처리 / Vercel 전용 헤더 사용
   - M3: 실제 데이터 기반 prereq 파서 회귀 테스트
   - L10: E2E 회귀 확인

2. **Nice-to-have**
   - M1: 토스트 큐
   - L1: 모달 initial-focus 지정
   - L7: 페이지네이션 URL 동기화
   - L8: 실패 코스 라벨 표시

3. **장기 / 제품 결정 의존**
   - L6: i18n
   - L2: 탭 로직 훅 승격 (또는 Radix 도입)
   - L3: CourseGuidance DB 모델

---

## 4. 참고

- 1차/2차 수정 내역: `docs/fixes_applied.md`
- 아키텍처: `ARCHITECTURE.md`
- AGENTS.md 경고: Next.js 16 breaking changes. 수정 전 `node_modules/next/dist/docs/`의 관련 가이드 확인.
