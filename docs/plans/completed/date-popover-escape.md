# 달력이 갇힌 창 밖으로 — PC 주간 보드 「새 날짜」 안 눌림

- 신고(2026-11-12, 수강생): 일정·계약 PC 주간 보드에서 미팅 창 → 변경 → 「새 날짜」를 눌러도 날짜를 바꿀 수 없음.
- 원인: 미팅 창(BoardPopover)이 `backdrop-blur`(backdrop-filter) + `overflow-y-auto`. backdrop-filter 는 자손의 position:fixed 기준을 화면이 아니라 그 창으로 바꾼다 → 달력(fixed, 화면 좌표로 계산)이 창 안 엉뚱한 곳에 그려지고 창 스크롤 상자에 잘려 안 보임.
- 변경: DateInputCustom 이 열 때 조상에 fixed 를 가두는 속성(backdrop-filter·transform·filter·perspective·contain)이 있으면 달력을 포털로 body(또는 열린 최상단 창) 아래에 그린다. 평소엔 제자리 그대로(초점·blur 계약 유지). 주간 보드 창은 이미 달력(role=dialog) 안 클릭을 바깥 클릭으로 치지 않는다. 유입 기간 팝오버(InflowPeriod)도 `.date-pop` 클릭을 바깥으로 치지 않게.
- 수용: tests/components/ui-touch-date.test.ts trapsFixed 시험, check.sh·build, 배포 후 PC 주간 보드에서 「새 날짜」 실제 확인.
