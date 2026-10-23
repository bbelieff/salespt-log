> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리시트 컨택결과 5가지 규칙(최초상담일·재통화 안내·업체정보 패널 너비·현재상태·이름·부재 다음날)을 한 번에 고친 작업 계획과 검증 기록.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `lib/types/db-sheet.ts` · `lib/repo/db/db-sheet.ts` · `app/(app)/db-sheet/_components/*` · `lib/analytics/dashboard-follow-ups.ts`
> - **읽고 나면 알 수 있는 것**: 최초상담일이 왜 안 찍혔나 / 현재상태·이름 규칙 / 부재 다음 연락일 규칙
> - **관련 문서**: [최초상담일 자동 기록 기준](db-sheet-first-contact-date.md) · [data-model](../../domains/data-model.md)

# DB관리시트 컨택결과 규칙 (2026-10-23)

브랜치 `fix/db-sheet-contact-rules`, base origin/master `ecbbdbe4`. 운영 데이터 일괄 수정·마이그레이션 없음.

## 요청 (belie, 쉬운 말 요약)
1. 재통화·단순거절도 최초상담일이 자동으로 찍히게. 재통화를 고르면 재통화 일정(다음 연락일)을 정하라는 안내.
2. DB정보에서 「컨택내용」을 열면 업체정보가 잘리는 일이 있다 → 안 잘리는 비율을 기본으로.
3. 현재상태: 단순거절·재통화 → 「DB컨택중」, AS신청 → 「진행종료」.
4. 이름만: 컨택진행 → 「미팅예약」, 상담 후 거절 → 「컨택 후 거절」(저장값 그대로).
5. 부재는 다음 연락일을 자동으로 다음날로.

## 1번 원인 (확인한 사실 + 추론)
- 저장 경로(`saveDbSheetContact`)는 #1159 이후 네 결과에서 최초상담일을 채운다 — 코드·시험으로 확인.
- 막는 조건은 `firstManual`(직접 입력 잠금)이었다. 표의 「최초상담일」 칸을 눌렀다가 그냥 떠나면(Grid blur 저장)
  값이 그대로 `""` 여도 `first-date` 명령이 나가 `firstManual=true·first=""` 로 저장됐다. 그 뒤로는 어떤 결과를
  골라도 자동 기록이 멈춘다(재현: `tests/components/db-sheet-autosave.test.ts`, 수정 전 요청이 실제로 나감).
- 운영 행이 실제로 이 상태인지는 운영 DB 를 보지 않아 **미확인(추론)**.
- 고침: ① 같은 값이면 `first-date` 를 보내지 않는다(store) ② 빈 값은 잠금이 아니다(`firstManual = first !== ""`)
  ③ 옛 `firstManual=true·first=""` 도 자동으로 본다(`nextDbSheetFirstContact`). 날짜를 넣은 직접 입력은 그대로 보존.
- 자율결정: 2026-10-17 「비우기도 잠금」 규칙을 뒤집는다. 근거 = belie 의 이번 직접 요청 + 비우기가 대부분 실수 클릭.
  되돌리기 = 이 PR revert.

## 구현
- 규칙 함수(`lib/types/db-sheet.ts`): `nextDbSheetFirstContact` · `dbSheetResultLabel` · `dbSheetContactStage`(+`DB_SHEET_CONTACT_STAGES`) · `autoDbSheetNextContact`.
- 저장소: 컨택 저장 때 현재상태·최초상담일·부재 다음날(새 예약 세대) 계산. 목록 읽기 때 미팅 없는 행의 현재상태를 다시 계산(저장값 무변경).
- 화면: 재통화 안내(`db-as-box` 재사용 + `db-contact-open` 모양 버튼) · 이름은 `outcomeDisplayLabel` 한 곳 · 필터 「미팅예약·컨택 후 거절」 · 정렬 순서에 DB컨택중/진행종료 · 대시보드 할 일 문구.
- 2번 패널 너비(실화면 측정): 우열(업체정보) 기본 560px 에서 업체정보 「확장보기」는 컨테이너 규칙(≤560 → 1열)과
  `2xl:col-span-2` 카드가 부딪혀 격자가 `0px 471px` 2열이 되고 왼쪽 카드가 19px 로 눌려 잘렸다(입력칸 10개 폭 <60px).
  고침 ① 좁은 업체정보에서 `2xl:col-span-2` 도 한 줄 전체로(CSS 한 줄) ② 우열 기본 560→680(최대값). 예전 기본 560 이
  저장만 된 경우도 새 기본으로 보고, 사용자가 끌어 바꾼 다른 값은 그대로 둔다.

## 검증
- [x] 단위·합성 PostgreSQL 시험(새 2파일 + 기대값 갱신 4파일) PASS
- [x] production build PASS
- [x] 실제 화면(db-sheet-live: 실제 페이지 + 실제 API + 합성 PGlite): 1280 — 최초상담일 칸 눌렀다 떼고 재통화 → 2026-10-23 기록·안내 표시,
  우열 680/좌 575, 확장보기 2열 295px×2 눌린 칸 0. 1280 우열 400(사용자 조절) → 1열·눌린 칸 0·값 보존. 1440 — 640/680, 가로 넘침 0.
  375 — 목록 현재상태(진행종료·상담 중·DB컨택중·부재)·안내 상자·버튼이 다음 연락일 칸으로 이동. API: 부재 → 다음 연락일 2026-10-24.
- [x] check.sh (pre-commit) — 타입·lint·구조·doc-drift 통과. 단위 4279 PASS, XLSX 압축 한도 시험 1건이 이 PC 부하에서 5초 시간초과(단독 실행 PASS, 변경 무관)
- [ ] PR·CI (병합은 총괄 직렬 큐)
