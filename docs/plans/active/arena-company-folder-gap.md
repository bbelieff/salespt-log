> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: ops 배치로 아레나에 편입된 참가자는 「업체관리」 폴더가 없어 드라이브 연결이 실패한다 — 원인·실측·해결·남은 일.
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `app/api/drive-link/route.ts`, `scripts/ops/arena-season2-batch.mjs`, `app/api/admin/create-arena-members/route.ts`
> - **읽고 나면 알 수 있는 것**: 왜 A2 참가자만 연결이 깨지나 / 폴더를 만들어 주면 되는 것 아닌가 / 지금 무엇이 고쳐졌고 무엇이 남았나
> - **관련 문서**: docs/decisions/0007-drive-link-permission.md, docs/decisions/0015-admin-oauth-drive-create.md, docs/plans/active/arena-season2-setup.md

# 아레나 「업체관리」 폴더 결손 (2026-09-01)

## 증상

belie 신고 — **"8기 김현민 구글드라이브 편집자 권한 링크를 줬는데 연결이 안 된다.
The caller does not have permission."**

`/payment` 재현 결과:

| 시도 | 결과 |
|---|---|
| 운영자가 준 `01 피드백업체` 주소를 수동 입력 | `arena_folder_mismatch` |
| [다시 연결](auto) | `arena_folder_missing` |

## 근인 — 편입 경로가 둘인데 한쪽만 폴더를 만든다

| 편입 경로 | 업체관리 폴더 생성 | 실제 결과 |
|---|---|---|
| 관리자 화면 `/api/admin/create-arena-members` | **한다** (`createFolder`, route.ts:189~197) | A1 참가자 40여 명 전원 폴더 있음 (2026-06-10 생성) |
| ops 배치 `scripts/ops/arena-season2-batch.mjs` | **안 한다** (`createFolder`·"업체관리" 참조 **0건**) | A2 참가자 **전원 폴더 없음** |

`lib/service/cohort-token.ts:decideArenaAction` 은 `folderName` 을 계산까지 해두는데
ops 배치에는 그 값을 쓰는 곳이 없다.

**실측 (belie Drive 전수 검색, 2026-09-01)**

- `title contains '업체관리' and mimeType = folder` → `세일즈PT_A1_…업체관리` **40여 개**
  (전부 부모 = cohorts A1 행의 I열 = "참가자 업체관리" 폴더)
- 같은 검색에 `세일즈PT_A2_…업체관리` **0개**
- `세일즈PT_A2_…경영일지` 시트는 **1~8기 전부 존재**(2026-08-05 배치 생성).
  즉 시트는 만들어졌고 폴더만 빠졌다.
- A2**-9**기는 시트도 registry 행도 없다 — 아직 편입 자체가 없다.

## 왜 "폴더를 만들어 주면 끝"이 아닌가

폴더만 새로 만들면 **빈 폴더**가 된다. 수강생 시절 업체 자료를 옮겨 담아야 하는데,
**그 업체 폴더의 주인이 수강생 본인**이라 운영자 계정으로는 옮길 수 없다.

2026-09-01 실측 (김현민 님 `01 피드백업체` 하위 2건, 운영자 OAuth):

```
착한대게        (owner: 수강생 본인)      → The caller does not have permission
(주)다올테크    (owner: 운영 계정 leadbz) → The caller does not have permission
```

두 폴더 모두 공유 문서함 안에 있고, 목적지(16C)는 다른 위치라 이동이 막힌다.
belie 가 신고한 오류 문구와 **같은 문구**다.

## 해결 — 옮기지 말고, 원래 자리를 가리킨다

`app/api/drive-link/route.ts` 아레나 분기에 구제 경로를 추가했다.

```
auto  ① registry O 저장값        (기존)
      ② 16C 하위 업체관리 폴더    (기존)
      ③ 본인 시트 부모의 `01…` 폴더  ← 신규
manual  본인 업체관리 폴더/16C     (기존)
      + 본인 `01…` 폴더 — **id 일치일 때만**  ← 신규
```

안전 규칙 (테스트로 박제 — `tests/api/drive-link-arena-legacy-folder.test.ts`):

- ②가 있으면 ②가 이긴다 → **A1 참가자 동작 불변**
- ③은 **본인 시트의 부모 한 단계만** 본다. 공유드라이브 전체 검색
  (`findFolderByNameInDrive`)은 쓰지 않는다 — 같은 이름 폴더가 참가자마다 있어
  남의 업체 폴더가 붙을 수 있다
- manual 은 **id 대조**라 남의 폴더 URL 은 계속 거부(`arena_folder_mismatch`)
- 아무것도 못 찾으면 기존 안내가 그대로 뜬다 (동작 후퇴 없음)

## 남은 일

1. **재발 방지** — ops 배치(`arena-season2-batch.mjs`)에도 업체관리 폴더 생성을 넣는다.
   관리자 화면과 배치가 같은 결과를 내야 한다. (#913 계열)
2. **registry 결손 점검** — A2-7·A2-8 참가자의 registry 행·O열 상태 전수 확인.
3. **정리** — 2026-09-01 진단 중 만들었다가 이관 불가로 미사용 처리한 빈 폴더 1개
   (`(미사용) 2026-09-01 자동생성 A2-8 김현민 …`, 16C 하위)는 운영자가 휴지통으로.
