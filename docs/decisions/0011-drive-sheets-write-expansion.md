> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 서비스계정 Drive 권한을 read-only(ADR-0007)에서 확장 — **지정 템플릿 시트 복제 + 시트 append** 만 화이트리스트로 허용. 기존 파일 내용 수정·삭제·임의 폴더 생성은 금지.
> - **누가 읽나요**: 개발자, 운영자(admin)
> - **어떤 기능·작업과 연결?**: `lib/repo/drive-client.ts`(driveWriteClient·copyTemplateSheet), 관리자 기수 생성(`/api/admin/create-cohort-members`), `cohorts` 탭
> - **읽고 나면 알 수 있는 것**: 왜 쓰기 스코프를 늘렸는지, 무엇만 허용되는지, 가드(구조테스트)
> - **관련 문서**: `docs/decisions/0007-drive-link-permission.md`, `docs/plans/active/admin-cohort-create.md`

- **Status**: accepted
- **Date**: 2026-06-05
- **Supersedes**: 없음 (ADR-0007 **확장** — 읽기 규칙 유지 + 쓰기 화이트리스트 추가)
- **Note**: 기획서(admin-cohort-create.md)는 본 ADR을 "0010"으로 칭하나, 0010 은 이미
  meeting-reservation-derived 가 사용 → 실제 번호는 **0011**.

# ADR-0011 — Drive/Sheets 쓰기 제한 확장 (템플릿 복제 + append 화이트리스트)

## 맥락
ADR-0007: SA scope=`drive.readonly`(연결 only, 생성/수정 금지). 관리자 기수 생성에서 **기준 시트 복제**가 필요해 쓰기 권한이 불가피. 단 무제한 쓰기는 사용자 데이터 손상 위험.

## 결정
SA 쓰기를 **좁은 화이트리스트**로만 확장한다.

- **읽기**(ADR-0007 유지): `driveClient()` scope `drive.readonly` — files.list / files.get.
- **쓰기(신규)**: 별도 `driveWriteClient()` scope `drive`. 허용 연산:
  - **`files.copy`** — 지정 템플릿 시트 → 지정 폴더로 복제(`copyTemplateSheet`). 구조·수식 보존.
  - **시트 append** — registry/roster 행 추가(`spreadsheets.values.append`, 기존 sheets-client).
- **금지(절대)**:
  - 기존 파일 **내용/메타 수정** `files.update`.
  - **삭제** `files.delete`.
  - 임의 **폴더 생성** `files.create`(folder) — 이번 회차는 폴더 사전 생성, 매칭만(`findFolderByExactName`). (폴더 자동 생성은 후속 ADR.)
- admin 역할 + 지정 template/rootFolder 범위에서만 호출.

## 가드 (기계검증)
- 구조테스트(`tests/structural/layers.test.ts`): `lib/repo` 어디에도 `.files.update(`·`.files.delete(` 없음(0). `.files.copy(` 는 `drive-client.ts` 에서만.
- 공유: 템플릿·루트·복제본 모두 **공유 드라이브**에 둠 → 멤버 권한 자동(개별 permissions.create 불필요). SA 가 그 공유 드라이브 멤버(콘텐츠 관리자 이상)여야 함.

## 근거
- 복제(copy)는 원본 불변 + 새 파일 생성이라 기존 데이터 손상 위험 0.
- update/delete 금지로 "사용자 시트 훼손" 경로를 구조적으로 차단.
- 공유 드라이브 사용으로 permissions.create 까지 미루어 쓰기 표면 최소화.
