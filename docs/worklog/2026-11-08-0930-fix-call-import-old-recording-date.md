> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 지난 녹음의 통화 시각 7일 → 90일, DB 추가 창 옛 안내 3개 제거.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB 목록 「＋ DB 추가」·녹음 올리기
> - **관련 문서**: [계획](../plans/completed/call-import-old-recording-date.md)

# 2026-11-08 fix: 지난 녹음 날짜 맞추기 + 옛 안내 지우기

- 브랜치 fix/call-import-old-recording-date. 담당 파일: lib/config/index.ts · lib/service/call-summary.ts · app/(app)/db-sheet/_components/{call-import.ts,CallUploadDialog.tsx,ImportDialog.tsx} · 위 시험 2개 · plans(call-summary 한 줄).
- 결정: belie 2026-11-08 승인(남은 항목 리스트 중 두 개).
- 검증: check.sh + CI. 운영은 배포 뒤 health·version.
- 위험/복구: 서버 검증 범위만 넓힘(저장 구조 그대로). 되돌리기 = revert.
