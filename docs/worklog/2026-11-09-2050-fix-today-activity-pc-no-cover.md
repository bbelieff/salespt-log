> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: PC 오늘 활동이 DB 목록을 가리지 않게.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB 목록 「오늘 활동」
> - **관련 문서**: [계획](../plans/completed/today-activity-pc-no-cover.md)

# 2026-11-09 fix: PC 오늘 활동이 목록을 가리지 않게

- 브랜치 fix/today-activity-pc-no-cover. 담당 파일: TodayActivity.tsx · db-sheet.css · today-activity.test.ts · components.md.
- 결정: belie 2026-11-09 「그렇게 해줘 바로운영반영」「근데 수치는 보이도록」.
- 검증: today-activity 시험 8건 + check.sh + CI. 합성 정적 화면 1024/1280/1700 수치 확인.
- 위험/복구: 화면만. 되돌리기 = revert.
