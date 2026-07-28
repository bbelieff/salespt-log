> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 시트 없는 계정(트레이너 행 등) 임퍼스네이션 시 읽기 API 전면 500·빈 화면이던 P1을 — 진입 차단(409) + 서비스 [no-sheet] 가드(404 매핑) + 대시보드 에러 안내로 수리한다.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: admin 임퍼스네이션(switch) · dashboard/daily/meetings 읽기 라우트 · Cowork 🚨🚨(7/26~27)
> - **읽고 나면 알 수 있는 것**: ① "T기 김믿음" 500의 진짜 원인 ② 왜 #626이 아니었나 ③ 3중 방어선 구조
> - **관련 문서**: docs/worklog.md 2026-07-26/27 Cowork 🚨 항목 · #629(별건 — 파서 500과 구분)

# 시트 없는 계정 임퍼스네이션 500 수리 (P1)

- **상태**: 구현 → PR
- **트랙**: A (DevA) · 긴급 배정

## 1. 원인 (라이브 재현 + 데이터 실측으로 확정)

- **"T기 김믿음" = `beliefkimkim@gmail.com`의 트레이너 행**(registry row 25: cohort="T",
  status="trainer", **spreadsheetId 빈값**). "T기"는 기수가 아니라 트레이너 표기.
- admin 임퍼스네이션으로 진입 → 읽기 서비스들(loadDashboard·loadContactDay·loadWeekMeetings)이
  **빈 spreadsheetId 그대로 시트 API 호출** → Google이 HTML 에러 페이지 반환 → googleapis가
  HTML 전체를 Error.message로 throw → route catch가 500 + HTML을 error 필드에.
  (재현: admin 세션에서 switch → /api/dashboard = 500, error 필드에 `<!DOCTYPE html>…ppConfig` —
  Google 접근오류 페이지.)
- **#626(W1-0) 무관**: 상수 배선은 spreadsheetId 처리와 무관하고, 값 동일이라 계정 의존적 차이를
  만들 수 없음. "연습기 연습용" 정상(=시트 보유)과 정합. 시트 없는 행 임퍼스네이션은 예전부터
  500이었을 기존 결함 — 7/27에 처음 시도된 것.
- ※ 7/26~27의 **연습 계정** 500은 별건(#620 파서 — #629 revert로 해소 실측 완료)과 겹쳐 있었음.

## 2. 수리 — 3중 방어선

| 층 | 파일 | 내용 |
|---|---|---|
| ① 진입 차단(근본) | `app/api/admin/switch/route.ts` | 대상 spreadsheetId 빈값 → **409** + 한국어 안내(`code:"no_sheet"`). UI(AdminUserPicker·TrainerCohortView)는 기존 `setError(data.error)` 경로로 그대로 표시. 수강생출신 트레이너는 아레나 행 우선(pickPreferredUser)이라 시트 보유 → 차단 안 걸림 |
| ② 서비스 가드(방어) | `lib/service/{dashboard,contact,contact-week}.ts` (4지점) | 빈 sheetId → `[no-sheet]` 명시 throw (구글 HTML 에러 대체) |
| ③ route 매핑 | dashboard·daily(GET/PATCH)·meetings-week route | `[no-sheet]` → **404 {error:"no_sheet"}** (500 아님) |
| ④ 에러 안내(부수결함) | `app/(app)/dashboard/page.tsx` | isError 시 안내 카드 — no_sheet 전용 문구 / 일반 오류 문구. (전 탭 에러 UI 통일은 별도 트랙 제안) |

## 2.5 적대 리뷰(3렌즈×반박, 13에이전트) 확정 4건 — 전부 반영

1. **오차단 회귀(내 초안의 결함)**: `pickPreferredUser`는 **trainer 행 최우선**(P14 — 내 주석
   "아레나 우선"은 반대) → [T행(빈 시트)+아레나행] 수강생출신 트레이너(류서하·최정한 실계정)의
   합법 self-view 경로를 409가 차단할 뻔 → **`resolveOwnArenaSheetId` 보유 시 허용** 예외 추가.
2. **스테일 쿠키(HIGH)**: 이미 걸린 임퍼 쿠키(30일)는 ①을 우회 — 409 시 **같은 대상 쿠키면 함께
   해제**(재시도 = 자가 해제). 완전 자가치유(매 요청 검사)는 비용 대비 과해 후속 제안.
3. **이중 에러 카드**: 기존 isError 블록(p-4 안)과 신규 카드 동시 렌더·문구 상충 → 기존 블록 제거, 카드 1곳 통합.
4. **커버리지**: calendar 월뷰·todos·contract-payment resolve 3지점 가드 + route 5파일(10 catch) 404 매핑 추가.
   db/leads 읽기는 기존에 빈 데이터 강등(500 아님)이라 제외, gcal-connect(토큰 흐름)는 시트 무관이라 제외.

## 3. 되돌리기

단일 PR revert. 데이터 무접촉. ①을 되돌리면 예전처럼 임퍼스네이션은 되지만 빈 화면.

## 4. 남긴 것 (후속 제안)

- 전 탭(컨택·일정 등) 공통 에러 안내 UI — 이번엔 대시보드(진입점)만.
- admin 목록에서 시트 없는 행의 "웹앱" 버튼 자체를 비활성 표시(UX) — 서버 409가 안전망이므로 후순위.
