# 코드 잠재 문제점 분석 보고서

> 작성일: 2026-04-19
> 대상: Registration Clarity (PATH) — Next.js 16 + Prisma + Neon PostgreSQL
> 범위: `src/`, `prisma/`, e2e 테스트, 배포 설정
> 기존 문서(`code_analysis.md`, `sprint3_gap_analysis.md`)에 없는 관점 위주로 정리

> **2026-04-19 업데이트**: Critical 4 / High 3 / Medium 12 / Low 7 항목 수정 완료.
> 변경 내역은 `docs/fixes_applied.md`를 참고.

---

## 심각도 요약

| 심각도 | 개수 | 대표 문제 |
|---|---|---|
| Critical | 4 | Sidebar 무한 fetch 루프, Promise 예외 누락, setTimeout 누수, localStorage 동기화 우회 |
| High | 3 | 선수과목 정규식 취약, null section 데이터 오판정, localStorage JSON 스키마 미검증 |
| Medium | 12 | API 인증/레이트리밋 부재, N+1 직렬화, ErrorBoundary 부재, ARIA 누락, 느슨한 타입 |
| Low | 8 | 하드코딩 demo 데이터, 한국어 i18n 미적용, `.env.example` 없음, 마이그레이션 미관리 |

---

## 🔴 Critical

### 1. Sidebar의 `courseNames` 무한 fetch 루프
**파일:** `src/components/Sidebar.tsx:45`

```ts
useEffect(() => {
  const missing = ids.filter((id) => !courseNames[id]);
  // ... setCourseNames(...)
}, [plans, courseNames]); // ← courseNames가 deps에 들어가 자기참조
```

- `setCourseNames`가 호출되면 `courseNames` 참조가 바뀌고, 같은 effect가 재실행되어 추가 fetch를 트리거할 수 있음.
- 플랜을 빠르게 편집하면 동일 코스에 대한 GET 요청이 여러 번 나감.
- **수정안:** `courseNames`를 deps에서 제거하거나 이미 요청 중인 id를 `Set<number>` ref로 추적.

### 2. Promise 체인에 조용한 `null` 반환
**파일:** `src/app/plan/page.tsx:128`, `src/app/export/page.tsx:108`, `src/components/PreCheckModal.tsx:67`

```ts
fetch(`/api/course/${id}`).then((r) => r.json()).catch(() => null)
```

- `Promise.all` 결과에 `null`이 섞여도 이후 매핑에서 필터링/검증 없이 사용.
- 네트워크 오류 시 사용자에게 toast 등 피드백이 없음 → “추가했는데 안 보인다” 유형 이슈.
- **수정안:** 응답 `res.ok` 체크, 실패한 id 모아 재시도 or 토스트 표시.

### 3. `setTimeout` 클린업 누락 (토스트 누수)
**파일:** `src/app/course/[id]/CourseDetailClient.tsx:204,259,321`, `src/app/search/SearchClient.tsx:170`

```ts
setToast("...");
setTimeout(() => setToast(""), 3000); // cleanup 없음
```

- 연속 클릭 또는 언마운트 시 타이머가 누적되어 state 경합/메모리 누수 가능.
- **수정안:** `useEffect`로 이동하거나 ref에 timeout id 저장 후 재설정 전에 `clearTimeout`.

### 4. Onboarding 리셋이 `window.location.reload()` 사용
**파일:** `src/app/onboarding/page.tsx:62-63`

```ts
window.localStorage.removeItem("registration-clarity-audit");
window.location.reload();
```

- `AuditContext`와 `PlansContext`가 동시에 리셋되지 않고 강제 새로고침으로 처리.
- 사용자가 저장하지 않은 플랜이 경고 없이 사라짐.
- **수정안:** Context의 `clear*` 액션 호출 후 `router.push`로 이동.

---

## 🟠 High

### 5. 선수과목 정규식이 괄호 안만 파싱
**파일:** `src/lib/restrictions.ts:74-79`

```ts
const match = r.match(/Prerequisites?:\s*\(([^)]+)\)/i);
```

