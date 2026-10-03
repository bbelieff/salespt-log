# Payment 업체정보 자동저장 전환 안전성

## 범위

- 결제 상세의 업체정보 일반 입력·문서 자동입력 결과를 편집 시점 계약에 고정한다.
- 모바일 상세 닫기·탭/업체 전환·컴포넌트 언마운트에서도 마지막 초안을 직렬 저장한다.
- 업체정보 조회 실패와 저장 실패를 성공처럼 표시하지 않고 명시적 재시도를 제공한다.
- `page.tsx`, API/service/repository, 운영 데이터와 Sheets는 변경하지 않는다.

## 원인과 설계

- 기존 cleanup은 800ms 타이머만 취소해 전환 직전 입력을 버렸다. cleanup에서 타이머를 취소한 뒤 같은 writer를 즉시 flush한다.
- 기존 writer는 첫 응답 뒤 unmount 상태면 종료해 비행 중 생긴 최신 초안을 버렸다. React 상태 갱신만 mount 상태로 제한하고 writer는 최신 pending id까지 직렬 처리한다.
- 기존 POST는 전송 시점의 가변 target을 읽었다. 각 draft에 편집 시점 `{ 계약일, 업체명 }`을 복사해 함께 보관한다.
- 실패한 pending draft는 성공 ACK 또는 명시적 파기 전까지 안정 row owner 아래 target별 메모리 큐에 남긴다. 같은 mounted row가 A→B로 바뀌어도 A와 B를 삽입 순서대로 직렬 저장하며, 같은 상세을 다시 열 때도 큐와 진행 중 요청을 공유한다.
- 명시적 파기는 대기 draft만 지운다. 이미 비행 중인 요청이 있으면 owner 큐 등록과 drain을 유지해 같은 owner의 재마운트·새 편집이 기존 요청 완료 뒤에만 저장되며, drain과 draft가 모두 없을 때만 등록을 정리한다.
- GET은 요청 키별 loading/ready/error 상태로 구분한다. 늦은 이전 응답은 새 대상에 적용하지 않고, 실패 시 빈 편집기 대신 재시도 UI를 표시한다.
- pendingValue는 자체 target이 현재 GET requestKey와 일치할 때만 편집기에 주입하고, target 전환 시 편집기를 리마운트해 이전 초안을 화면에서도 격리한다.

## 검증 계약

- RED: 디바운스 전 unmount, 첫 요청 비행 중 최신 편집+unmount, target 변경 전 초안의 잘못된 대상 전송, 비행 중 파기 뒤 재마운트한 새 POST의 동시 시작, GET 실패의 빈 성공 표시.
- GREEN: 위 전환 회귀와 빠른 연속 편집, A→B 동일 인스턴스 직렬 drain, 비행 중 파기→동일 owner 재마운트 직렬화, 디바운스 중 파기 시 POST 0, target별 비-2xx 보존/재시도, stale GET 차단을 통과한다.
- 문서 자동입력 3개 필드와 동일 일반 입력이 같은 최종 payload를 만들고, mock POST 저장값을 GET 재조회·remount 후 동일하게 읽는다.
- mock roundtrip은 실제 backend/운영 저장 증거가 아니다. 실고객·Sheets·운영 데이터 쓰기는 `NOT_RUN`이며 이 작업에서 수행하지 않는다.

## 롤백

- 이 변경의 다섯 경로만 되돌린다. 운영 데이터 역변경은 없다.
- 실패 시 pending을 지우지 않으므로 사용자는 상세을 다시 열어 명시적으로 재시도하거나 변경사항 파기를 선택할 수 있다.
