> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 미팅 잡은 업체도 DB정보에서 업체정보를 고쳐 미팅에 바로 저장하게 한 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB관리시트 DB정보 컨택 칸(ContactPanel)
> - **관련 문서**: [계획](../plans/completed/db-contact-company-edit-after-meeting.md)

# 2026-11-07 fix(db-sheet): 미팅 잡은 업체도 업체정보 고치기

- 담당 파일: app/(app)/db-sheet/_components/ContactPanel.tsx · DbDetail.tsx · tests/components/db-contact-meeting-company-edit.test.ts.
- 서버 무변경: 미팅 쪽 저장은 기존 PATCH /api/meeting/:id(컨택관리와 같은 길, 부수효과 포함). DB 줄 읽기 전용 규칙 유지.
- 저장 뒤 시트 reload(대기 중인 줄 편집은 먼저 저장). 미저장 편집은 syncServer 로 보존.
- 위험/복구: 화면·저장 경로 재사용. 되돌리기 = revert.
