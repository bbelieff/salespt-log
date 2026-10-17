---
slug: db-inflow-two-state-release
status: implementing
created: 2026-10-18
---
# DB 유입 실제 기여 두 상태 · C 릴리스

- 사용자 두 정상 상태 확정 및 Root 승인 A→B→C 순차 배포 계약. writer/release owner019fe6a6, 독립 F019fe6a9, Root019f758e. B PR1169 merge df91e388bd487aa6647c5004a9de2ef893abedf1/deploy39047747290 SUCCESS 뒤 같은 clean 전용 WT에서 feat/db-inflow-two-state-release 시작. base는 해당 origin/master. Node24·lockff033cd1·own 완전 설치 재사용, npm ci 반복0.
- 제품 lease 정확5: lib/repo/db/db-sheet-recording.ts, lib/repo/db/db-sheet.ts, lib/types/db-sheet.ts, app/(app)/db-sheet/_components/model.ts, app/(app)/db-sheet/_components/InflowStatusCell.tsx. 원본 db-sheet-date-theme-mock dirty는 읽기만 하고 core 후보를 좁게 추출한다. A/B 레이아웃·iconOnly 표시 계약, auth/service/API/schema/config/lock/workflow 불변.
- 추가 lease: 관련 repo/PGlite/UI 테스트 및 기존 tests/browser/recording-release/server.mjs에 opt-in 합성 오류 행 seed만, docs/domains/data-model.md 2줄, docs/design/components.md·tokens.md·preview.html의 상태 의미만, 본 plan/worklog·선행 B plan 완료 이동. 고객/외부/Drive/권한/OAuth/백필/운영 시험쓰기0. helper/새세션0, Root Pages 수정0.
- 정상 상태는 실제 소유 ledger 기여 recorded/count1 또는 excluded/count0. 미래 OFF와 이미 반영된 기여 분리, 수동 총량 보존, tenant/date/channel 전체 소유기여·안전 정수·production 동치 검증, preview/apply 동일 guard·revision/transaction rollback 유지. 옛 legacy 생성 +1/marker는 실제 과거 코드를 대조한다. history 부재만으로 unknown 정상 상태를 만들지 않으며 내부 삭제 근거는 보존한다.
- 필수 보강: list 순수 per-row projection의 실제 DbSheetOperationBlocked만 격리, 해당 행 inflowStatus 명시 삭제(stale raw 값 포함). 정상 행은 유지하고 현행 C UI 명시 alert/write0로 표시한다. SQL/권한/global read 및 다른 예외는 전파한다. 단건 read·preview/apply/persist는 엄격 차단 그대로. fakeOFF/정상 제3상태/자동 복구0.
- 수용 검사: 현재 focused PGlite/API/UI; bad1+good1, raw stale 삭제·읽기/수화 write0, global query/비검증 오류 전파, 오염 행 모든 mutation persist0, 정상 행 작업 가능, 같은 ledger의 bad peer를0으로 추정하지 않는 strict guard. B 호환 tests는 삭제/skip 대신 정상 두 상태와 오류 write0 단언으로 갱신한다. 옛129 결과를 현재 PASS로 재사용하지 않는다.
- 개발 집중86 PASS 및 API/B UI 경계97 PASS, compact 오류 표시 수정 후 관련51 PASS(exit0). 최종 전체 훅은 뒤에 별도 실제 수행한다. 과거2c046944의 contributions +sign과 _dbSheetInflow 누적을 직접 대조했다. C 신규 격리7/Pure오류전파1은 합성 DB만 사용한다.
- 실제 UI: 기존 recording-release 하네스+현재 제품/API/PGlite에서 정상2행/오염1행을 opt-in seed. 320/375/430 목록3각48px·overflow0, 오류는18px 높이 짧은 경고·전체 aria-label/title, 정상 두 아이콘 유지. 오류 상세 유입radio0·전체 안내, 정상 미반영 상세radio2/활성/미반영선택. PC1280 목록3행·두 정상 배지/오류 유지·외부overflow0. 원본 source 소유 artifacts/liquid-glass-tools/release-c-{mixed-320,mixed-375,mixed-pc,error-detail-375}.png는 로컬 합성 증거이며 운영 인증/저장 증거가 아니다. 서버4322 초기 묶음은 오래된 UI를 보여 own 프로세스만 종료하고4323 새 묶음으로 현재 바이트를 재확인했다.
- 최종 테스트 manifest: tests/repo/db-sheet.pglite.test.ts, db-sheet-adaptive.pglite.test.ts, db-sheet-inflow-two-state.pglite.test.ts(new), db-sheet-inflow-isolation.pglite.test.ts(new), db-sheet-list-projection.test.ts(new); tests/components/db-sheet-recording-ui.test.ts, db-sheet-ui-controls.test.ts, db-sheet-inflow-icon-compat.test.ts; tests/api/db-sheet.test.ts; tests/browser/recording-release/server.mjs. 이 외 제품·테스트 경로는 수정하지 않는다. 문서 manifest는 앞서 명시한 SSOT4/본 plan/worklog/B plan active→completed 이동이다.
- 최종 안정 바이트의 정상 commit hook scripts/check.sh 전체1, 공식 현재 PR CI check/build 및 Security SUCCESS, F actual head/tree PASS. Root 명시 환경 예외로 A local build의 확인된 OOM을 재현하지 않고 C local build NOT_RUN; 기존 공식 production build job을 사용하며 skip/heap/workflow 변경0. 필수 CI 실패는 수정한다.
- 최신 base/head/CLEAN·배포 점유0 뒤 expected-head 직렬 squash→자동 deploy→remote HEAD/cutover·served build ID·health·허용 UI를 분리 확인한다. 인증 UI/실저장·실제 오염 분포/고객 사용은 NOT_RUN이며 health로 대체하지 않는다. 새 정책/범위 필요 시 Root에 차단 보고. 원복은 C squash 정상 revert와 동일 검사/직렬 배포, 데이터 수리 없음.
