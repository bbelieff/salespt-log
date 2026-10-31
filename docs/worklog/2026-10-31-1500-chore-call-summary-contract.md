## 2026-10-31 · 통화 정리 PR-1 — 계약(타입·표)
- chore/call-summary-contract. belie 「1단계 시작」. 0단계(AI 비교) 완료: Gemini 3.1 Flash-Lite, 합성 12건 95~97% · 실제 목소리 역할극 3건 93%(숫자 틀림 0, 미팅 정확, 약점 = 주소·상호 음성인식).
- 변경: `lib/types/call.ts`(CallStatus·CallExtraction·CallMeetingDraft·CallRecord, 집 주소·주민번호 제외), `0014_call_records.sql`(추가 전용, db_sheet_leads 에 cascade), data-model 등재, 계약 시험.
- belie 「데이터 흐름의 시작은 DB관리시트 전화버튼」 → 상태 `dialed`(📞 누름, 녹음 전) 추가, calledAt = 누른 시각.
- belie 「안드로이드·아이폰은 다르게(아이폰은 에이닷·익시오로 저장)」 → `CallSource` audio|text 추가(글자 붙여 넣기 경로), 폰별 안내는 화면 PR.
- 계획 수정(현재 코드 실측): 대상은 DB관리시트 모든 행(매입DB 포함), 상담메모·업체정보·미팅 초안은 기존 `DbSheetContact` 칸 사용 → `lead_notes` 표 없음. [plan](../plans/active/call-summary.md).
- 운영 DB 적용은 아직 안 함(PR-2 병합 전 DB Migrate 워크플로). 되돌리기 = squash revert(표 미적용 상태면 데이터 영향 없음).
