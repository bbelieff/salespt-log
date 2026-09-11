> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: #953 일반기수 Drive 자동찾기를 본인 시트 증명 기반으로 수정한다.
> - **누가 읽나요**: 구현자·독립 검수자
> - **어떤 기능·작업과 연결?**: `/api/drive-link` 일반기수 auto
> - **읽고 나면 알 수 있는 것**: 탐색 범위, 실패 폐쇄 조건, 검증 증거
> - **관련 문서**: [ADR-0007](../../decisions/0007-drive-link-permission.md), [이슈 #953](https://github.com/bbelieff/salespt-log/issues/953)

# [DH-SPO] 일반기수 Drive discovery

## 계약 및 현황
- 전용 `fix/regular-drive-discovery`, base `9c5a7b8a9cef641825a1424cfa2dc8e1347a2cdb`.
- PR 및 CI green까지. 독립검수·머지·배포·운영 취소자 제외 6명 전수 연결 검증은 부모 담당이며 NOT_RUN.
- 운영 env 로드·파일 생성/이동·공유/권한·수강생 연결값 실제 변경 금지.
- 구역: 일반 auto route, 전용 repo 탐색 함수, 회귀 테스트, 본 계획·worklog.

## 원인과 반증
1. 가장 유력: 시트 `parents=[]`만으로 폴더 미공유를 단정한다. 제공된 실측은 개인폴더 접근 및 정확한 시트 containment가 가능하여 이를 반증했다.
2. 공유드라이브 폴백은 이름만으로 남의 01을 선택한다. 테스트로 접근 범위 및 오연결 차단을 검증한다.
3. root 등록 부재·동명/중복·페이지 누락은 실제 미발견과 다르다. 합성 fixture로 실패 폐쇄를 검증한다.
- 기존 parent 경로는 유지하되 01 후보 정확히1개만 허용한다. 아레나·manual은 기존 함수를 그대로 유지한다.
- 새 탐색은 정확히 같은 cohort의 등록 root 직계 개인폴더만, 각 폴더의 직접 자식에서 registry spreadsheetId와 spreadsheet MIME을 확인한다. 사용자 이름은 증명으로 사용하지 않는다.
- root당 개인폴더 최대50개, 자식 목록 최대1000개, 재귀0단계. nextPageToken/incompleteSearch/초과/조회오류는 연결하지 않는다. 최대51 list 호출(기존 parent 조회 시 +1), 순차 호출, 자동 재시도/전체 Drive 검색 없음. 탐색 총15초·호출당5초 timeout/retry=false; 기존 UI abort25초를 고려한 제한이다.

## 실행 체크리스트
- [x] RED: parent 누락에도 본인 시트 포함 개인폴더 발견
- [x] GREEN: bounded 탐색 + unsafe 공유드라이브 폴백 제거
- [x] 모호/누락/동명이인/쿼터/페이지/오류/아레나/manual/parent 회귀: 일반35 + 기존 아레나7 = 42 PASS
- [x] check.sh: 구조41 + 단위/통합1745 PASS, 기존 선택적 DB 등33 SKIP 명시
- [x] full Next build: `build.log`, 운영 자격증명 없는 전용 worktree에서 PASS
- [ ] pre-commit hook
- [ ] PR + 정확한 head CI green, 카드 증거

## 검증 증거
- 합성 fixture만 사용, 운영 env 파일 로드/실제 Drive·registry 호출 없음.
- `tdd-red-discovery.log`: 원본 경로가 `folder_not_shared`를 반환해 신규 회귀 실패.
- `tdd-red-bounds.log`, `tdd-red-parent.log`, `tdd-red-failure-contract.log`, `tdd-red-time-budget.log`, `tdd-red-ambiguous-metadata.log`, `tdd-red-ui-budget.log`: 각 안전 계약 RED 후 GREEN 확인.
- `focused-final.log`: 42 PASS. 신규35건은 실제 route와 새 repo resolver를 실행하며 외부 I/O만 mock.
- `check.log`: 최초 fixture strict-null 타입6건 실패; 수정 후 `check-final.log` 전체 PASS. 테스트 삭제/skip 추가/게이트 변경 없음.
- request-path 구조게이트는 기존 cohorts 경로 재사용으로 whitelist 변경 없이 PASS.
- 코드 자체 검토/정적 스캔: 새 Drive 파일·권한 쓰기/로그/eval/shell 실행 없음. 독립검수는 부모에게 반환 후 수행하며 writer가 PASS 도장을 대신 찍지 않는다.
- 기존 일반 manual 및 아레나 구현 불변. 다른 admin 생성/이름탐색 함수는 이 자동찾기의 호출경로가 아니므로 변경하지 않는다.
- 문서 편집 도구가 혼합 줄바꿈을 정규화한 흔적은 제거했다. worklog는 base 바이트를 보존한 본인 기록7줄만 추가.

## 롤백 및 잔여
- 코드 PR revert 가능. 외부 상태 변경 없음.
- 사용자 정정: 예외 1명은 수강취소로 제외. 앱 등록 삭제·재신고자 수동 연결 검토는 부모 담당이며 writer 운영쓰기 금지 유지. 원본 Drive 파일은 삭제/이동/생성하지 않는다.
- 계획은 독립검수/운영검증 미완료이므로 active에 유지한다.
