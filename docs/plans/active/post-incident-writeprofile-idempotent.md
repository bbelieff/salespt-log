> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 2026-05-13 사고 후속 — writeProfile 멱등 동작 + ADR-0004 + setup-sheets 플레이북 v4
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/service/auth.ts` claimAccount, `lib/repo/sales.ts` readProfile
> - **읽고 나면 알 수 있는 것**: B3/C3 멱등 쓰기 이유, 적용 범위
> - **관련 문서**: `docs/decisions/0004-post-incident-hardening-2026-05-13.md`

## 작업 요약

- `claimAccount` 에서 `existingSheetId` 있을 때 B3/C3 무조건 건너뛰던 로직을
  "빈 셀만 채움" 멱등 쓰기로 교체
- 원인: 7기 5명 + 4기 손기학 C3 비어있음 사고 (시트 복제 후 B3/C3 미입력 케이스)
- ADR-0004 및 setup-sheets 플레이북 v4 문서화

## 완료 기준

- [ ] `claimAccount` else 브랜치: readProfile 후 빈 셀만 writeProfile
- [ ] `docs/decisions/0004-post-incident-hardening-2026-05-13.md` 생성
- [ ] `docs/playbooks/setup-sheets.md` v4 반영
- [ ] `scripts/check.sh` 전체 통과
