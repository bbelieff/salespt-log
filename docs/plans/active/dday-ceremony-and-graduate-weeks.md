> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 D-day·수료 판정을 종강총회일 하나로 맞추고, 수료 뒤 "수료 후 N주"를 보여 주며, 일정 탭 "매출" 문구를 "이번 주 계약"으로 바로잡는다(화석 조사 D1·D2·D7, belie 2026-10-15 권장안 승인).
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `app/(app)/dashboard/_lib/course-banner.ts`(신규) · `DashboardProgressBanner` · `DDayBadge` · 일정 `SummaryBar`
> - **읽고 나면 알 수 있는 것**: 무엇이 어긋났나 / 어떻게 맞췄나 / 되돌리는 법
> - **관련 문서**: ADR-0031·0032·0034, `docs/design/components.md` §9-1

---
slug: dday-ceremony-and-graduate-weeks
status: active
created: 2026-10-15
branch: fix/dday-ceremony-and-graduate-weeks
---

# D-day 총회일 기준 · 수료 후 N주 · "이번 주 계약"

## 무엇이 어긋났나
- 10기+ 대시보드: 라벨은 종강총회일(10기 10/25)인데 D-day·수료 판정·진행바는 12주 마지막 날(10/29) 기준 → 10/26~29 에 "총회 지났는데 D-3".
- 수료 뒤에는 "🎓 수료"만 — 수료 후에도 계속 쓰는 무제한 CRM(ADR-0031)인데 얼마나 지났는지 안 보임.
- 일정 탭 "💰 매출" 은 실제로 이번 주 계약 수임비+그 계약 수납액(반환·수납일 무시) — 대시보드의 기간 매출(ADR-0034)과 이름만 같고 값이 다름.

## 바꾼 것
- `computeCourseBanner`(순수 함수): 기준일 = 총회일(없으면 수강 종료일). D-day·`graduated`·진행바·라벨이 같은 날을 본다. `weeksAfterGraduation` = 수료 다음 날~7일째 1주, 8일째 2주 ….
- 배너: 수료 뒤 `🎓 수료 후 N주`. 일정 SummaryBar: `💰 이번 주 계약`.
- 계산 값 자체(주차·매출 합)는 그대로 — 기준일과 문구만.

## 검증 · 되돌리기
- `tests/components/course-banner.test.ts`(10기 총회 다음 날 수료, 총회 당일 D-DAY, 1/1/2/2/3주, 9기 O2, 날짜 없음, 배너 문구 2). check.sh 전체.
- 되돌리기: squash revert 1건. 데이터 변경 없음.