# 최초상담일 자동 기록 기준

목적: 사용자 요청에 따라 컨택결과의 최초상담일 기록 기준을 넓히고 STEP 2 집계는 유지한다. 대상: 구현/검증 담당. 기준: origin/master 22e15350, fix/db-sheet-first-contact-date.

- 사용자 요청: ‘최초상담일은 단순거절 이후이하면 설정한 날로 다 자동으로 찍히도록’.
- 사용자 확정: 단순거절·재통화·컨택진행·상담 후 거절 포함. 선택한 컨택일을 최초 1회 기록하고 이후 보존한다. 2026-10-15 답변 승인.
- 현재: db-sheet repo saveDbSheetContact/registerDbSheetMeeting 모두 qualified 날짜의 최솟값을 first로 사용한다. qualified는 컨택진행/상담 후 거절만 포함한다.
- 유지: STEP 2 컨택진행 집계 두 결과만, 업체별 날짜별 1건, 기록OFF 동작, 미팅연동. 신규 first 기준을 qualified 집계와 분리해야 한다.
- 확인할 경계: 결과 변경/이 날짜로 기록/과거일자/같은날 하위결과 변경/미팅등록 시 기존 first 보존/저장 후 재조회/현재상태 자동분류 영향.
- 승인범위: 직접수정·기존 배포 요청 후속. 대상결과 확정으로 구현·검증·배포 진행. 기존 운영기록 일괄 백필 없음.
- 게이트: 실제repo 합성시험·UI 저장재조회, Git Bash check.sh·build, 독립검토, CI·병합·Deploy·health·안전한 운영확인.

- 추가 파급 확인: service/db-sheet-status.ts가 first 존재로 공급처 퍼널의 상담단계를 판정한다. 날짜기준만 넓힐 때 상담성과가 잘못 증가하지 않도록 기존 qualified 상담 여부와 표시날짜 분리도 검증한다.

## 구현·검증
- first는 old.first를 우선 보존, 새 기록의 네 결과에서 선택 컨택일로 시작. 미팅등록도 보존.
- hasQualifiedContact는 서버 소유 JSON 필드이며 qualified 상담 이력으로 결정. 일반 저장 시 보존하고 입력 위조를 무시한다. 과거 버전은 기존 first로 성과 의미를 유지한다. 스키마 변경·운영 백필 없음.
- 실제 PGlite repo 30건·서비스31건·모델7건·autosave9건 통과. 이전 과거 예약일로 first를 덮던 기대값은 사용자 승인된 보존 기준으로 변경, 집계 기대는 유지.
- 합성 실제 화면: 10/14 단순거절 선택 즉시 최초상담일10/14, STEP2 상담0. 10/15 컨택진행 시 first10/14 유지 확인.
- 총괄이 types/repo/service/UI/tests 구현. 독립 검증자 excel_count_review는 읽기 전용 검토. 전체검사·빌드·head 검토·CI·운영배포는 진행 중.

- production build PASS. PC1280 / 모바일320·375·430에서 날짜 표시·가로 넘침 없음. API/PGlite 실제 저장 뒤 reload에서 first10/14 유지, 10/15 컨택진행 반복 기록에도 해당일 contactProgress1 유지. 증거: artifacts/db-sheet-first-contact-release/first-contact-pc.png 및 first-contact-mobile.png (사용자 산출물 폴더).
