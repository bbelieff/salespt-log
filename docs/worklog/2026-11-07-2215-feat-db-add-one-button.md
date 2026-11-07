> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 「＋ DB 추가」 하나로 — 녹음을 놓으면 채널만 묻고 새 DB + 통화 정리.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB 목록 상단 버튼 · 가져오기 창 · 통화 정리 확인
> - **관련 문서**: [계획](../plans/completed/db-add-one-button.md)

# 2026-11-07 feat: DB 추가 하나로

- 브랜치 feat/db-add-one-button. 담당 파일: app/(app)/db-sheet/page.tsx · _components/{ImportDialog,CallImportStep,call-import,CallUi,CallConfirmScreen,DirectInputDialog}.tsx·ts · adaptive-import.css · tests/components/{db-add-one-button,db-sheet-filter-theme}.test.ts · docs/design/components.md.
- 결정: belie 2026-11-07 목업 J3·K1·K2 승인, 녹음한 날 = 유입일. DB 구조 변경 없이 줄 먼저 만들기.
- 검증: 위 시험 + 합성 화면 PC·폰 흐름 확인. 실제 AI 정리는 운영 배포 뒤.
- 위험/복구: 통화 기능 꺼진 사람은 기존과 같음(직접 입력 위치만 창 안으로). 되돌리기 = revert.
