> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 미팅예약을 골랐는데 STEP 3 에 안 올라가던 구멍 막기(자동 예약 등록 + 서버 차단 + 「일정 미등록」 표시).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB관리시트 · 통화 정리 확정
> - **관련 문서**: [계획](../plans/completed/meeting-booking-step3.md)

# 2026-11-08 fix: 미팅예약 → STEP 3 보장

- 브랜치 fix/meeting-unregistered-hint. 담당: lib/repo/db/db-sheet.ts(saveDbSheetContact requireMeeting) · lib/service/{db-sheet,call-confirm}.ts · app/(app)/db-sheet/{page.tsx,db-sheet.css,_components/{ContactPanel,DbDetail}.tsx} · lib/analytics/db-import/model.ts · tests.
- 결정: belie 2026-11-08 「미팅예약 정보가 기록되면 바로 STEP 3 확정, 수기·녹음분석 모두」. 예전 줄은 자동 등록하지 않음(일별 기록 미팅과 중복 위험) — 「일정 미등록」으로 찾게만 했다(자율결정, 되돌리기 쉬움).
- 검증: 관련 시험 90개 + check.sh + CI. 실제 수강생 데이터는 조회하지 못했다(운영 DB 직접 조회 차단) — 김재원 건은 캡처로 원인 확인.
- 위험/복구: 미팅예약 결과를 단독 저장하던 경로가 409 로 바뀜(화면은 미리 미팅예약 칸으로 보냄). 되돌리기 = revert.
