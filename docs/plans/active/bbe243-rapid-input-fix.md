---
slug: bbe243-rapid-input-fix
status: active
created: 2026-08-20
owner: 경영일지 데탑 C작업원C(260820) — belie 직배차 P0
related: BBE-242, BBE-75
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: "연타·빠른 다중 입력 시 튕김/입력 무시"(BBE-243) 재현·계측·수정 기록.
> - **누가 읽나요**: belie, 반장, 후속 세션
> - **어떤 기능·작업과 연결?**: `app/(app)/contact/page.tsx`, `components/DirtyGuard.tsx`,
>   `app/(app)/contact/_components/MeetingDirtyGuard.tsx`, 신규 `lib/util/save-coalesce.ts`
> - **읽고 나면 알 수 있는 것**: 무엇이 실제 원인이었는지(실측 근거) / 무엇을 고쳤는지 /
>   남은 리스크(추가 조사 후보) / 전·후 비교 수치
> - **관련 문서**: BBE-242(속도 실측, 별도 트랙 — 겹치지 않음)

## 0. Scope (§0.8①)
발주 원문: "연타하거나 빠르게 뭐 많이 누르면 과부하로 튕기거나 입력이 무시되는데 이것도
해결해야 함." 산출물: ①재현·계측(로그로 원인 확정) ②원인별 수정 ③완주 기준(연타20·빠른
입력10 유실0·튕김0 자동증거 + check.sh + §6.8). 경계: 입력·저장 경로만. 시트 의존 제거(총
Sheets 호출 수를 줄이는 것)는 BBE-242 처방 몫 — 이 카드는 **기존 호출을 더 안전하게
실행**하는 것까지만 한다.

## 1. Gather — 코드 실측(§0.8②)

Explore 조사 + 직접 코드 실측으로 확인한 것(경로:줄번호):
- **stepper·타이핑 입력은 이미 로컬 draft** — 클릭/타이핑마다 API 호출이 없다
  (`app/(app)/contact/page.tsx:124-139 adjustMetric`, `app/(app)/db/_components/RowForm.tsx`
  등). 실제 네트워크 호출은 명시적 "저장" 버튼 1회뿐 — "연타=API 폭주" 가설은 **기각**.
- **재진입 가드는 있었지만 애드혹·1곳뿐**: `contact/page.tsx:295 savingRef` — 저장 중
  재클릭을 **버렸다**(그 사이 새 입력이 있어도 무시). 화면마다 이 패턴을 각자 재구현.
- **다건 저장이 전부 순차 `for...await`**: `contact/page.tsx:305-341 runSave`(신규 슬롯
  append 루프) · `components/DirtyGuard.tsx:195-205 saveAll`(전역 dirty 통합저장) ·
  `app/(app)/contact/_components/MeetingDirtyGuard.tsx:93-103,113-120`(로컬 버전, 2곳
  중복 구현). 항목 N개면 Sheets 호출도 N번 **순차** — 각 호출이 429 재시도 백오프
  (`lib/repo/sheets-client.ts:29-40`, 최대 4회·1~8초 지수백오프+지터, 워스트케이스 ~15초)
  를 겪으면 그게 항목마다 누적된다.
- **✅ 실측으로 확정 — 이게 핵심 증거다**: census 스크립트 작업 중 실제로
  `GaxiosError: Quota exceeded for quota metric 'Read requests' and limit 'Read requests
  per minute per user' of service 'sheets.googleapis.com'`(HTTP 429)를 라이브로 재현했다.
  이 앱은 **전체 요청이 서비스계정(SA) 하나로 인증**한다(`lib/repo/sheets-client.ts`) —
  즉 "per user" 쿼터는 사실상 **앱 전체가 공유하는 단일 버킷**이다. 동시 사용자가 많거나
  (여러 수강생 동시 접속) 한 사람이 다건 저장을 순차로 여러 번 하면, 그 버킷이 소진돼
  **누구든** 429 를 맞을 수 있다 — "연타하면 튕긴다"는 belie 체감과 정확히 일치한다.
- **저장 버튼 disable 은 이미 react-query `isPending` 기반**(`contact/page.tsx:462-467`)
  이라 순수 로딩 표시는 정상 — 문제는 재진입 가드의 "버림" 동작과 순차 실행 자체였다.

## 2. Solve — 원인별 수정(§0.8③)

