---
slug: dashboard-db-controls
status: active
created: 2026-10-17
worktree: C:/Users/belie/Desktop/Belief/클로드/wt/dashboard-db-controls-release
---

# 대시보드 목록 연결과 DB 필터·정보 조작 개선

## 승인·소유
- 사용자 승인: root Lead가 전달한 2026-10-17 “이것까지 하고 운영반영하자”. 같은 범위의 구현·검사·검수·직렬 병합·자동 배포·운영 확인까지 승인.
- 기준: `a72160b5118611e5d658dbf92a3fae7f60bd156c`, branch `feat/dashboard-db-controls`.
- writer/release owner: 경영일지 제작 세션 `019fe6a6-eb86-7081-a88b-8b3a7ad1a8c5`.
- 독립 검수: `019fe6a9-52ec-7fa3-89e6-6837c815295e`; 반환/통합 창구 root `019f758e-d007-7fd1-b48a-57d4fd23e67f`.
- 승인 자료: FOLLOWUPS R4 (`http://127.0.0.1:4317/?visualLink=1`)와 실제 `DBR2` (`http://127.0.0.1:4318/db-sheet?filterToggle=1`). 전용 목업 두 worktree와 증거는 보존. 제품에는 번들 변환/숨김을 이식하지 않고 실제 렌더/상태를 구현.
- PR1158/1136/798과 foreign/Claude 작업은 비접촉. master fetch·원격 열린 PR 확인 완료, 이 lease와 겹치는 열린 PR 없음.

## 정확 파일 lease
1. `components/dashboard/DashboardFollowUpsView.tsx`
2. `components/dashboard/useFollowUpsPopover.ts`
3. `components/dashboard/followups-table.css`
4. `app/(app)/db-sheet/page.tsx`
5. `app/(app)/db-sheet/_components/SupplierFilter.tsx` (신규)
6. `app/(app)/db-sheet/_components/status-filter.ts`
7. `app/(app)/db-sheet/_components/InflowPeriod.tsx`
8. `app/(app)/db-sheet/_components/DbDetail.tsx`
9. `app/(app)/db-sheet/_components/DbContactActions.tsx`
10. `app/(app)/db-sheet/_components/ContactPanel.tsx`
11. `app/(app)/db-sheet/_components/InflowStatusCell.tsx`
12. `app/(app)/db-sheet/_components/Grid.tsx`
13. `app/(app)/db-sheet/compact.css`
14. `app/(app)/db-sheet/_components/db-detail-compact.css`
15. `components/ui/PeriodPicker.tsx` (기존 기본값 유지, 날짜 입력을 별도 popover로 렌더할 수 있는 선택 prop만)
16. `tests/components/dashboard-follow-ups-table.test.ts`
17. `tests/components/db-sheet-status-filter.test.ts`
18. `tests/components/db-sheet-ui-controls.test.ts` (신규)
19. `tests/components/db-sheet-autosave.test.ts` (기존 preview/revision/failure 경계 필요 시만)
20. `docs/design/components.md`
21. `docs/design/preview.html`
22. `docs/worklog.md`
23. 본 plan (완료 시 `docs/plans/completed/dashboard-db-controls.md`).
24. `app/(app)/db-sheet/_components/SupplierSummary.tsx`
25. `tests/components/db-sheet-supplier-summary-ui.test.ts`
26. `app/(app)/db-sheet/_components/model.ts` (AS 표시명 helper만, 저장값/자동일 기준 불변)
27. `app/(app)/db-sheet/_components/ContactDbLeads.tsx` (동일 AS 표시명)
28. `tests/components/db-sheet-detail-actions.test.ts` (이전 팝업 진입만 DB정보 직접 진입 계약으로 갱신; preview/blocked/AS 검증 유지)
29. `tests/components/db-sheet-recording-ui.test.ts` (unknown navigation/헤더 차단 및 결과 집계 단언을 새 유일 select로 이동, 기존 값/날짜/활동OFF 단언 유지)

