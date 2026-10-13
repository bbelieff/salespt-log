# DB관리시트 공급처 유형·공급처 분리

사용자 승인한 새 업체 입력·표 편집을 4채널 집계에 연결한다. 관련: AGENTS.md, docs/domains/data-model.md.

## 승인 및 범위
- 사용자 2026-10-13: 공급처 유형4채널 선택·출처 자유입력·표에서 표시/편집 요청 후 목업 확인, “진행해보자” 승인.
- 승인본: localhost:4520/db-sheet, pluuug-revision-mockup-261013의 0e43227 위 작업본. 증거 세일즈PT/artifacts/pluuug-revision-261013/db-source-type-{table,mobile}.jpg.
- base: b51d04b8a771081641d8dbfa3b1cf372fa6d37c6. production 전용 feat/db-source-types.
- 공급처 유형은 Channel 정본4종 재사용. supplier 문자열은 유지. 매입DB 기본, 메타는 직접생산. CSV 옛 유입채널/DB공급처 헤더 보존.
- 기본 표에 유형/공급처 인접 표시. 기존 열 표시 설정은 새 유형을 추가하며 보존. 상세/가져오기/새 업체/표는 dropdown. 모바일 카드도 유형/출처를 함께 표시.
- 채널 이동은 기존 트랜잭션의 해당 lead 유입·상담 기여분만 이동. 연결된 미팅이 있으면 유형 변경 금지(기존 계약 유지), 공급처 이름은 변경 가능.
- 미승인 대시보드·이메일·통합 기록·공급처별 성과/툴바 목업 전체는 포함하지 않는다. 마이그레이션/백필/운영 데이터 직접쓰기 없음.

## 수용 기준
- 4채널 유입/상담/예약 저장과 재조회; 예약 전 유형 수정 시 이전/새 채널 집계 이동; 다른 lead 수치 유지; 예약 후 채널 변경 차단.
- PC·320/375/430px에서 신규등록/표편집/재조회. check.sh·production build·정확한 PR head 독립검토/CI PASS 이후 squash, Deploy to VPS success 및 health200.
- 담당: root 구현·통합·운영, 독립 reviewer는 읽기전용 검토.

## 검증/운영
- 로컬 check.sh PASS: unit/integration 336 files·3442 tests, 기존 45 skipped. 집중 계약/CSV 14 PASS 및 CSV 유형 경계 6 PASS. npm run build 최종 PASS(검사 생략 없음). Windows 자원 부족과 축소 heap 재시도 실패는 로컬 로그 보존. 정확한 head UI/독립검토/CI/배포 진행 중.