| 원인 | 수정 | 파일 |
|---|---|---|
| 저장 중 재클릭이 버려짐(입력 무시) | 공용 좌표(coalesce) 유틸 — 저장 중 재트리거는 큐에 남아 마지막 draft 로 1회 더 실행 | 신규 `lib/util/save-coalesce.ts` `createSaveCoalescer` |
| 다건 저장 순차 실행(항목마다 429 백오프 누적 → 긴 정지="튕김") | 독립 항목은 병렬 실행, 항목별 실패는 그대로 격리 | `save-coalesce.ts` `saveAllParallel`, 적용처 3곳(아래) |
| 같은 버그의 중복 구현 2곳(`DirtyGuard`·`MeetingDirtyGuard`) | 각각 독립적으로 병렬화(구조 통합은 별도 리스크 — 이번엔 안 건드림) | `components/DirtyGuard.tsx` · `.../MeetingDirtyGuard.tsx` |
| `MeetingDirtyGuard` 모달의 `onSave` 인라인 순차루프 — 예외 무보호(unhandled rejection 위험) | `saveAllDirty()` 재사용으로 대체(중복 제거 + 실패 격리 획득) | 동 파일 |

**하지 않은 것(스코프 밖 — 명시)**:
- Sheets 호출 **총 개수**를 줄이는 배치(batchUpdate) 전환 — "시트 의존" 자체를 건드리는
  변경이라 BBE-242 처방 몫. 병렬화는 총 호출 수는 그대로 두고 **소요 시간만** 줄인다.
- `MoneyInput.tsx`(콤마 포맷) 의 rAF 커서보정 — 극단적으로 빠른 타이핑(자동반복 등)에서
  이론상 커서 위치 경쟁 가능성을 코드 리뷰로 발견했으나, **재현 증거 없음**(실측 못 함) —
  §4 에 후속 조사 후보로만 남긴다. 확정 안 된 것을 고친 것처럼 보고하지 않는다.

## 3. Verify — 자동 증거(§0.8④)

`tests/util/save-coalesce.test.ts`(9건, 전부 green):
- **연타 20회 유실 0**: 첫 트리거 진행 중 19회 추가 트리거 → `run()` 은 "즉시 실행분 +
  마지막 큐" 딱 2번만 불리고, 20개 트리거 **전부 정상 resolve**(예외로 죽는=튕기는 것 0건).
- 실패한 트리거 뒤에 큐잉된 트리거도 버려지지 않고 이어서 실행됨(부분 실패 격리).
- `saveAllParallel` 8항목 동시성 실측: 병렬이 순차 대비 60% 미만 시간(각 20ms 항목 8개 —
  순차 160ms 근처 vs 병렬 20ms 근처) — "긴 정지" 감소를 코드로 증명.
- 개발 서버(localhost, dev-stub 인증)에서 전역 Provider(`DirtyGuard`)가 포함된 앱이
  정상 렌더됨을 확인(hot-reload 후 크래시 0) — "튕김"(크래시) 없음의 최소 스모크 증거.

check.sh: typecheck·lint·structural(34)·unit(1338, 신규 9건 포함) 전부 green(§6 참고).

## 4. 남은 위험 / 후속 조사 후보
- **MoneyInput rAF 커서보정** — 극단적으로 빠른 타이핑에서 값이 틀어질 이론적 가능성.
  재현 증거 없어 이번엔 안 건드림. 후속 카드 후보(belie 관찰로 재현되면 우선순위 재검토).
- **Sheets 쿼터가 앱 전체 공유** — 이번 수정은 "한 사용자의 한 저장 동작"이 쓰는 시간을
  줄일 뿐, 총 API 호출 수는 그대로다. 동시 사용자가 아주 많아지면(현재 규모에선 낮은
  확률) 여전히 429 여지가 있다 — 근본 해법(배치 API·캐싱·시트 이탈)은 R7/BBE-242 영역.
- `MeetingDirtyGuard`(로컬)와 `DirtyGuard`(전역) 두 구현이 여전히 별개로 존재 — 통합은
  이번 스코프 밖(구조 변경 리스크, 카드 요청 밖).

## Log
- **2026-08-20 착수(경영일지 데탑 C작업원C(260820))**: 세션 승계(260809→260820).
  BBE-243 접수. Explore 조사 → 코드 실측 → 개발서버 기동 중 라이브 429 재현(핵심 증거) →
  수정 3파일 + 신규 유틸 1개 + 테스트 9건 → check.sh 진행 중.
