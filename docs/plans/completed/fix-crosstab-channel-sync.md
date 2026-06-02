---
slug: fix-crosstab-channel-sync
status: completed
completed: 2026-06-03
created: 2026-06-03
worktree: ../wt/fix-crosstab-channel-sync (정리됨)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리↔컨택관리 교차 이동 시 채널·날짜를 들고 넘어가 자동선택·하이라이트하고, 저장 시 합계가 맞으면 긍정 확인(왕복 안내 중단)하도록 개선.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: `app/(app)/contact/page.tsx`, `app/(app)/db/page.tsx`, `app/(app)/contact/_components/ChannelTabsAndPanel.tsx`, `components/ui/CrossTabHintModal.tsx`(읽기), `app/(app)/contact/_lib/dbProductionCheck.ts`
> - **읽고 나면 알 수 있는 것**: 교차탭 쿼리파라미터 규약, 하이라이트 표시 방식, 일치 시 긍정 확인 흐름
> - **관련 문서**: [[docs/domains/api-spec.md]], `docs/plans/active/posthog-analytics.md`(이슈 출처)

# 교차탭(DB↔컨택) 채널 동기화 + 일치 긍정 확인

## Intent (왜)
PostHog 행태분석에서 손기학 수강생 흐름 관찰 중 발견. DB관리에서 생산을 추가하면 "컨택관리에 생산 입력하세요" 팝업이 뜨는데, 컨택관리로 넘어가도 **어느 채널·어느 날짜에 입력해야 하는지 표시가 없어** 사용자가 헤맨다. 또 컨택관리에서 저장하면 DB합과 일치하든 말든 다시 "DB관리로 이동" 안내가 떠 **왕복 루프**가 생기고, "맞게 입력했는데 또 가라고 한다"는 혼란을 준다.

## 현재 동작 (root cause)
1. `db/page.tsx` `handleAdd` → `productionHint` 모달 → `router.push("/contact")` — **쿼리파라미터 없음**. 컨택은 항상 기본값(매입DB / 오늘)으로 열림.
2. `contact/page.tsx`는 `useState("매입DB")`·`useState(TODAY_ISO)`로만 초기화 — 인입 채널/날짜를 **읽지 않음**.
3. `contact/page.tsx` `handleSave`는 저장 후 `findProductionMismatch`로 불일치면 모달, **일치하면 아무 피드백 없음**. DB 생산행 날짜와 컨택 날짜가 어긋나면 "맞게 입력해도" 불일치로 잡혀 다시 DB로 보냄.

## Acceptance Criteria (수용 기준)
- [ ] DB관리에서 추가 후 "컨택관리로 이동" 클릭 → 컨택이 **그 채널 선택 + 그 날짜**로 열림.
- [ ] 컨택 도착 시 해당 채널의 **생산 입력 행이 잠깐 하이라이트**(ring + 펄스, 수 초 후 사라짐).
- [ ] 컨택 저장 시 DB합과 컨택 생산값이 **일치하면 긍정 확인**("✅ DB관리 N건과 일치 — 이대로 저장됨"), DB로 보내지 않음.
- [ ] 불일치면 **구체 숫자**(컨택 N vs DB M)와 함께 "DB관리로 이동" 안내. 이동 시 DB가 **그 채널 선택 + 추가폼 자동 오픈(하이라이트)**.
- [ ] `npm run check` 통과 (typecheck · lint · structural · tests · 파일크기)
- [ ] 모바일 스크린샷 첨부 (DB→컨택 도착 하이라이트, 일치 긍정 모달, 불일치 모달)

## 설계 (쿼리파라미터 규약)
- **DB → 컨택**: `/contact?channel=<백엔드채널명>&date=<YYYY-MM-DD>&focus=production`
- **컨택 → DB**: `/db?channel=<백엔드채널명>&focus=add`
- 채널명은 백엔드 표기 그대로(`매입DB`·`직접생산`·`현수막`·`콜·지·기·소`) — `encodeURIComponent` 사용. `Channel` 타입과 동일 문자열이므로 캐스팅만.
- 파라미터 읽기는 **`useEffect` 안에서 `new URLSearchParams(window.location.search)`** 로(= Next 15 `useSearchParams` Suspense 경계 요구 회피, 기존 페이지 구조 유지).

## Steps
1. `ChannelTabsAndPanel.tsx`: optional prop `highlightKey?: keyof ChannelDailyRowMetrics` 추가 → 해당 지표 행에 ring/펄스 클래스.
2. `contact/page.tsx`: mount `useEffect`에서 `channel`·`date`·`focus` 읽어 `activeChannel`/`date`/`highlightProduction` 세팅(수 초 후 해제). 패널에 `highlightKey` 전달.
3. `contact/page.tsx` `handleSave`: 저장 후 전 채널 mismatch 비교 → 일치+생산>0이면 긍정 모달(인라인 JSX, 단일 "확인" 버튼), 불일치면 기존 `CrossTabHintModal` 개선(숫자 표기) + 이동 시 `/db?channel&focus=add`.
4. `db/page.tsx`: `handleAdd`에서 추가행 날짜 캡처 → `productionHint`에 `{channel, date}` 저장 → 이동 시 `/contact?channel&date&focus=production`. mount `useEffect`로 인입 `?channel&focus=add` 읽어 채널선택 + `setAddOpen(true)`.

## Log
- 2026-06-03 Cowork에서 코드 초안 작성(working tree). 커밋·테스트는 사용자 PC Claude Code로 핸드오프(§6.7).

- 2026-06-03 사용자 PC Claude Code에서 검증·완료: 코드는 #262(`3fec889`)에 함께 머지됨. check.sh(typecheck·lint·structural·test 62) 통과 + 코드-경로 수용기준 전항 충족 확인. completed 이동.
