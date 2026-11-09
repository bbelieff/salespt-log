> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB 붙여넣기 항목 줄·값 줄 형식 인식.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB 목록 「＋ DB 추가」·DB 시트 자동 확인(같은 분석기)
> - **관련 문서**: [계획](../plans/completed/db-import-label-value-lines.md)

# 2026-11-09 fix: DB 붙여넣기 항목 줄·값 줄

- 브랜치 fix/db-import-label-value-lines. 담당 파일: lib/analytics/db-import/adaptive-import.ts · lib/analytics/db-import/model.ts(별칭 3개) · 새 시험 1개.
- 결정: belie 2026-11-09 채팅 「지금방식으로도 볼 수 있게 해줘」. 받은 실제 글은 저장하지 않고 가상 값으로만 재현.
- 검증: 가져오기 시험 138건 통과 + check.sh + CI. 운영은 배포 뒤 health·version.
- 위험/복구: 조건(전화번호 포함 항목 줄 3개+, 콜론·탭 없음)일 때만 동작. 되돌리기 = revert.
