---
slug: fix-drive-link-permission-ux
status: active
created: 2026-06-04
owner: belie
related: practice-payment-polish, 0007-drive-link-permission
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Drive "자동으로 찾기"가 폴더 미공유(parents 빈 배열/403)를 "상위 폴더 없음"으로 오인하던 것을, 원인별 진단 로그 + 행동지향 공유 안내 UX로 개선.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/api/drive-link/route.ts`, `lib/repo/drive-client.ts`, `app/(app)/payment/_components/DriveLinkBar.tsx`
> - **읽고 나면 알 수 있는 것**: parents 빈배열의 진짜 원인, 에러 종류 구분, SA 공유 안내 패턴
> - **관련 문서**: `docs/decisions/0007-drive-link-permission.md`

# Drive 자동찾기 권한 진단·UX (fix)

## Intent / 원인
- Drive API 는 요청 주체(서비스계정 `masterbot@saleslog-494703.iam.gserviceaccount.com`)가 접근 가능한 부모만 `parents` 로 반환. **시트 파일만 공유**되면 `files.get` 은 성공하지만 `parents=[]` → 코드가 "상위 폴더 없음"으로 오인.
- 진짜 해결 = **폴더를 SA 에 공유**. 코드는 이를 정확히 진단·안내해야 함. (코드 로직 자체는 정상)

## 변경
1. **진단 로그** (`drive-client.ts getDriveFileMeta`): 판별형 결과로 변경.
   - 성공 → `console.warn("[drive-link] files.get ok", {fileId,name,parentsCount})`.
   - 실패 → `console.warn("[drive-link] files.get FAILED", {fileId,code,message})` (403/404 등).
   - 반환: `{ok:true,name,parentId,parentsCount} | {ok:false,code,message}`.
2. **행동지향 에러** (`route.ts`, mode=auto):
   - `code===404` → `errorKind:"sheet_not_found"`.
   - `!ok`(403 등) 또는 `parentId==null`(빈 parents) → `errorKind:"folder_not_shared"` + `saEmail`(env `GOOGLE_SERVICE_ACCOUNT_EMAIL`) + "폴더를 SA 에 뷰어로 공유" 안내.
   - 상위는 찾았지만 01 없음 → `errorKind:"folder_01_missing"` (구분).
3. **UX** (`DriveLinkBar.tsx`): `folder_not_shared` 시 공유 대상 SA 이메일 표시 + **복사 버튼** + "공유 방법" 1~2줄. 수동 입력칸은 같은 화면에 계속 노출(자동 실패해도 대안 보임).
4. (선택, 미구현) 트레이너 온보딩에 "기수 폴더를 SA 에 공유" 안내 — 후속 검토.

## Acceptance Criteria
- [ ] 폴더 미공유 상태 자동찾기 → 무엇을(폴더)·누구에게(SA 이메일)·어떤 권한(뷰어)으로 공유할지 정확 안내 + 이메일 복사.
- [ ] 폴더 공유 후 자동찾기 성공(01 피드백업체 연결).
- [ ] 서버 로그로 실패 원인(403/빈 parents/404) 구분 가능.
- [ ] `npm run check` 통과.

## 범위 밖
- Drive 폴더 자동 생성(ADR-0007 연결-only), 권한 변경 API 호출, 온보딩 구현.

## Log
- 2026-06-04 구현. getDriveFileMeta 판별형 + route 분기 + DriveLinkBar 공유안내.
