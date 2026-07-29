# P0 — /admin/arena/scoreboard SSR 500 (Digest 4057402273) 수리

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 아레나 전광판 SSR 500(캐시 히트 시 Date→string 강등 → weekIndexOf TypeError)을 캐시 경계 ISO 문자열 통일로 수리한다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/service/scoreboard.ts`(cachedCourseStart) · `lib/service/termination-count.ts` · `lib/util/week.ts`
> - **읽고 나면 알 수 있는 것**: ① 500의 정확한 원인 체인은? ② 왜 오늘(시즌1 마감일) 갑자기 터졌나? ③ 최소 수리는 무엇이고 왜 revert 가 아닌가?
> - **관련 문서**: `docs/incidents/2026-07-29-scoreboard-cache-date-500.md`(후속) · `lib/service/me.ts` 2026-05-13 동일 사고 주석

## 1. 원인 (재현으로 확정)

- 재현: 실데이터 + `unstable_cache` 를 JSON 왕복으로 모사한 vitest 실행 →
  `TypeError: earlier.getTime is not a function` at `lib/util/week.ts:32 diffDays`
  ← `weekIndexOf` ← `termination-count.ts:95 terminatedByWeek` ← `scoreboard.ts:139`.
- 체인: `cachedCourseStart` 가 **Date 를 unstable_cache 에 저장** → 캐시 **히트** 시 JSON
  역직렬화로 **string** 반환 → `terminatedByWeek(payments, courseStart)` 가 string 에
  `.getTime()` → throw → pMap 전파 → SSR 500. 캐시 **미스**(배포/만료 직후 첫 로드)만 정상,
  이후 30분 창은 전부 500 — "F5 지속 500" 보고와 정합.
- **트리거 = 데이터**: `terminatedByWeek` 는 해지 계약(해지일 존재 + 유효 계약일)이 1건 이상일
  때만 `weekIndexOf` 에 도달. 시즌1 마감 즈음 해지 계약이 기입되며 잠복 경로가 활성화됐다.
- **용의 커밋 판정**: (a) #626 — 무죄(이전 sales.ts 로컬 구현도 `.getTime()` 직호출, 의미 동일).
  (b) #635 / (c) #636 — 이 경로와 무관. **원인 = #550/#553 이 도입한 `cachedCourseStart`**
  (Date 캐싱). `lib/service/me.ts` 2026-05-13 동일 사고("JSON 직렬화 → Date→string →
  getFullYear is not a function")의 재발 — 같은 실수 클래스 2회 = 하네스 이슈(인시던트 기록).

## 2. 최소 수리 (revert 아님 — 원인 커밋 #550 revert 는 해지 제외 기능 전체 회귀)

1. `cachedCourseStart` 반환을 **"YYYY-MM-DD" 문자열**(직렬화 안전 primitive)로 통일,
   캐시 키 `-v1` → `-v2`(기존 Date 직렬화 오염 캐시 회피). me.ts 확립 패턴(primitive만 캐시).
2. 소비처 3곳 복원: `terminatedByWeek(payments, parseISO(cs))` ·
   `countTerminatedInWeeks(payments, parseISO(cs))` ·
   `splitContractRevenue(payments, cs)`(이미 ISO 문자열 인자 — toISODate 호출 제거).
3. 같은 줄의 `new Array<number>(8)` → `STATS_WEEKS`(G4 갭, 동일 라인 접촉분만).
4. 회귀 테스트: unstable_cache 를 JSON 왕복으로 목킹 + 해지 계약 1건 fixture →
   `loadScoreboardBundle()` 이 resolve 하고 해지 차감·매출이 맞는지 검증.

## 3. 검증 게이트

- [ ] 신규 회귀 테스트 (JSON 왕복 캐시에서 번들 성공)
- [ ] check.sh 초록 (typecheck/lint/구조/단위/500줄/SSOT)
- [ ] §6.8: 머지 → 배포 관찰 → health 200 → **전광판 라이브 2회 로드**(미스+히트 창) 200 확인