## 수용조건
- [ ] FOLLOWUPS: PC 모든 STEP/0건/분류/위치 clamp 연결점과 선, 요약 선택 장식 네모 없음·키보드 중립 밑줄, 42px 수준 한 줄 행/단일 헤더/긴 값 상세 경로/모바일 가독성. 집계·정렬 불변.
- [ ] 공급처 다중선택 합집합, 검색/기간/상태 교집합. 0선택=전체, 선택색 유지. PC1280/1440 한 행의 두 업무도구 스타일 그룹, 동일 font/칩 규격, 범위 입력 시 상태 top 불변, 모바일·필터 전용 overflow 처리.
- [ ] 고정 “전체 표시” 안내 제거. 실제 제한(검색/날짜/공급처/상태)이 있을 때만 동적 N건 표시하며 전체 공급처 버튼·전체 기간 칩·DB목록 총수는 유지.
- [ ] 공급처 성과는 toolbar 뒤/filter 앞. 유입→상담→미팅→계약 막대를 오른쪽 누적 정렬하여 계약 진한 구간은 우측, 계산/순위/20건 기준 불변. 집계기준 설명 UI만 제거.
- [ ] DB 경로 전용 100dvh flex frame/표 내부 scroll. 성과 panel cap, 표 최소 가용 높이, sticky/freeze/resize/키보드/모바일·popover 보존, 다른 경로 영향 없음.
- [ ] AS 저장값/조건은 `AS예정` 유지, UI에서만 `AS신청`. 집계/최초일 자동 대상 변화 없음.
- [ ] 표의 유입 셀은 상태 배지→DB정보 열기만. 편집 토글은 업체명 옆 한 곳. inflow 자동 배지만 제거, 타열 보존. 기존 preview→revision-bound configure·transaction·unknown 가드 유지; pending/실패/중복 방지.
- [ ] 컨택결과 상단 한 곳·각 option 기존 outcomeLabel 집계 안내, 컨택내용 중복 select·상담기록 버튼 실제 제거. 선택 컨택일 또는 KST 현재일로 기존 contact 명령 사용. 최초일/firstManual·활동 실적 분리·예약 성공 기준은 기존 계약 그대로. 날짜만 변경한 일일기록 새 트리거 없음.
- [ ] 좌/우 px 저장. 좌 바깥 grip은 좌만·우 고정. 중앙 grip 우 확대는 좌 여유를 min360까지 먼저 소모해 total 고정, min 후만 전체 확대·우측 끝 고정; 우 축소는 좌 복구. 우 기본560, 접기/펼침 상태 보존·키보드·min/max·viewport clamp·모바일 stack.
- [ ] 집중 RED/회귀, 정상 pre-commit 전체 1회, production build 1회, 실제 head/tree 독립 PASS와 CI/보안 성공.
- [ ] 최신 master/배포 점유 확인 후 expected-head squash, 해당 mergeSHA 배포 성공과 공개 root/health/servedSHA·안전한 읽기 UI 확인.

## 제외·안전
- DB schema/migration, 서비스·repo·권한·OAuth·금전·집계 정책 변경 없음. 새 미래일 정책/과거 백필 없음.
- 고객 값 시험 변경 금지. 쓰기는 합성 fixture/가짜 요청만 검증; live persist는 NOT_RUN으로 구분.
- 배포/접속 장애는 실제 상태를 먼저 확인하며 중복 배포/단정 revert 금지.

## 실행 기록
- 2026-10-17: 실제 DBR2 served title/header 확인. 날짜/상태 label Noto12/600/18, chip12/600/24·26px·padding0 9·radius9999 일치. PC 그룹top165/165, custom 범위 선택·실제 날짜 입력 후에도165 유지. 날짜17일 선택9건 확인.
- 실제 DOM: 표 radio0/상태 배지, 헤더 토글1/본문0, 컨택결과 select1/중복0/상담 버튼0, inflow auto-label만 숨김/현재상태 유지. 좌640→520·우560 고정, 중앙 grip 우560→640·좌520 고정, 접기/펼침520/640 보존.
- 제품 집중 회귀: 109/109 PASS(autosave12·supplier11·followups7·UI7·detail4·status68), 독립 폭 clamp/복원 회귀 추가 UI8/8 PASS. typecheck와 lint PASS. 최종 전체 훅·build·독립 exact-head/CI·병합·배포·live는 이후 결과를 PR에 기록.
- 실제 제품 컴포넌트 합성60행: 1280×720·1440×900·1280×480·320×720·375×812·430×900 모두 document scrollHeight=clientHeight, scrollWidth=clientWidth. 목록 내부 scrollHeight2263(PC)/4439(모바일), 작은 화면 가용 높이123/105px 확보. 실제 스크롤0→400, 헤더 셀 sticky 유지·toolbar top 불변. 운영 데이터와 외부 API 미사용.
- 제품 날짜 portal은 body 직속·그룹 top 불변. 단일 select/헤더 토글, body 중복0·기존 raw AS예정/표시 AS신청·각 option 집계 안내 확인. 좌640/우560→좌624/우560→좌624/우576 및 접기 복원, 우측 끝1280 고정. 로컬 증거 `artifacts/dashboard-db-controls/`(커밋 제외).
- PRECOMMIT 독립 검수가 기존 activity 설정 진입 소실을 발견하여 최초 훅은 structural 시작 시 안전 중단(exit1, commit0). 기존 onRecording 비파괴 버튼을 복원하고 activities=false/onDelete 미호출 회귀를 추가했다. 중단 실행은 최종 PASS가 아니며 수정 후보의 정상 훅을 다시 실행한다.
- 최신 사용자 수정: 이전 중앙 grip 우만/좌고정 조건 폐기. 520/560→440/640(total1081), 좌 min360 후만 shell 확대·viewport cap. 컨택내용 상단10px 추가, 최초일 안내 badge만 제거, label=컨택일(최초컨택일), 실제 날짜 저장·firstManual 불변. 새 지시로 두 번째 훅 typecheck 단계 중단, 해당 실행은 PASS 아님.
- 후속 전체 훅: type/lint/구조94 PASS 뒤 기존 recording-ui의 옛 팝업/하단 select 기대2건 FAIL, unit 실행 중 안전중단. 테스트를 승인된 새 진입/단일 상단 select에 재연결하고 기존 저장값·집계·활동OFF·날짜 단언을 보존했다. 실패 실행을 PASS로 재사용하지 않는다.