- `"Prerequisites: CSE 20312"`처럼 괄호 없는 케이스는 통과 → 사실상 수강 불가 과목이 "Eligible"로 표시될 위험.
- `code_analysis.md`에 이미 "~5 패턴이 90% 커버"라고 명시 → 10% 사일런트 폴스 네거티브.
- **수정안:** 괄호 없는 변형 패턴 추가 + 실패 시 "검증 필요" 상태 반환.

### 6. 섹션 데이터가 `null`일 때 eligibility 오판정
**파일:** `src/lib/eligibility.ts:30-35`

```ts
if (sections.length > 0 && sections.every((s) => s.seatsAvailable !== null && s.seatsAvailable <= 0)) {
  return "full";
}
```

- 모든 `seatsAvailable`이 `null`(로딩 중/데이터 없음)이면 조건이 false로 떨어져 `"eligible"` 반환.
- 학생이 “자리 있음”이라고 믿는 동안 실제로는 상태 미확정.
- **수정안:** `null` 비율이 일정 이상이면 `"unknown"` 분기 추가.

### 7. localStorage JSON 런타임 스키마 미검증
**파일:** `src/contexts/PlansContext.tsx:12`, `src/contexts/AuditContext.tsx:13`, `src/lib/conflicts.ts:12`, `src/lib/restrictions.ts:22,66`

```ts
return raw ? JSON.parse(raw) : [];
```

- 파싱 성공 ≠ 구조 올바름. 사용자가 devtools에서 수정하거나 구버전 데이터가 남아있으면 TS 타입이 무너진 채 실행.
- **수정안:** Zod 등 런타임 검증. 실패 시 `[]`로 fallback + 콘솔 경고.

---

## 🟡 Medium

### 8. `/api/course/[id]`에 인증/레이트 리밋 부재
**파일:** `src/app/api/course/[id]/route.ts`

- 공개 엔드포인트라 569개 id 전체 긁기가 가능, Neon 쿼리가 직접 발생 → 남용 시 비용/속도 문제.
- 프로토타입 한정이라면 Vercel `middleware`에서 간단한 토큰 체크라도 고려.

### 9. Search page의 과도한 include 직렬화 (N+1 대체)
**파일:** `src/app/search/page.tsx:32-43`

```ts
const courses = await prisma.course.findMany({
  where,
  include: { sections: { include: { meetings: true, instructors: true } } },
});
```

- 569 × 섹션/미팅/강사 join → JSON payload가 수십 KB. 첫 페인트 지연.
- **수정안:** 리스트용 `select` 분리, 상세는 드릴다운 시 fetch.

### 10. 루트 레이아웃에 ErrorBoundary 없음
**파일:** `src/app/layout.tsx`

- 어느 컴포넌트라도 throw하면 전체 페이지가 깨짐 + 복구 UI 없음.
- **수정안:** App Router의 `error.tsx` 파일 추가(각 세그먼트별).

### 11. 아이콘 버튼 대부분 `aria-label` 누락
**파일:** `src/components/PreCheckModal.tsx`, `RecoveryDrawer.tsx`, `Navbar.tsx`, `Sidebar.tsx` 등

- `title` 속성만으로는 스크린리더 대응 불충분. HCI 프로젝트에서 접근성은 평가 포인트.
- **수정안:** `aria-label`, `role`, 포커스 가능한 요소는 `tabIndex` 검토.

### 12. 키보드 내비게이션 결함
**파일:** `src/app/plan/page.tsx:30-36`

- 드롭다운이 click에만 의존, `aria-expanded`/`aria-haspopup` 없음, ESC로 닫히지 않음.
- **수정안:** Radix/Headless UI 채택 또는 직접 handler 추가.

### 13. 페치된 데이터에 인라인 구조 타입
**파일:** `src/app/export/page.tsx:69`, `src/components/PreCheckModal.tsx:75`

```ts
results.find((r: { id: number }) => r?.id === entry.courseId)
```

- 실제 API 응답과 괴리가 생겨도 타입 에러가 안 남. 런타임 크래시의 온상.
- **수정안:** 공유 타입/Zod 스키마를 `src/types/`에 정의해 fetch 헬퍼에서 파싱.

### 14. 같은 섹션이 여러 플랜(A/B/C)에 중복 가능
**파일:** `src/contexts/PlansContext.tsx:49-57`

- 같은 슬롯 중복만 차단. A,B,C에 같은 섹션을 올리면 실제 등록 시 충돌.
- **수정안:** 추가 시 "이미 Plan X에 있음" 경고 토스트.

