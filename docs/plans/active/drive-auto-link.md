# drive-auto-link (2026-09-24) — 일반 기수 자동 연결 오류 수정

## 문제

- SA 가 등록 시트를 GET 할 수 있는데 `parents` 가 비어 있으면, 기존 normal auto 는
  이를 공유 오류로 단정하고(`folder_not_shared`) 저장된 폴더 ID 를 지웠다.
- 부모가 없을 때 공유 드라이브 전체에서 `01` 폴더를 탐색해 다른 학생 폴더가 붙을 수 있었다.

## 결정

1. `lib/repo/drive-feedback-discovery.ts` 신설 — 등록 spreadsheetId 1개에만 동작.
   - SA `files.get` 우선. 성공인데 `parents` 누락일 때만 admin OAuth
     (`driveCreatorClient`)로 **같은 시트 1개**를 `files.get` READ 1회 재확인.
     생성·공유·쓰기 없음. 토큰 미설정·OAuth 실패는 원문 없이
     `parent_metadata_unavailable` 로만 반환.
   - 후보는 확정 부모의 직접 자식(`'부모' in parents` 쿼리만) 중 `01` prefix,
     폴더 MIME, 미삭제만. 전 페이지 순회, 0개→`folder_missing`,
     2개+→`folder_ambiguous`. `corpora`·`driveId` 범위 탐색 금지.
   - 최종 후보는 SA `files.get` + `files.list(page1)` 검증 후에만 성공.
     검증 실패(403/404)일 때만 `folder_not_shared`.
2. normal auto 는 저장 `feedbackFolderId` 를 SA GET+LIST 로 먼저 재검증해
   부모 메타 없이 재사용한다. 깨졌으면 발견으로 이어진다.
   실패 시 기존 folder/path/status 를 지우지 않는다.
3. normal manual 은 발견된 내 폴더 또는 그 부모 ID 와 정확히 일치할 때만 허용.
   저장 `driveParentPath` 는 소유 증명이 아니다.
4. 에러는 한글 간결 메시지, 식별자·토큰 미포함.
   `folder_not_shared` 만 기존 전용 안내, 나머지는 일반 오류로 UI 처리.

## ADR-0015 좁은 예외 노트 (scope 변경 없음)

- ADR-0015 는 파일 생성(복제·폴더)을 admin OAuth 로 수행한다는 결정이다.
- 본 작업의 admin 사용은 **생성이 아니라 읽기 1회**(`files.get` on 등록 시트,
  `parents` 확인용)이며, SA 가 시트는 보지만 부모를 가리는 케이스를 메우는
  폴백이다. 호출 위치는 `drive-feedback-discovery.ts:resolveParentId` 1곳,
  대상은 서버 확인 등록 ID 1개, 쓰기 API 호출 0건이다.
- 로그인 OAuth 스코프·보유 토큰·SA 읽기 원칙(ADR-0007)은 그대로 둔다.
  broad auth scope 변경이 필요하면 별도 ADR 로 다룬다.

## 검증

- 상세 결정: [ADR-0033](../../decisions/0033-drive-parent-metadata-fallback.md).
- 15초 탐색 예산·5초 저장 폴더 검증·페이지 사이클/부분 검색 거부 회귀 추가.
- DB 연결정보는 기존 자연키 1행의 제공 필드만 단일 UPDATE. 성공 후 캐시 무효화, 실패 시 시트 폴백/성공 응답 없음.
- 운영 읽기 전용 검증: 11기 활동 6명 모두 저장값을 쓰지 않은 탐색에서 본인 폴더 재발견, 저장된 ID와 6/6 일치, 앱 계정 내용 조회 가능. 실데이터 변경 없음.
- 신규 12·13·20기 합성 API 회귀 추가. 전체 게이트·CI·배포 결과는 PR과 작업 산출물에 기록.

- `tests/repo/drive-feedback-discovery.test.ts` (14) + `tests/api/drive-link-normal.test.ts` (11).
- 아레나 기존 동작·테스트는 손대지 않았다(같은 파일 하단 공통 성공 경로는 유지).
