---
slug: drive-corpora-regression
status: active
created: 2026-06-05
owner: belie
related: drive-find-robust
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: #303에서 넣은 corpora:"allDrives"가 부모범위 쿼리(`'X' in parents`)와 비호환이라 자동찾기 전원 실패시킨 회귀 핫픽스.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/repo/drive-client.ts`
> - **관련 문서**: [[docs/plans/completed/drive-find-robust]]

# Drive corpora allDrives 회귀 핫픽스

## 원인
`findFolderByNamePrefix` 는 `'${parentFolderId}' in parents` 부모범위 검색인데, #303에서 추가한 `corpora:"allDrives"` 와 비호환 → Drive API 가 빈 배열 반환 → 자동찾기 전원 실패(폴더 공유 정상인데도). 대부분 내 드라이브라 driveId 폴백도 미적용.

## 수정
1. `findFolderByNamePrefix`·`findSheetByNamePrefix`·`findSheetByExactName` 에서 `corpora:"allDrives"` 제거. `supportsAllDrives`+`includeItemsFromAllDrives` 유지(내 드라이브+공유 항목 동작).
2. `findFolderByNameInDrive` 의 `corpora:"drive"`+driveId 는 유지(특정 공유드라이브 폴백, 올바름).
3. `findFolderByNamePrefix` 에 결과 건수 `console.warn` 추가(진단).
4. (코드 주석으로 회귀 가드: "corpora allDrives 금지 — parent 범위와 비호환".)

## Acceptance Criteria
- [ ] 폴더 정상 공유된 내 드라이브 사용자 전원 자동찾기 성공.
- [ ] 공유 드라이브도 부모/폴백으로 성공.
- [ ] 정말 미공유일 때만 공유 안내. `npm run check` 통과.

## Log
- 2026-06-05 corpora allDrives 3곳 제거 + 진단 로그.
