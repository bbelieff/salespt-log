> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 라이브 오염 지혈 — 비용원장 #620(fed3307, DB cost parity)을 통째로 되돌린다(D VERIFY NO-GO blocker ① 원인 커밋).
> - **누가 읽나요**: 개발자 (D 재판정·E 오염 스캔·재설계 후속 트랙)
> - **어떤 기능·작업과 연결?**: r4-wave1-verify NO-GO (dispatch-queue) · lib/repo/db.ts 파서 · expense-ledger
> - **읽고 나면 알 수 있는 것**: ① 왜 revert가 fix-forward보다 먼저인가 ② 무엇이 되돌아가고 무엇이 남는가 ③ 재적용 경로
> - **관련 문서**: docs/coordination/dispatch-queue.yaml(r4-wave1-verify) · docs/plans/completed/… (#620 원 plan은 revert로 제거 — git 이력 fed3307 참조)

# 비용원장 #620 revert — 라이브 오염 지혈 (rollback executor)

- **상태**: 실행 중 → PR
- **트랙**: A (DevA) · WORK-ID `R4-EXPENSE-REVERT-620` · FOREMAN 배정 (D의 최소 revert 셋 확정분)

## 1. 왜 (D VERIFY NO-GO — blocker ① 원인 커밋)

#620이 **전 기수 공용** 시트 파서(lib/repo/db.ts)의 neo 판정을 변경 → 비파일럿 수강생의
직접생산 비용·영업이익이 **입력 변경 없이** 바뀌는 라이브 오염(legacy 시트 O열 잔여 텍스트
1자로 레이아웃 오판·금액 전도). D 판정: 조치안 A(revert)가 정본 — "비파일럿 파서 원복 후
파급 산정하여 재설계". #615 본체 revert는 belie 게이트(미결정 시 #620만 내린 상태 유지).

## 2. 범위 (기계적 revert of fed3307)

- **되돌림**: lib/repo/db.ts 파서 변경, db-cost-ledger.ts(신설분 삭제), expense-ledger.ts,
  types, UI 2컴포넌트, 관련 테스트, components.md(SSOT — 코드 반영 원칙), #620 plan 문서.
- **보존**: docs/worklog.md (append 전용 — #620 기록 포함 현행 유지).
- **재적용 경로**: git 이력(fed3307)에서 언제든 복원 — 재설계 시 파급 산정 후 새 PR.

## 3. 소유권 (Codex writer → Claude 인수)

#620 writer = Codex DEV 트랙. **provider 교대 규칙에 따라 Claude(TRACK-A)가 인수하여 실행**
(워크로그 📮 ⓑ 명기: "Codex writer 소유권은 provider 교대 규칙으로 Claude 인수 명기").
커밋 본문에 동일 명기.

## 4. 남는 것 (이 revert가 해소하지 않는 blocker)

- blocker ②(read/write 필터 비대칭)·③(반복비용 split 이중계상)은 **#615~#619 잔존분** —
  이 revert 범위 밖(D 매핑 기준). E 오염 스캔·belie 게이트(#615 오프 여부) 후속.

## 5. 되돌리기

이 revert 자체의 revert = fed3307 재적용과 동일 (가역).
