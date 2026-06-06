> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: ADR-0011 쓰기 화이트리스트를 확장 — 아레나 생성에서 **지정 부모 폴더 하위 폴더 생성(files.create folder)** 을 추가 허용. 기존 파일 수정/삭제는 여전히 금지.
> - **누가 읽나요**: 개발자, 운영자(admin)
> - **어떤 기능·작업과 연결?**: `lib/repo/drive-client.ts`(createFolder), 관리자 아레나 추가(`/api/admin/create-arena-members`), `cohorts` 탭 H/I
> - **읽고 나면 알 수 있는 것**: 왜 폴더 생성을 허용하는지, 무엇만 허용되는지, 가드(구조테스트)
> - **관련 문서**: `docs/decisions/0011-drive-sheets-write-expansion.md`, `docs/plans/active/arena-create.md`

- **Status**: accepted
- **Date**: 2026-06-06
- **Supersedes**: 없음 (ADR-0011 **확장** — 화이트리스트에 폴더 생성 1종 추가)

# ADR-0012 — 아레나 업체관리 폴더 생성 (createFolder 화이트리스트 추가)

## 맥락
ADR-0011: SA 쓰기를 `files.copy`(템플릿 복제) + 시트 append 로만 좁게 허용, **임의 폴더 생성
`files.create`(folder) 은 금지**("이번 회차는 폴더 사전 생성, 매칭만"). 그러나 관리자 **아레나 추가**는
참가자별 **업체관리 폴더**를 자동 생성해야 한다(시즌마다 수동 폴더 생성은 비현실적).

## 결정
ADR-0011 화이트리스트에 **폴더 생성 1종**을 추가한다. 나머지 금지는 그대로.

- **쓰기(추가)**: `createFolder(name, parentId)` — `driveWriteClient()` scope `drive` 의 `files.create`
  (`mimeType=application/vnd.google-apps.folder`). **반드시 지정 `companyParentFolderId` 하위에만** 생성.
- **기존 허용 유지**: `copyTemplateSheet`(files.copy → 지정 `sheetsFolderId`), 시트 append.
- **금지(그대로)**: 기존 파일 **내용/메타 수정** `files.update`, **삭제** `files.delete`.
- admin 역할 + cohorts 아레나 row 에 등록된 template/sheetsFolder/companyParentFolder 범위에서만 호출.

## 가드 (기계검증)
- 구조테스트(`tests/structural/layers.test.ts`):
  - `lib/repo` 에 `.files.update(`·`.files.delete(` 없음(0) — ADR-0011 유지.
  - `.files.copy(` 와 `.files.create(` 는 **`drive-client.ts` 에서만**.
- 공유: 템플릿·시트폴더·업체부모폴더·생성물 모두 **공유 드라이브**에 둠 → SA 가 그 공유 드라이브
  멤버(콘텐츠 관리자 이상)여야 복제·폴더생성 가능.

## 근거
- 폴더 생성은 **새 빈 폴더**라 기존 데이터 손상 위험 0 (copy 와 동일 성격).
- 지정 부모 폴더 하위로 한정 + update/delete 금지로 쓰기 표면 최소 유지.
