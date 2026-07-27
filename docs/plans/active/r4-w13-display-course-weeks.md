> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R4 wave-1 W1-3 — 표시층에서 "코스 8주"와 "이후(수료 후) 기간"을 구분하고, 더미 날짜 하드코딩(G5 위반분)을 소거하는 계획.
> - **누가 읽나요**: 개발자, FOREMAN(Cowork), VERIFY(DevD)
> - **어떤 기능·작업과 연결?**: `app/(app)/dashboard/page.tsx`, `components/dashboard/*`, `components/DDayBadge.tsx`, `components/scoreboard/ScoreboardView.tsx`
> - **읽고 나면 알 수 있는 것**: 무엇이 표시층 한정인가 / 수료 후 화면이 어떻게 달라지나 / 왜 9주+ 차트 실렌더는 wave-2인가
> - **관련 문서**: `docs/plans/completed/r4-w10-shared-contract.md`(W1-0), `scratchpad/r4-hardcode-inventory.md`, worklog 📮🚀 wave-1

# R4 W1-3 — 표시층: 코스주차(1~8) vs 이후 구분

**상태**: 진행 중 (DevC, 2026-07-27) · WORK-ID `R4-W1-3-DISPLAY`
**브랜치**: `feat/r4-w13-display-course-weeks` (base a79ae39, W1-0 착지 확인)
**FOREMAN 판정(2026-07-27)**: 기본안 승인 — **표시층 한정**. 차트는 코스 1~8 유지 + 경계 명시.
9주+ 실렌더 확장은 wave-2 재라우팅 트리거 유지(집계 `w>8` 원천 폐기 + 시트 C33:H40 8행 물리고정).

## 1. 스코프 (전부 표시층 — 집계·라우팅·저장 무접촉)

| # | 파일 | 변경 |
|---|---|---|
| A | `app/(app)/dashboard/page.tsx` | ①더미 날짜 fallback("2026-04-10"/"2026-06-06") **제거** — me 없으면 배너 미렌더(G5 가드 위반분, FOREMAN 지시) ②코스주차(1~STATS_WEEKS clamp)·실주차(비clamp)·수료 여부(종강일 경과) **분리 계산** ③stale 주석 정리 |
| B | `components/dashboard/DashboardProgressBanner.tsx` | 수료 후 "N주차 진행중" → **"🎓 수료"** 표시(기본안·📥). props `graduated` 추가 |
| C | `components/dashboard/WeeklyDualChart.tsx` | 코스 1~8 유지 + **경계 명시**("코스 8주 기준" 부제) + 잔여 `/8` 산술 STATS_WEEKS 파생 |
| D | `components/DDayBadge.tsx` | 종강 후 `D+N`(회색) → **"수료"** 뱃지. JSDoc "+57일" stale 수정. 부수효과: 무제한 시 D+100 초과로 깨질 2자리(99일) 가정 자체가 소멸 |
| E | `OperatingProfitCard`·`ProductivityIndicators`·`ScoreboardView` | "8주 누적" 리터럴 3+3곳 → `STATS_WEEKS` 파생 라벨(stale 라벨 정리) |
| F | `tests/structural/period-hardcode.test.ts` | G5 BASELINE 에서 `app/(app)/dashboard/page.tsx` **소거** — 더미 제거 후 가드 영구 강제 |

## 2. 결정 근거

- **수료 판정 = 종강일(graduationISO) 경과** — 주차 산술이 아니라 날짜 비교. 코스는 50일(≈7.2주)이라
  8주차 *도중* 종강할 수 있어 "실주차 > 8" 판정은 부정확. O2 직접값이 진실(ADR-0005).
- **더미 제거 방식 = 배너 미렌더** — G5 에러 메시지 지침 그대로("더미 fallback 은 null 처리로").
  me 로딩 중엔 배너만 빠지고 본문(dash.data 기반)은 그대로 — 기존 헤더 주석의 렌더 보증 유지.
- **라벨 상수 파생** — 문구 자체를 상수에 넣지 않고 `${STATS_WEEKS}주` 보간만. 문구는 컴포넌트 소유.

## 3. 회귀·검증

- 재학 중(오늘 ≤ 종강일) 화면 **픽셀 불변**: 코스주차 계산이 W1-0의 clamp 와 동일 값, 라벨 문자열 동일("8주 누적").
- 수료 후: 배너 "🎓 수료", DDayBadge "수료", 진행률 100% clamp(기존 동작).
- me 미로딩: 배너 미렌더(더미 데이터 노출 0), 본문 렌더 유지.
- `bash scripts/check.sh` 초록(G5 baseline 소거 포함) → PR 오픈. **머지는 W1-1 뒤 직렬**(FOREMAN).

`Changelog: 수료 후에도 대시보드가 내 기간을 정확하게 보여줘요.`
