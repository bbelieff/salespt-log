---
slug: logo-and-session
status: active
created: 2026-05-10
worktree: ../wt/logo-session
---

# fix: 로고 누락 + 8주 세션 노트

## 1. 로고 누락 fix

`public/salespt-logo.png` 가 git 에 안 올라가 있어 VPS 배포 후 헤더 좌상단 404.
파일 추가 후 푸시 → master 머지 → VPS pull + rebuild → PM2 reload.

## 2. 영구 로그인 세션 (Path B 작업으로 이월)

**사용자 결정**: "계속 떠있어야지" — 한 번 로그인 후 명시적 로그아웃 전까지 끊기지 않음.

```ts
// app/api/auth/[...nextauth]/route.ts (Path B 구현 시)
export const authOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 365,   // 1년 (실질 영구)
    updateAge: 60 * 60 * 24,       // 매일 활동 시 자동 1년 슬라이드
  },
  jwt: { maxAge: 60 * 60 * 24 * 365 },
  cookies: {
    sessionToken: {
      options: { httpOnly: true, sameSite: "lax", secure: true, path: "/" },
    },
  },
};
```

**효과**:
- 한 번 로그인 = 1년 유지
- 매일 1회만 방문해도 슬라이드 윈도우로 자동 갱신 → **사실상 영구**
- 명시적 로그아웃 액션만 세션 종료 (좌측 로고 → 팝업 → 로그아웃)

현재 STUB 모드라 적용 X — Path B PR 에서 함께 처리.
