# PAYMENT-DDAY-20261010

목표: 실무/수납 회사·기관 보기의 활동 정렬을 D? → D+ → D0 → H → D-로 통일.
범위: payment-progress, institution-view, company-work-view, WorkActivityBadge, payment/page, 관련 합성 테스트·components 정본.
base: 92e54e1fe55b6ff63a0d28013ed086ddf77594de. 시작: 2026-10-10 00:28 KST.
보존: 저장/DB/완료진행/해지필터·레이아웃. 조회 중/실패 별도 표시. 동률 저장 순서.
검증: 한국 날짜·연체/당일/미래·History·완료 Todo·빈 날짜·여러 진행건·동률, check.sh/build/CI/배포/live.
UI 참조: docs/design/tokens.md, components.md, 기존 WorkActivityBadge 칩 규격 그대로. preview.html에 이 목록은 없어 갱신 해당 없음.
진행: 구현·합성 UI 검증 완료, 전체 게이트와 병합/배포 확인 중. 모델 사용량은 제공 메타데이터만, Muse 호출 없음(주간 5%, 1단계 핵심 로직 직접).

화면 검증: 합성 데이터 fixture에서 업체/기관 보기 320·375·430·1280px 가로 넘침 없음. 업체 D?→D+09→D+01→D0→H+08→H+02→D-02 순서와 기관 동일 순서 확인.
단위/통합: 3341 PASS, 기존 45 SKIP. 집중 37 PASS. 전체 check.sh 후반·build 진행 중.
운영 화면 접근: 로그인 상태 확인. 새소식 팝업은 사용자 확인 규칙에 따라 닫지 않았음. 실제 데이터 변경 없음.
Production build PASS. 최종 head CI·병합·배포 증거는 PR에 이어서 기록한다.
check.sh PASS (typecheck/lint/구조/단위/크기/doc-drift). 구현 완료; 최종 CI·배포·운영 결과는 PR에 기록.
