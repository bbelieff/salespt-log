> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 시트 없는 수강생 3단계 준비 — 명단 DB 읽기 실패 대응 + 0기 합성 시험 수강생 마이그레이션.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: ADR-0038 · `lib/repo/users.ts findUserByEmail` · `0020_sheetless_pilot_student.sql`
> - **관련 문서**: [계획](../plans/active/sheetless-student-id.md) · [2단계](2026-11-10-2000-feat-sheetless-stage2-skip-sheets.md)

# 2026-11-10 feat: 시트 없는 수강생 3단계 준비

- belie 승인(「권장안대로 하고 3단계 진행해」): 명단 DB 읽기 실패로 시트 명단을 봤는데 이메일이 없으면 DB 를 2회 더 읽는다.
  시트 명단에 있는 수강생은 재시도 0 → 기존 동작 그대로.
- 합성 수강생 1명(0기, local: 번호, `.invalid` 이메일)을 마이그레이션으로 추가 — 관리자 「보고 편집」으로 확인.
- 적용: 배포 후 db-migrate(installed) dry-run → execute. 복구: 해당 행 delete(마이그레이션 주석).
