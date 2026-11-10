---
status: completed
slug: ui-decisions-small
created: 2026-11-10
owner: belie
completed: 2026-11-10
---

# UI 결정 3건 — DB 추가 입구 하나·주차 추이 이번 주·공지 미리보기/기본 꺼짐

## Intent
belie(2026-11-10, UI 점검 결정 「추천대로」): 같은 화면에 같은 일을 하는 버튼이 여러 개, 주차 추이가 3주차에도 12주차를 강조하고 미래 주를 0으로 그려 계약선이 떨어지는 착시, 공지는 저장하자마자 수강생에게 뜨고 미리 볼 방법이 없음.

## Acceptance Criteria
- [x] DB관리시트: 「＋ DB 추가」 = 목록 위 버튼 1개 + DB 0건일 때 빈 목록 안내 버튼만. 「오늘 활동」 닫힘 칩·펼친 아래줄의 「＋ DB 추가」, 공급처 성과 0건 안내의 「DB 가져오기」(모두 같은 `setImporting(true)`) 제거.
- [x] 주차 추이: `currentWeek`(computeCourseBanner — lib/util/week 정본) 막대 brand-red + 「이번 주」, 미래 주는 값 없는 점선 빈 칸, 계약수 선은 이번 주에서 끊김. 제목 옆 「N주차까지 계약 M건」(기존 weeklyTrend 합).
- [x] 관리자 공지: 「미리보기」 = 수강생용 `NoticePopup` 그대로, 저장·게시·읽음 기록 없음. 새 공지 기본 꺼짐, 「켜기」로 켬. 기존 공지 값은 그대로.
- [x] 단위 시험(합성 값)·components.md 동기화.

## 범위 밖 / 남김
- 서버 `SaveBody.active` 기본값(true)은 그대로 — 화면이 항상 active 를 실어 보내므로 다른 호출자 영향 없음.
- 최근 8주 보기(수료 후)는 마지막 칸이 이번 주라 미래 칸 없음.
- `docs/design/preview.html` 미갱신(차트·공지 관리 화면 견본이 없음).
