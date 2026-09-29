> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납 — 선택된 진행건의 기관 묶음은 접히지 않게, Drive 연결 패널은 다시 눌러 접을 수 있게.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/_components/{InstitutionWorkList,DriveLinkBar}.tsx`
> - **읽고 나면 알 수 있는 것**: 무엇을 바꿨나 · 되돌리는 법
> - **관련 문서**: `docs/design/components.md`

# 실무/수납 접기 동작 정리 (2026-09-29, belie)
- 진행기관 탭: 선택된 진행건이 든 기관은 항상 펼침(헤더 클릭 무시, 화살표 숨김, aria-disabled). 다른 기관은 그대로 접고 펼친다.
- Drive 연결(미연결) 버튼: 누르면 연결 패널이 열리고 다시 누르면 접힌다(aria-expanded).
- 되돌리기: squash 커밋 revert. 데이터 변경 없음.
