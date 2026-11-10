> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: UI 결정 2-A(작은 버튼에 보이지 않는 44px 누름 영역)·결정 5(네이티브 날짜 칸 11곳 → 요일 보이는 달력)를 한 PR 로.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/globals.css`(hit-44·날짜 칸), `components/ui/DateInputCustom.tsx`, 아래 화면 파일
> - **관련 문서**: [tokens §터치 타겟](../../design/tokens.md) · [components §2 Date Input](../../design/components.md)

# 터치 영역·날짜 칸 통일 (2026-11-10)

## 목표 (belie 승인 결정)
1. **결정 2-A** — 보이는 크기는 그대로, 보이지 않는 누름 영역을 최소 44×44px. 공용 유틸 하나(`hit-44`, 세그먼트용 `hit-44-y`).
   적용: 컨택 −/＋(30px, 간격 4→8px), DB 카드 「삭제」·×(간격 4→8px), 일정 변경·취소 사유 버튼(~20px, 간격 4→8px), 시간 분 세그먼트(28px, 세로만), 수강생 카드 「담당」·「팀 변경」, 글자 크기 −/+(24px, 「가」 좌우 2→4px).
2. **결정 5** — 네이티브 `<input type="date">` 11곳을 컨택 화면의 `DateInputCustom`(요일 표시·직접 그리는 달력)으로. 값 `YYYY-MM-DD`·onChange 계약·min/max/required·이름표 유지.
   일정: 일정 변경·추가 미팅·미팅 날짜 / 수납: 계약일(연결 칸)·수납일 등(진행건 칸)·이전 계약·업체추가 / 할 일: 팝업·바로 추가·「+ 다음」 / 캘린더: 일반 일정.

## 변경
- `DateInputCustom`: 겉 칸을 진짜 `<button>` 으로(label htmlFor·disabled), `id`·`className`·`compact`·`disabled`·`required`·`name` 추가. required/name 은 숨은 입력이 브라우저 검사·FormData 를 받는다. Enter/Esc 가 감싼 줄 단축키로 새지 않게. 팝오버 빈 곳 클릭이 라벨을 거쳐 다시 열리지 않게.
- `TimePicker15`: 세그먼트 `overflow-hidden` 제거(누름 영역이 잘리지 않게) + 첫·끝 버튼 둥근 모서리.

## 범위 밖 (그대로 네이티브)
- DB 목록(`db-sheet`) 5곳 — 다른 담당 영역·셀 편집기(그리드 안 즉시 편집)·기간 선택. 관리자 공지·기수 만들기·시즌 시작·가계부·`PeriodPicker`. 허용 목록으로 고정, 새로 늘면 시험이 잡는다.

## 검증
- `tests/components/ui-touch-date.test.ts`(새, 교체 11곳·허용 목록·라벨/필수/비활성/Enter·hit-44 적용·간격) + 기존 시험 4개 갱신(날짜를 달력으로 고르는 도우미 `tests/components/pick-date.ts`).
- tsc, 관련 vitest. 실제 화면 확인 NOT_RUN(로그인 필요) — 총괄이 check.sh·화면 확인.

## 되돌리기
squash 커밋 1건 revert. 화면만, 저장 값 형식·데이터 변경 없음.
