---
slug: posthog-analytics
status: active
created: 2026-06-02
owner: belie
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: PostHog 제품분석을 앱에 도입 — 사용자 행태(퍼널·리텐션) + 불편/버그(에러·예외·rage click·세션 리플레이) 수집, 코드 이벤트 전수 설계 및 PostHog 대시보드 구성.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: `app/providers.tsx`(init·전역 에러 캡처), `components/TopHeader.tsx`(identify), `lib/query/*-hooks.ts`(도메인 이벤트), 신규 `lib/analytics/`
> - **읽고 나면 알 수 있는 것**:
>   - 어떤 이벤트를 코드 어디서 보내는가 (이벤트 전수표)
>   - 무엇을 PII로 보내고 무엇을 가리는가 (개인정보 정책 → ADR-0009)
>   - 운영 전용 게이팅·식별·세션 리플레이 설정 방식
> - **관련 문서**: [ADR-0009](../../decisions/0009-posthog-analytics.md), [architecture.md](../../architecture.md)

# PostHog 제품분석 도입

## 1. 목표 (사용자 요청)
1. 수강생 사용자 **행태 분석** (어떤 탭·기능을 얼마나·어떤 순서로 쓰는가).
2. 사용 중 발생하는 **불편함·버그** 탐지.
3. **코드 레벨 이벤트 전수 설계 + 적용**.
4. PostHog에 **인사이트 대시보드** 구성.

## 2. 설계 결정 요약 (상세는 ADR-0009)
- **수집 위치**: 운영(배포)만. `NODE_ENV==='production'` + `NEXT_PUBLIC_POSTHOG_KEY` 존재 시에만 `posthog.init`. 로컬/개발은 키 없으면 자동 비활성 → 분석 데이터 오염 방지(기존 GA·Sentry 정책과 동일).
- **식별(identify)**: 로그인 사용자를 **이메일**로 식별. person 속성 = `cohort`(기수), `name`(수강생명), `role`. impersonation(관리자 대리접속) 중에는 **식별 skip**(대상 PII 오염 방지).
- **세션 리플레이**: **ON, 마스킹 OFF**(사용자 선택 — 전부 녹화). 단 `lib/analytics`의 `SESSION_MASK_PII` 플래그 한 줄로 마스킹 전환 가능. password 입력은 항상 마스킹.
- **에러/버그**: ① React Query 전역 핸들러로 모든 쿼리·뮤테이션 실패 → `api_error` 이벤트. ② `capture_exceptions:true` 로 JS 예외 → `$exception`(Error Tracking). ③ 세션 리플레이 + rage click(autocapture)로 "막히는 지점" 시각화.
- **자동 수집(autocapture)**: 페이지뷰(`$pageview`, SPA history 기반)·클릭(`$autocapture`)·rage click(`$rageclick`)은 SDK가 자동. → 단순 링크/버튼 클릭은 수동 계측 불필요.
- **수동(도메인) 이벤트**: 의미있는 비즈니스 행동만 뮤테이션 `onSuccess`에서 명시 capture. PII(이름·금액·업체명) 속성 금지 — **카테고리/개수/불리언만**.

## 3. 이벤트 전수표 (taxonomy)

상수 정의: `lib/analytics/index.ts` 의 `EVENTS`. 속성은 모두 비-PII.

