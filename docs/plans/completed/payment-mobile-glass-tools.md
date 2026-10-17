---
slug: payment-mobile-glass-tools
status: completed_release_a
created: 2026-10-17
---
# 수납 모바일 UI 독립 배포 A
- 완료 원본: PR #1168, merge facefd99a748c404139c3835921a923e6953d4c3, deploy39044662674 SUCCESS. 새 feature CSS/health PASS, 인증 운영 UI/save NOT_RUN. 로컬 build OOM FAIL과 공식 CI check/build PASS를 분리한 최종 근거는 PR 본문이 정본이다. B는 별도 active plan으로 진행한다.

- 사용자 2026-10-17 독립 UI 순차 운영 배포 승인. writer/release019fe6a6, 독립검수 F019fe6a9, Root는 Pages 소유. base/master `a8287d361c6c77b216772cc435f0f59b4429a847`, branch `feat/payment-mobile-ui-release`, 전용 clean WT. 원본 목업/foreign dirty/PR1158·1136·798 보존.
- A product13: app/(app)/payment/page.tsx; _components/ContractRow.tsx, CompanySearchBar.tsx, DriveLinkBar.tsx, MobileTools.tsx, mobile-tools.css; payment-company-compact.css; components/CompanyInfoContractSection.tsx, CompanyInfoEditor.tsx; company-doc/CompanyDocAutofillButton.tsx; company-info/CompanyInfoLayoutToggle.tsx, CompanyInfoViewToggle.tsx; ui/liquid-glass-tools.css. source 승인 후보의 정확한 UI delta만 apply_patch로 추출한다.
- A 기능: Liquid Glass4, 앞3각44/gap0/검색잔여폭; touch2tap·mousehover·keyboard/Escape·query/clear; 업체정보 mobile 초기닫힘·compact opt-in·header39 명시접기. shared CSS DB selector는 소비자가 없어 A에서 영향0.
- 기본 공용 호출·PC·신원/초안/autosave/저장·guardedNav·Drive 명시 요청·금전/권한은 불변. repo/service/api/model/types/schema/package/lock/config/workflow 변경0. 테스트는 기존 UI 경계4파일+payment 전용 optical/width assertion. SSOT tokens/components/preview 해당 영역과 worklog만 동기화한다.
- 수용: 320/375 idle/edit44/44/44/172 또는227, 다른 도구 확장108 또는135.5 분배·44높이/한줄/overflow0, 기존 header39·mobile compact 치수/기본닫힘. 저장 시험·실Drive/문서업로드/OCR·외부 이동 실행0.
- 추출 source hash13 동일/보호경로0→정상 hook 전체 check.sh1→순차 production build1→PR current head/tree F검수+CI/보안 SUCCESS→basefresh/mergeableCLEAN/점유0→expected-head squash→자동배포 success/served SHA/health→허용 UI. 실제 인증이 없으면 affected authenticated UI/save NOT_RUN. 훅/검사/timeout/guard 우회0.
- B는 A 배포 확인 뒤 DB client-only만 별도 WT/current base로 검토. 예상 DB compact.css/db-sheet.css/page UI hunks·Grid/InflowPeriod/SupplierFilter/MobileFilterMenu/MobileViewOptions 및 좁은 검사/SSOT. repo/service/api/model/types/schema·null→2state 저장/집계 제외. 분리 불가 UI hunk는 보류 사유만 보고, A에 섞지 않는다.
- 진행 결과는 이 plan/실제 PR에 command·head/tree·PASS/FAIL/NOT_RUN·배포 증거로 기록한다. 원복은 해당 squash commit revert 후 동일 gate/직렬 배포, 데이터 롤백 불필요.
