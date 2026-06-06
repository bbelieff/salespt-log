---
slug: posthog-findings-2026-06-05
status: active
created: 2026-06-06
owner: belie
source: Cowork 자동 데일리 리포트 (PostHog #450895, 분석일 2026-06-05 KST)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 2026-06-05 PostHog 데일리 리포트에서 나온 버그·인사이트를 개발 세션이 바로 집어갈 수 있게 우선순위·코드포인터·수용기준으로 정리한 핸드오프.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: `lib/repo/sheets-client.ts`(429 retry), `lib/repo/*`(시트 read 볼륨), `app/providers.tsx`·`components/TopHeader.tsx`·`lib/analytics/`(identify·내부트래픽), `lib/query/*-hooks.ts`(api_error)
> - **읽고 나면 알 수 있는 것**:
>   - 어제/오늘 실제로 터진 마찰·에러가 무엇이고 어느 화면·버튼인가
>   - 기존 플랜(sheets-quota-retry 등)이 왜 아직 사용자 에러를 막지 못하는가
>   - "미식별 = 관리자(김믿음)"가 분석에 주는 영향과 처리 방법
> - **관련 문서**: [posthog-analytics](./posthog-analytics.md) · [ADR-0009](../../decisions/0009-posthog-analytics.md) · [sheets-quota-retry](./sheets-quota-retry.md) · [sheets-retry-no-proxy](./sheets-retry-no-proxy.md) · [stats-cache-10min](./stats-cache-10min.md)

# PostHog 데일리 핸드오프 — 2026-06-05 (금, KST)

## 0. 한 줄 결론

> 어제 표면 지표는 좋아 보이나(이벤트 +63%, 페이지뷰 +95%), **그 중 34%는 관리자(김믿음) 트래픽**이고, **구글 시트 읽기한도(429) 에러가 retry 플랜이 있는데도 운영에서 계속 노출**되고 있다. P0는 시트 read 볼륨 자체를 줄이는 것.

분석 데이터는 4일치(06-02~)·수강생 소수라 **추세 %는 방향 참고용**. 아래 수치는 모두 KST 기준.

---

## 1. ⚠️ 데이터 정정 — "미식별 = 관리자 김믿음"

사용자 확인: 리포트의 **미식별(None) 버킷은 전부 관리자 김믿음**(여러 기기/세션·대리접속).
이는 버그가 아니라 **설계된 동작**이다 — `posthog-analytics.md` / ADR-0009:
> "impersonation(관리자 대리접속) 중에는 **식별 skip**(대상 PII 오염 방지)."

그러나 부작용이 있다: **관리자 트래픽이 수강생 분석에 그대로 섞여 지표를 부풀린다.**

| 구분 | 어제 이벤트 | 페이지뷰 | DAU(사람) |
|---|---|---|---|
| 전체 (리포트 표면값) | 2,051 | 271 | 13 |
| 관리자 김믿음 (미식별 7세션) | 694 (34%) | 87 | — |
| **실제 수강생 6명** | **1,357 (66%)** | **184** | **6** |

→ **실제 수강생 DAU는 13이 아니라 6.** 퍼널·DAU·리텐션 모두 관리자 제외 시 값이 달라진다.

**수강생만 본 퍼널(정정):** 접속 6 → 지표 2 → 미팅 2 → 계약 3
(관리자 #d0cc49ed가 기록한 지표 1·미팅 2는 테스트성 → 수강생 퍼널에서 제외)

### 액션 (P1, 분석 정확도)
- [ ] 관리자/내부 트래픽을 수강생 지표에서 **분리**할 수단 마련. 택1:
  - (A) 관리자 본인 세션은 `role:"admin"`로 **identify**해서 PostHog에서 필터 가능하게(대리접속은 기존대로 skip 유지).
  - (B) 내부 사용자에 `is_internal:true` person/super-property를 붙이고 인사이트·대시보드에서 제외.
- [ ] 코드 위치: `components/TopHeader.tsx`(identify 호출), `lib/analytics/index.ts`(속성 상수), `app/providers.tsx`(init).
- [ ] ADR-0009에 "내부 트래픽 필터링" 결정 한 줄 추가(또는 후속 ADR).

---

## 2. 🔴 P0 — 구글 시트 읽기한도(429 Quota exceeded) 운영 노출

### 무엇이 보였나 (PostHog `api_error` 이벤트)
- **06-05**: 1건 — `오승진 · /contact` · `Quota exceeded ... 'Read requests' per minute per user ... sheets.googleapis.com`
- **06-06 새벽 02:34 KST**: **5건 연속** — 관리자(#56e31eff) · `/calendar`·`/contact` · 동일 Quota exceeded, **~1분 내 폭주**
- 별도 1건: `Failed to fetch` · `/schedule` (네트워크 단절 추정)

### 왜 기존 플랜으로 안 막히나
`sheets-quota-retry`(1s→2s→4s→8s, 4시도) + `sheets-retry-no-proxy`는 **active 상태**인데도 사용자에게 `api_error`가 노출됨. 가능한 원인:
1. **백오프 윈도우 < 한도 회복 시간** — 4시도 합 ~15s 안에 끝나는데, 한 사용자가 1분 내 read를 폭주(5건)시키면 60s 윈도우 내내 quota가 포화 → 재시도 4번 모두 실패 후 throw.
2. retry가 **read 폭주 자체를 줄이지 못함** — 근본 원인은 "페이지 진입/빠른 이동마다 시트 read 다발 발생".

→ **retry는 응급처치일 뿐, P0 본질은 read 호출 수를 줄이는 것.**

### 액션 (P0) — PR1 `feat/sheets-read-volume-down` (2026-06)
- [x] **read 볼륨 축소(클라)** — `useDay`/`useWeekMeetings`/`useMonthMeetings`·`useDBOverview` 에 `staleTime:60s`. /calendar↔/contact 빠른 전환의 즉시 refetch 폭주를 클라 캐시로 흡수. 뮤테이션 `invalidateQueries` 로 저장 직후 신선도 보존.
- [x] **중복 read 제거** — `sales.ts:readWeek` 가 `readCourseStart` 를 읽고 `void` 처리하던 dead read 제거 → 매 loadDay 당 -1 read. (`readProfileBundle` 은 이미 batchGet 1회)
- [~] **읽기 캐시 확대(서버 unstable_cache) — 보류**: /api/daily·meetings 서버 read 에 short-TTL + 쓰기 revalidateTag. **무효화 표면이 ~10개 뮤테이션 라우트로 넓어** 누락 시 "저장했는데 사라짐" 정합 사고 위험(§2.5 / 2026-05-14 교훈). 위 두 항목으로 read 급감 달성 → 차기 데일리에서 quota 재발 시 별도 PR.
- [ ] **검증** — 위 적용 후 PostHog `api_error(Quota exceeded)` 재발 여부 일일 모니터(데일리 리포트 자동 추적).
- 코드 포인터: `lib/repo/sheets-client.ts`(retry), `lib/repo/sales.ts`(read), `lib/query/*-hooks.ts`(호출 트리거).

---

## 3. 🟡 P1 — 입력창·하단 내비 버튼 마찰 (분노클릭 7회)

분노클릭(반응 없을 때 같은 곳 연타) = "여기 답답해요" 신호. 어제 7건 위치(elements_chain 기준):

| 화면 | 위치 | 횟수 | 누가 |
|---|---|---|---|
| `/payment` | 입력창(input) + "완료 토글" 체크박스 | 2 | 관리자 #b1276ebd |
| `/contact` | 하단 내비 아이콘 버튼(`button.h-11` + svg) | 2 | 오승진 |
| `/schedule` | 입력창(input) + 하단 내비 | 2 | 관리자 #d0cc49ed, 조정욱 |
| `/calendar` | 날짜 셀 버튼 | 1 | 관리자 #b1276ebd |

- 마찰의 7건 중 6건이 **소수(관리자 b1276ebd 3 · 오승진 2 · 관리자 d0cc49ed 1)** 에 집중.
- 패턴상 **저장/이동 직후 반응이 느려 눌렀는지 모르는 상태** → P0 시트 지연과 직접 연결로 추정.

### 액션 (P1)
- [ ] 저장·완료토글·내비 탭에 **즉각 로딩 스피너 / 낙관적 UI**(반응 지연 동안 눌림 표시).
- [ ] 터치 타깃(하단 내비 `h-11`) 크기·히트영역 점검.
- 코드 포인터: 결제(`app/(app)/payment`), 컨택(`/contact`), 스케줄(`/schedule`) 화면 컴포넌트 + 해당 뮤테이션 hook의 `isPending` 처리.

---

## 4. 🔵 P2 — 그 외 / 검증 필요

- [ ] **`Failed to fetch`** (`/schedule` 1건) — 일시적 네트워크 단절. 재시도 + 오프라인 안내 보강 검토.
- [ ] **`$exception` 자동수집 동작 확인** — ADR-0009는 `capture_exceptions:true`로 `$exception` 수집을 명시하나, 이 프로젝트에 **`$exception` 이벤트가 0건**. 실제로 JS 예외가 없었던 것인지, 캡처가 비활성인지 운영에서 한 번 확인 필요(고의 에러로 스모크 테스트). `$dead_click`은 기본 미수집이라 부재가 정상.
- [ ] **입력 활동 급감 모니터** — 지표저장 21→5, 미팅 15→5(목→금). 주간 입력 주기 때문인지, 입력 흐름 마찰 때문인지 며칠 더 관찰. 단정 금지(표본 소).
- [ ] **이탈 주의 수강생** — 손기학(누적 720 → 어제 23, 입력 0), 김영준·김현지(저활동). 정착 여부 관찰.

---

## 5. 데이터 신뢰도 메모 (개발 판단용)

- **교차검증 통과**: 사용자별 합계 = 전체 일별 합계 8개 지표 모두 일치(이벤트 2,051 등). (집계 1차 시 LEFT JOIN이 DB 1건 허위 가산 → person_id 키 집계로 정정.)
- **시간대**: 프로젝트 tz=UTC, 본 분석은 KST(UTC+9) "어제=06-05" 기준.
- **표본**: 데이터 4일치·수강생 6명. 추세 %는 방향 참고용, 리텐션/경로 분석은 데이터 축적 후.
- **사람 구분**: person_id 단위. 같은 사람 다기기 시 분리 카운트 가능(김현지·김영준 식별자 2개 존재).

---

## 6. 개발 세션 착수 순서(권장)

1. **P0 read 볼륨 축소** (§2) — 사용자 체감 에러 직결. 기존 `sheets-quota-retry`/`stats-cache-10min` 위에 read 디바운스·batchGet·캐시 확대.
2. **P1 내부 트래픽 분리** (§1) — 이후 모든 지표 해석의 전제. 작고 빠름.
3. **P1 마찰 UI 피드백** (§3) — P0와 함께 가면 분노클릭 감소 확인 가능.
4. P2 검증 항목 (§4).

> 작업 시 §3 Task Contract 준수: worktree 생성 → 변경 → `scripts/check.sh` 통과 → 커밋/PR은 **사용자 PC Claude Code**에서(§6.7, Cowork는 파일 작성까지만). 완료된 항목은 이 문서 체크박스 갱신 후 `docs/plans/completed/`로 이동.
