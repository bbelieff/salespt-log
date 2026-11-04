## 2026-11-04 · 통화 정리 PR-6 — 첫 업로드 고지·켜기
- feat/call-summary-on. belie 「PR-6 시작」.
- 담당 파일: `app/(app)/db-sheet/_components/{CallDial.tsx,CallUploadDialog.tsx,CallConfirmScreen.tsx,CallUi.tsx,use-calls.ts,call-client.ts,call-confirm-model.ts}`, `call.css`, confirm route 주석, components.md, 시험 1개(+문구 맞춤), 합성 화면(`?s=notice`), [plan](../plans/active/call-summary.md). 선행: PR-5b(#1309) 병합·배포(run 41734028552, health 200), 유료 Gemini 키 VPS 등록(무료 모델 목록 조회로 확인).
- 고지(D6): 이 폰에서 처음 보낼 때 한 번. 문구 근거 = Gemini API 약관(유료 서비스, 2026-11-04 확인) + 현재 코드(녹음 삭제 시점). 법률 검토 아님 — belie 문구 승인.
- 화면 재편(belie 지시): 50대 기준 글자 최소·흐름 단축, 부품·크기·컨택결과 드롭다운은 DB정보와 같게. 스킬 impeccable(distill·clarify, Operate).
- 새소식: 공개 미룸(스위치가 일부뿐이라 전체 팝업은 못 쓰는 기능 알림) — `Changelog-Group` 숨김 유지.
- 남김: 운영 `.env` `CALL_SUMMARY_EMAILS` 등록(belie 먼저, 연습 기수 명단은 belie), 실제 폰 한 바퀴.
- 되돌리기 = squash revert(고지만 빠짐). 기능 끄기 = `CALL_SUMMARY_EMAILS` 비우고 재시작.