| 이벤트 | 발생 위치(코드) | 속성(비-PII) | 의미 |
|---|---|---|---|
| `$pageview` | autocapture | (자동) | 탭/화면 진입 — 행태·퍼널 기반 |
| `$autocapture` | autocapture | (자동) | 버튼·링크 클릭 |
| `$rageclick` | autocapture | (자동) | 연속 클릭 = 불편/막힘 신호 |
| `$exception` | `capture_exceptions` | (자동) | JS 런타임 예외 = 버그 |
| `api_error` | `app/providers.tsx` 전역 핸들러 | `kind`(query\|mutation), `resource`, `message` | API 실패 = 버그/불편 |
| `user_identified` | `TopHeader` (identify 시) | `cohort`,`role` | 로그인 사용자 등장 |
| `metrics_saved` | `useSaveMetrics` | `channel_count`, `has_production` | 컨택탭 일일 생산/활동 저장 |
| `meeting_booked` | `useAppendMeeting` | `cross_day`(예약≠미팅날짜) | 미팅 예약/추가 |
| `meeting_updated` | `usePatchMeeting` | — | 미팅/결과 수정 |
| `meeting_reverted` | `useRevertMeeting` | — | 미팅 결과 되돌리기 |
| `meeting_removed` | `useRemoveMeeting` | — | 미팅 삭제 |
| `case_revived` | `useReviveCaseClosure` | — | 케이스 종료 되살리기 |
| `contract_payment_added` | `useAddContractPayment` | — | 실무/수납 슬롯 추가 |
| `contract_fee_synced` | `useSyncContractFee` | `synced` | 수임비 동기화 |
| `contract_payment_updated` | `usePatchContractPayment` | — | 실무/수납 수정 |
| `contract_payment_removed` | `useRemoveContractPayment` | `cascade` | 실무/수납 삭제 |
| `db_row_added` | `useAppendDB` | `channel` | DB관리 구매목록 추가 |
| `db_row_updated` | `usePatchDB` | `channel` | DB관리 수정 |
| `db_row_removed` | `useRemoveDB` | `channel` | DB관리 삭제 |
| `todo_created` | `useCreateTodo` | `todo_type` | 실무투두 생성 |
| `todo_updated` | `usePatchTodo` | `done` | 실무투두 수정/완료토글 |
| `todo_removed` | `useRemoveTodo` | — | 실무투두 삭제 |

> `channel` 값(매입DB/직접생산/현수막/콜지기소)은 채널 카테고리라 PII 아님.

## 4. 구현 단계
1. 의존성: `posthog-js`.
2. `lib/analytics/index.ts`: `EVENTS` 상수, `track`, `identifyUser`, `resetUser`, `trackApiError`, `SESSION_MASK_PII`.
3. `app/providers.tsx`: init(운영 게이팅·리플레이·예외) + `PostHogProvider` + QueryClient 전역 에러 캡처.
4. `components/TopHeader.tsx`: `useMe` 데이터로 `identifyUser`(비-impersonation 시).
5. `lib/query/*-hooks.ts`: 위 표대로 `onSuccess`에 `track()`.
6. `tsconfig.json`: `@/analytics` 경로 별칭.
7. env: `.env.example`에 `NEXT_PUBLIC_POSTHOG_KEY`/`HOST` 추가. 실제 키는 `.env.local` + 배포 시크릿.
8. PostHog: 프로젝트에서 세션 리플레이 ON, 대시보드 생성(MCP).

## 5. 범위 밖
- 서버사이드(Node) 이벤트 캡처 — 현재는 클라이언트만.
- Feature flag / A-B 실험 — 추후.
- 수강생 동의 UI(개인정보) — 별도 작업으로 권고(ADR-0009 리스크 참조).

## 6. 검증
- `npm run check`(typecheck·lint·structural·test·doc-drift) 초록.
- 신규 컴포넌트 파일 없음(init은 기존 providers.tsx 내부) → SSOT 드리프트 무영향.

## Log
- 2026-06-02 기획 + 구현 착수.

## 7. 배포 체크리스트 (사람 직접 — 코드로 불가)
1. **로컬 설치·검증**: `npm install` → `npm run check` 초록 확인.
2. **`.env.local`** 에 키 추가 (운영 빌드에서만 동작):
   - `NEXT_PUBLIC_POSTHOG_KEY="phc_uW7uUYiHeuNjwpoLKdmta2AMXF94QtGfrCNxphZ96bwz"`
   - `NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"`
3. **배포 시크릿**(VPS/CI)에 위 2개 환경변수 동일 추가.
4. **PostHog 프로젝트 설정**(Project settings):
   - Session Replay → **Record user sessions ON**.
   - Error tracking → **Exception autocapture ON**.
   - (권장) 데이터 보존기간·IP 익명화 검토.
5. **대시보드**: "세일즈PT — 사용자 행태 & 품질" (id 1658308) — 배포 후 데이터 적재되면 자동 채워짐.
6. (권장) 앱에 개인정보 처리/동의 고지 추가 — 별도 작업 (ADR-0009 리스크).

## 8. PostHog 대시보드 (생성됨)
- 대시보드: https://us.posthog.com/project/450895/dashboard/1658308
- 타일 9개: DAU · 탭별 사용량 · 핵심 기록 행동 · 전환 퍼널 · 주간 리텐션 · API 오류 · JS 예외 · Rage Click · 채널별 DB 입력.
