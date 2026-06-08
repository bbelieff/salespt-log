---
slug: discover-regular-folder
status: active
created: 2026-06-08
owner: belie
related: contract-formula-channel-agnostic, discover-folder-sheets(#321), 0011-drive-sheets-write-expansion
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: [폴더에서 자동 찾기]가 소유자 있는 일반 공유폴더(Shared with me, driveId 없음)에서 0건이던 문제 — 부모범위 트리워크(깊이 3)로 견고화 + install 입력에 폴더 URL 허용.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/repo/drive-client.ts(listSheetsInDriveByTokens)`, `app/api/admin/discover-folder-sheets`, `app/api/admin/install-formulas-by-id`, `InstallFormulasByIdButton`
> - **읽고 나면 알 수 있는 것**: 왜 공유드라이브 가정이 틀렸는지, 트리워크 깊이/토큰 매칭, 폴더 URL 설치
> - **관련 문서**: `docs/plans/active/contract-formula-channel-agnostic.md`

# 일반 공유폴더 발견 + 폴더 URL 설치

## 배경
세일즈PT★/8기 폴더는 **공유 드라이브가 아니라 소유자 있는 일반 폴더(Shared with me)** → `driveId` 없음.
- #321: `corpora:"drive"+driveId` 전제라 일반 폴더에서 0건.
- #322(선행, 머지·배포): driveId 의존 제거 → **부모범위 `'X' in parents` BFS 트리워크**로 전환. 실측: 8기 폴더에서 8본 발견, 템플릿+8기+registry 28개 시트 설치 완료.

## 이번 변경 (#322 후속 보강)
1. **깊이 제한** — BFS 에 `MAX_DEPTH=3`(기수폴더0>이름폴더1>시트면 충분, 안전 여유). 업체관리 등 깊은 트리 과탐색 방지. folderBudget 300 상한 유지.
2. **토큰 매칭(이미 동작 확인)** — UI "세일즈PT 8기 경영일지" 공백 split → 각 토큰 `includes`(부분포함, "세일즈PT_"도 매칭) + 기수 숫자경계("8기"≠"18기") 재검증. 통짜 매칭 금지.
3. **에러 힌트** — "(토큰/폴더/공유드라이브 멤버십 확인)" → "(폴더가 서비스계정에 공유됐는지·토큰 확인)". 공유 드라이브 가정 제거.
4. **[확장] install-formulas-by-id 폴더 URL 허용** — 입력이 `/folders/{id}` 패턴이면 폴더로 간주 → BFS 로 안의 경영일지 시트 자동 발견·설치 대상 추가. 시트 ID 정규식이 폴더 ID 를 오인 설치하지 않게 분기(폴더 URL 패턴 우선 판정). 응답에 `expandedFromFolders`. UI 도움말: "시트/폴더 링크 모두 가능 — 폴더면 안의 경영일지를 자동으로 찾아요."

## 수용 기준
- [x] 8기 폴더 URL + "세일즈PT 8기 경영일지" → 이름폴더 안 시트 발견·목록 표시 (#322 실측 8본).
- [x] 공유 드라이브 폴더도 동일 동작(부모범위 + supportsAllDrives).
- [x] SA 미공유 폴더 → 빈 결과 + 명확 안내.
- [x] install 입력에 폴더 URL → 안의 경영일지 자동 설치. 폴더ID 오인 설치 없음.
- [ ] `npm run check` 통과.
