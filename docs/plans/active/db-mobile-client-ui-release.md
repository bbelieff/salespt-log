---
slug: db-mobile-client-ui-release
status: implementing_release_b
created: 2026-10-18
---
# DB 모바일 순수 화면 변경 독립 배포 B

- 사용자 독립 UI 순차 배포 승인, A PR1168/deploy39044662674 SUCCESS 확인 뒤 시작. writer/release019fe6a6, 독립 F019fe6a9, Pages Root 소유. 최신 base/master facefd99a748c404139c3835921a923e6953d4c3. 기존 clean release WT/동일 Node24·lockff033cd1·own node_modules를 정상 새 branch feat/db-mobile-client-ui-release로 재사용, 설치 반복/강제 reset/dirty 덮기0.
- product9 manifest: app/(app)/db-sheet/page.tsx; compact.css; db-sheet.css; _components/Grid.tsx, InflowPeriod.tsx, SupplierFilter.tsx, MobileViewOptions.tsx, MobileFilterMenu.tsx; _components/InflowStatusCell.tsx의 optional iconOnly 표시 hunk만. 앞8파일은 기존 검수 목업에서 정확 추출, 마지막 파일은 현행 base의 3상태/unknown guard를 그대로 보존해 아이콘 표시만 추가한다. source의 2state 정책/valid 오류 승격은 복사하지 않는다.
- 수용: DB 모바일 상단3각44·검색/유입일/상태34·행48·중립 Liquid Glass, PC 필터 날짜 teal 및 그림자/선택 표시, centered 보기 옵션40·focus trap/inert/Escape/초점복귀, 필터/정렬/표/보임 항목 상태 유지·클라이언트 localStorage 기존 계약. 기존 create/import/detail/filter callbacks 재사용, 데이터 쓰기/집계 계산 변경0.
- 보호: lib/repo/service/appapi/model/types/schema/package/lock/config/workflow 및 A payment/shared liquid token 바이트 변경0. 특히 null/unknown→2state 저장·집계와 source의 관련 tests/모델 변경은 별도 lane로 보존한다. missing/unknown 상태는 확인 필요·editor disabled·persistence 미호출을 유지한다.
- tests: source의 mobile-list/filter-theme/options-popup UI 경계(비배포 fixture assertion은 shipping UI 범위로 조정), 신규 unknown icon 호환과 DB liquid assertion. 기존 committed test 삭제/약화0. tokens/components/preview 해당 DB 영역·worklog·A plan 완료 이동·본 plan만 기록한다.
- 추출 검증: source8 SHA 동일 + InflowStatusCell의 optional prop/icon return만 역변환해 base hash 동일 증명, 보호경로0. 집중 UI/unknown 검사→정상 commit hook scripts/check.sh 전체1회. Root 명시 판단에 따라 A에서 확인된 같은 환경 local unskipped OOM은 반복하지 않고 B local build NOT_RUN(환경 한계)과 동일 PR 공식 CI Node20check+Node22build 양 SUCCESS를 분리 기록한다. workflow/skip/heap/global 환경 변경0.
- 실제 합성 UI는 release product root로 기존 fixture를 읽기 전용 재사용해 320/375·PC의 주요 치수/옵션40/unknown 의미를 확인한다. 운영 고객 데이터/실저장·Drive/OCR 등 외부 동작0. source 목업의 2state data projection을 release 실행 증거로 쓰지 않는다.
- 집중20 PASS(exit0), source8/8동일·icon optional3hunk 역변환base동일·보호경로0. release cwd의 기존 tests/browser/dashboard-followups-server.mjs·fixture 원본 바이트를 그대로 port4321에서 실행(변경0), Noto 실제 폰트와 제품 B를 렌더했다. source preview의 바뀐 모델/fixture는 사용하지 않았다.
- 실제320/375: 상단3각44/blur18·필터3각34·목록6각48/overflow0, unknown 아이콘6 유지. 옵션40은375폭351/320폭296·높이246·x12/y283, inert true/Tab순환/Escape trigger복귀. 오늘 필터는6→1/선택/초점복귀, PC1280은도구26/blur0·날짜teal#0f766e·고정열fade/overflow0. 기존 상세 unknown radios2 모두disabled/checkedfalse·확인 필요 안내를 읽기만 확인(입력/저장0). 로컬 증거는 source 소유 artifacts/liquid-glass-tools/release-b-{db,options,unknown}-*.png이며 PR 자산으로 잘못 링크하지 않는다.
- 최종 actual PR base/head/tree F 검수·CI/보안 SUCCESS·basefresh/CLEAN/점유0→expected-head 직렬 squash→자동배포 success/remote SHA/health/허용 served asset/UI. 로그인 없으면 인증 UI/save NOT_RUN. 변경된 head/base는 영향 재검증한다.
- 원복은 B squash 정상 revert→동일 gate/직렬 배포. 데이터 변경0으로 데이터 rollback 불필요. 완료 원본은 실제 PR의 검사/배포 증거이며 별도 요청 상태표를 복제하지 않는다.
