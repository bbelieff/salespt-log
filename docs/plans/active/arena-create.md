---
slug: arena-create
status: active
created: 2026-06-06
owner: belie
related: admin-cohort-create(completed), 0011-drive-sheets-write-expansion, 0012-arena-folder-create
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 관리자 "아레나 추가" — 시즌+명단 입력 → 참가자별 경영일지 시트 복제 + 업체관리 폴더 생성 + 레지스트리 prep 등록.
> - **누가 읽나요**: 개발자, 운영자(admin)
> - **어떤 기능·작업과 연결?**: `/api/admin/create-arena-members`, `lib/repo/drive-client.ts`(createFolder), `cohorts` H/I, `ArenaCreateModal`
> - **읽고 나면 알 수 있는 것**: 명명 규칙, 멱등 처리, 폴더 생성 화이트리스트(ADR-0012)
> - **관련 문서**: `docs/decisions/0012-arena-folder-create.md`, `docs/plans/completed/admin-cohort-create.md`

# 관리자 아레나 추가 (시즌+명단 → 시트복제 + 업체폴더생성 + 등록)

## 명명 규칙 (확정)
- 입력 3요소: A(고정) · 시즌번호(예 1) · 명단(이름 다건).
- 참가자별 산출물 2개:
  - 경영일지 시트: `세일즈PT_A{시즌}_0기 {이름}_대표님 경영일지`
  - 업체관리 폴더: `세일즈PT_A{시즌}_0기 {이름}_대표님 업체관리`
  - "0기"는 고정(자기기수 자리). registry cohort 라벨 = `A{시즌}`.

## 대상 위치 (공유 드라이브, cohorts "A{시즌}" row 에 저장)
- 템플릿(E) / 시트 생성 폴더(H, sheetsFolderId) / 업체관리 부모(I, companyParentFolderId).

## 변경
1. **ADR-0012**: 쓰기 화이트리스트에 `createFolder(name, parentId)` 추가(지정 companyParent 하위만). update/delete 금지 유지. 구조테스트 갱신(copy·create 는 drive-client 전용).
2. **cohorts**: H sheetsFolderId / I companyParentFolderId 컬럼 추가. listCohorts·ensureCohortsTab(A1:I)·upsertCohortConfig(D:I) 확장.
3. **drive-client**: `createFolder`(files.create folder), `findFolderByExactName` 재추가(아레나 폴더 정확일치 멱등).
4. **users-prep**: addTraineePrepRow 에 feedbackFolderId(O열) 옵션 — 업체폴더 id stamp.
5. **service/cohort-token**: arenaSeasonLabel / buildArenaSheetTitle / buildArenaCompanyFolderName / decideArenaAction(순수).
6. **API** `/api/admin/create-arena-members` (admin): {season, names[], config?}. 멱등(등록자 skip)·순차·429 retry. {created,skipped,failed}.
7. **UI** `ArenaCreateModal` — 시즌+설정+명단+미리보기+리포트. CohortMgmtPanel 헤더에 "기수/참가자 추가"와 나란히 "아레나 추가" 버튼.
8. 단위 테스트(빌더/멱등 분기), sheet-structure·components SSOT 등재.

## 수용 기준
- 시즌1+명단 → "참가자 구글시트"에 시트들, "ARENA S01"에 업체관리 폴더들 생성, registry (A1,이름) prep + 시트ID + O열 업체폴더ID.
- 멱등: 이미 있는 사람/시트/폴더 건너뜀(중복 생성 X).
- self-claim 시 (A1, 이름) prep 매칭 접근(공유드라이브 권한 자동).
- `npm run check` + 단위테스트 통과.

## 주의
- ⚠️ SA(`masterbot@…`)가 해당 공유 드라이브 멤버(콘텐츠 관리자)여야 복제·폴더생성 가능.
- 아레나 시즌 날짜(O1/O2)는 템플릿 상속 → 시즌 일정 맞춤 설정 별도(범위 밖).
