---
slug: admin-impersonation
status: active
created: 2026-05-11
worktree: ../wt/admin
---

# feat(auth): Admin (마스터) 계정 — 모든 사용자 조회·편집

## 사용자 결정
Admin email 2개: `beliefkimkim@gmail.com`, `leadbzcenter@gmail.com`
이 계정으로 로그인 시 모든 등록 수강생의 시트를 조회·편집.

## 메커니즘 — Impersonation via cookie

- `lib/auth/identity.ts`:
  - `isAdminEmail(email)` — env `ADMIN_EMAILS` 와 매칭
  - `getSessionEmail()` — 실제 로그인 email
  - `getActiveUserEmail()` — admin이 impersonate 중이면 그 사람, 아니면 sessionEmail
  - `setImpersonation(target)` — cookie 설정/해제 (admin only)
- `lib/auth/stub.ts` — `getCurrentUserEmail` 을 `getActiveUserEmail` 로 re-export
  - 모든 API route 가 자동으로 admin impersonation 인식

## 흐름

```
Admin Google 로그인
   ↓
/ → /admin (사용자 선택 화면)
   ↓ 클릭
POST /api/admin/switch { email } → cookie set
   ↓ redirect
/dashboard → 그 사람의 시트 데이터 표시
   ↓
헤더에 빨강 "Master 모드: 박OO 으로 보는 중" 배너
   ↓ "바꾸기" 클릭
/admin 으로 돌아가 다른 사람 선택
```

## 추가 파일

- `lib/auth/identity.ts` — 신원 헬퍼
- `lib/repo/users.ts::listAllUsers()` — admin 전용 전체 목록
- `app/api/admin/users/route.ts` — GET 목록
- `app/api/admin/switch/route.ts` — POST impersonation 토글
- `app/admin/page.tsx` — admin 랜딩
- `components/auth/AdminUserPicker.tsx` — 사용자 선택 UI
- `app/page.tsx` — admin 라우팅 추가
- `components/TopHeader.tsx` — impersonation 배너 + 팝업 "다른 수강생 선택" 링크
- `middleware.ts` — /admin 보호
- `app/api/me/route.ts` — admin 메타 (isAdmin, sessionEmail, impersonating) 응답

## env 추가 필요

```
ADMIN_EMAILS=beliefkimkim@gmail.com,leadbzcenter@gmail.com
```

## Acceptance
- [x] typecheck PASS
- [x] lint PASS
- [x] structural PASS (6)
- [x] tests PASS (28)
- [x] doc-drift PASS
