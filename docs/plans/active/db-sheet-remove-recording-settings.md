> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리시트 「상담·미팅 반영 설정(STEP 2 기록 설정)」을 없애고 유입 반영 체크 하나만 남긴 수정.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `DbDetail`·`RecordingDialog`(삭제 전용)·`DirectInputDialog`·`ImportDialog`, `RecordingOptions` 삭제
> - **읽고 나면 알 수 있는 것**: 왜 없앴는지 · 남은 것 · 데이터 영향
> - **관련 문서**: [db-sheet-detail-compact](db-sheet-detail-compact.md)

# STEP 2 기록 설정 제거 (2026-10-25 belie 결정)

- 근거: 설정의 「유입」 스위치는 위쪽 유입 반영/미반영 토글과 같은 것(중복). 「상담·미팅」 끈 DB 는 운영 전체 221건 중 0건(실측 2026-10-25).
- 바꾼 것: DB정보 아래 「상담·미팅 반영 설정」 버튼 제거(영구삭제만), `RecordingDialog` 는 삭제 확인 전용, 새 DB 등록은 「STEP 2 유입에 반영」 체크 하나, 가져오기의 「새 상담·미팅도 STEP 2에 기록」 체크 제거(항상 기록), `RecordingOptions` 삭제.
- 데이터: 저장 형식(`recording.activities`)·서버 로직·기존 숫자 무변경. 새 DB 는 항상 activities=true.
- 되돌리기: squash revert.
