> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리시트에 「진행 단계」 칸 — 어느 탭에서 이어 갈지 바로가기(STEP 3 일정 / STEP 4 실무/수납).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/db-sheet/_components/{model,Grid,column-widths,visible-columns}`, `lib/service/db-sheet-status.ts`(contractRow)
> - **읽고 나면 알 수 있는 것**: 칸 규칙 · 링크 목적지 · 저장값 영향
> - **관련 문서**: [db-sheet-merge-stage-into-result](db-sheet-merge-stage-into-result.md)

# 진행 단계 바로가기 (2026-10-25 belie)

- 칸: 컨택결과 바로 뒤 「진행 단계」. 미팅 잡힌 DB → 「STEP 3 일정 →」(`/schedule?date=&focus=미팅`), 계약 연결 DB → 「STEP 4 실무/수납 →」(`/payment?row=`), 옆에 지금 상태 한 마디(미팅예약·수납대기 등). 미팅 전 DB 는 「—」(DB관리시트에서 이어 감). 미팅 삭제됨은 바로가기 없음.
- 컨택결과 꼬리표는 장기관리·진행종료만(미팅 뒤 진행은 이 칸으로 옮김 — 같은 정보 두 번 금지).
- 서버 읽기 투영에 `contractRow`(저장 안 함, persist 에서 삭제). 보여줄 항목 저장 키 v7 — 예전 저장값엔 진행 단계를 한 번 넣는다.
- 시험: stepShortcut·resultTag·저장값 이전. 되돌리기: squash revert.

## DB정보 칸 순서 (같은 PR, belie 확정)
- 공급처 유형·공급처(3열이면 공급처가 줄 끝까지) → 사업자명·사업자등록번호·업종 → 매출·필요자금·주소 → 대표자·전화번호·신용점수 → 체납여부 → 원본 메모 보기 → 유입일·최초상담일·다음 연락일. 컨택결과·컨택내용은 맨 위 그대로, 장기관리·진행종료는 컨택결과 묶음 안 그대로.
- 「메모」 칸은 따로 두지 않음 — 원본 메모 보기와 같은 내용이라 두 번 보이지 않게(belie 원칙 ①).
- 확인(합성 db-sheet-live 1500px): 칸 줄 위치 실측으로 위 순서 확인.
