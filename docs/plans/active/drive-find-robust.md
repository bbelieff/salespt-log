---
slug: drive-find-robust
status: active
created: 2026-06-05
owner: belie
related: fix-drive-link-permission-ux, 0007-drive-link-permission
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Drive 자동찾기를 공유 드라이브/편집 공유에서도 동작하게. corpora:allDrives + 시트 driveId 폴백 탐색 + 안내 문구(뷰어/편집자).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/repo/drive-client.ts`, `app/api/drive-link/route.ts`, `DriveLinkBar.tsx`
> - **관련 문서**: [[docs/decisions/0007-drive-link-permission]], [[docs/plans/completed/fix-drive-link-permission-ux]]

# Drive 자동찾기 견고화 (공유 드라이브/편집 공유)

## 배경
SA scope=drive.readonly — 공유는 접근을 부여, scope는 동작만 제한 → 뷰어/편집자 모두 읽기 가능. 그런데 files.list 에 corpora 미지정이라 공유 드라이브 검색 누락 + 자동찾기가 부모 한 단계만 봐서 실패.

## 변경
1. **drive-client.ts**:
   - findFolderByNamePrefix·findSheetByNamePrefix·findSheetByExactName files.list 에 `corpora: "allDrives"`.
   - getDriveFileMeta: fields `+driveId`, 반환에 `driveId` 포함.
   - 신규 `findFolderByNameInDrive(prefix, driveId)`: corpora:"drive"+driveId 로 그 공유 드라이브 전체 탐색.
2. **route.ts (auto)**: (a) parentId 있으면 findFolderByNamePrefix → (b) null이면 driveId 로 findFolderByNameInDrive("01 피드백업체"→"01") 폴백 → 둘 다 실패 시에만 공유 안내. 403/404 분기 유지. 수동 모드 불변.
3. **DriveLinkBar.tsx**: "뷰어로 공유"→"뷰어 또는 편집자", 공유 드라이브 멤버 추가 안내 한 줄. SA 이메일 복사 유지.

## Acceptance Criteria
- [ ] 공유 드라이브 + SA 멤버면 추가 공유 없이 자동찾기 성공.
- [ ] 폴더를 편집자로 공유해도 성공.
- [ ] 부모 안 보여도 같은 드라이브 폴백으로 찾음.
- [ ] 못 찾을 때만 공유 안내(뷰어/편집자 모두 허용). `npm run check` 통과.

## 범위 밖
- 폴더 생성(ADR-0007 연결only), 권한 변경 API.

## Log
- 2026-06-05 corpora:allDrives + driveId 폴백 + findFolderByNameInDrive + 문구.