### 15. `useEffect` deps에 배열 참조 직결
**파일:** `src/app/export/page.tsx:91`, `src/components/PreCheckModal.tsx:89`

- `plans` 배열은 매 업데이트 새 참조. 불필요한 재fetch 유발.
- **수정안:** `plans.map(p => p.sectionId).join(",")` 같은 안정 키로 비교.

### 16. DB 마이그레이션 디렉토리 미사용
**파일:** `prisma/` (migrations 폴더 없음)

- `prisma db push` 모드로 운용 중으로 추정 → 스키마 이력 유실, 롤백 불가.
- **수정안:** `prisma migrate dev` 전환, CI에 `migrate deploy` 추가.

### 17. 빌드에 seed 단계 없음
**파일:** `package.json`

- Vercel 배포 시 DB가 비어 있으면 기능이 깨짐. README에 수동 seed 절차만 있을 가능성.
- **수정안:** `postbuild` 또는 별도 수동 job으로 seed 명시.

### 18. 로드 상태·에러 상태 UI 일관성 부족
- 여러 페이지에서 skeleton/loader 없이 빈 화면 → 사용자에 "멈춘 듯한" UX.

### 19. HTTP 상태 미확인
- 모든 `fetch().then(r => r.json())`이 404/500을 무시.

---

## 🟢 Low

### 20. 데모용 하드코딩 (`GUIDANCE_DATA`, `COURSE_PATHS`)
**파일:** `src/app/course/[id]/CourseDetailClient.tsx:74-146`
- 9개 샘플 과목만 커버. 나머지 과목은 안내가 비어 사용자 혼선.

### 21. 한국어 로컬라이제이션 미적용
- 한국인 대상 HCI임에도 UI 전체 영어. 필요 시 `next-intl` 등 검토.

### 22. `.env.example` 부재
- DATABASE_URL 포맷을 새 개발자가 추측해야 함.

### 23. JSON.parse가 렌더마다 반복
**파일:** `src/app/search/SearchClient.tsx:97`, `src/components/RecoveryDrawer.tsx:120`
- `meetings.days`를 렌더마다 파싱. `useMemo` 또는 서버 응답 시점에 한 번 파싱.

### 24. 색 대비 취약 가능성
**파일:** `src/components/Sidebar.tsx:79` 등
- `text-gray-400/500` on light bg → WCAG AA 미달 우려.

### 25. 토스트에 Undo 액션 없음
- 추가/삭제 모두 3초 후 사라짐, 실수 복구 불가.

### 26. 이모지 로고가 의미론적이지 않음
**파일:** `src/components/Navbar.tsx:18-19`
- `☘️` 텍스트 노드. 스크린리더 음성이 예상 외일 수 있음.

### 27. 유닛 테스트 커버리지 낮음
- `eligibility.ts`, `conflicts.ts`, `restrictions.ts`, `auditParser.ts` 전부 e2e에만 의존.
- 로직 버그(선수과목 정규식 등)는 유닛 테스트로 방어하는 게 효율적.

---

## 우선순위 추천

1. **다음 데모 전**
   - Sidebar 무한 fetch 루프(#1) 수정
   - setTimeout 클린업(#3)
   - ErrorBoundary/`error.tsx`(#10)
   - 아이콘 버튼 `aria-label`(#11)

2. **프로덕션 전**
   - 선수과목 파서 확장(#5) + null-aware eligibility(#6)
   - localStorage/페치 응답 Zod 검증(#7, #13)
   - 중복 섹션 경고(#14)
   - Prisma 마이그레이션 전환(#16)

3. **장기 개선**
   - 검색 payload 최적화(#9)
   - i18n(#21), undo 토스트(#25)
   - `eligibility/conflicts/restrictions/auditParser` 유닛 테스트 추가(#27)

---

## 참고
- 기존 분석 문서: `docs/code_analysis.md`, `docs/sprint3_gap_analysis.md`
- 아키텍처: `ARCHITECTURE.md`
- AGENTS.md 경고: Next.js 16은 breaking change가 있으니 수정 전 `node_modules/next/dist/docs/`의 관련 가이드 확인 필요 (특히 async params, caching 기본값).
