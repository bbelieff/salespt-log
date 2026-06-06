---
slug: cohort-folder-naming-fix
status: completed
created: 2026-06-05
completed: 2026-06-06
owner: belie
related: admin-cohort-create(completed), 0011-drive-sheets-write-expansion
---

> ✅ **완료 (2026-06-06)** — PR #311 머지·배포. contains 매칭 + 공유 드라이브 폴백 반영.

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 관리자 기수 생성 흐름의 이름폴더 매칭을 실제 8기 구조(`[{팀} {기수}기] {이름}`)에 맞게 정확일치 → **포함(contains) 매칭**으로 정정하고, 공유 드라이브 탐색을 견고화.
> - **누가 읽나요**: 개발자, 운영자(admin)
> - **어떤 기능·작업과 연결?**: `lib/repo/drive-client.ts`, `app/api/admin/create-cohort-members`, `lib/service/cohort-token.ts`
> - **읽고 나면 알 수 있는 것**: 왜 contains 매칭인지, 공유 드라이브 폴백, 모호성(2개+) 처리
> - **관련 문서**: `docs/plans/completed/admin-cohort-create.md`, `docs/decisions/0011-drive-sheets-write-expansion.md`

# 기수 생성 — 이름폴더 명명 정정 (contains 매칭 + 공유 드라이브)

## 배경 (실 구조 확인)
8기 폴더는 공유 드라이브에 있고, 이름폴더명이 단순 `{이름}` 이 아니라
**`[{팀} {기수}기] {이름}`** (예: `[서울 8기] 김승엽`) 형태다. 기존 `findFolderByExactName("{이름}")`
정확일치로는 절대 매칭되지 않는다.
※ 폴더명의 "서울" 같은 팀 토큰은 폴더 매칭 용도로만 사용 — registry team(H) 컬럼과 별개. 이번 생성은 팀을 registry 에 기록하지 않는다.

## 변경
1. **drive-client**: `findFolderByExactName` → `findFolderContainingName(name, parentFolderId)` 로 교체.
   - rootFolder 안에서 `name contains '{이름}'` 폴더 검색 (부모 범위, corpora 미지정 — allDrives 회귀 방지).
   - 결과를 `name.includes(이름)` 으로 필터 + id 중복 제거.
   - **0개면 driveId 범위 폴백**: `getDriveFileMeta(parentFolderId).driveId` 로 `corpora:"drive"` 전체 검색.
   - 반환 `{ id, matchedNames }`: 정확히 1개 → id, 0개/2개+ → id=null(+이름들로 없음/모호 구분).
   - 모든 Drive 호출 `supportsAllDrives:true`, 검색은 `includeItemsFromAllDrives:true` (이미 충족 — 재확인).
2. **decideMemberAction**: create 모드 폴더 실패 사유 주입 `folderError?` 추가 (기본 "이름 폴더 없음").
3. **route**: `findFolderContainingName` 사용 → 1개 사용 / 0개 "이름 폴더 없음" fail / 2개+ "여러 개 명확화 필요: …후보" fail.
4. **단위 테스트**: folderError override(모호) 분기 추가.

## 전제 (운영)
서비스계정(`masterbot@…`)이 해당 **공유 드라이브 멤버(콘텐츠 관리자)** 여야 탐색·복제 가능 — 사전 확인.

## 수용 기준
- `a1 / 김승엽` 또는 `8 / 김승엽` 실행 시 `[서울 8기] 김승엽` 폴더가 매칭되어 그 안에 템플릿 복제.
- 동일 이름 폴더가 2개+ → 실패 리포트에 "명확화 필요 + 후보 폴더명".
- 매칭 0개 → "이름 폴더 없음".
- 부모 범위 0개여도 driveId 범위 폴백으로 탐색.
- `npm run check` + build 통과.
