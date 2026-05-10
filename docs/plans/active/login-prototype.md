---
slug: login-prototype
status: active
created: 2026-05-09
updated: 2026-05-11
worktree: ../wt/login-prototype
---

# docs(design): 로그인 인트로 + Self-claim 프로토타입

## 결정사항

### Auth 모델
- 보안 약함 모델: 링크만 있으면 누구나 시도, Google 로그인으로 본인 확인
- 미등록 차단 화면 X
- 로그아웃: 좌측 상단 로고 클릭 → 팝업
- **세션 영구**: maxAge 1년 + updateAge 1일 (sliding window) → 사실상 끊기지 않음

### 매칭 메커니즘 (사용자 결정 2026-05-11)
**Drive API 파일명 검색**:
- 트레이너: 시트 이름 `세일즈PT_ {기수}기 {이름} 수강생 경영일지` 패턴
- 사용자: 기수(7) + 이름(김상목) 입력 → 서버가 Drive 검색 → spreadsheetId
- registry 자동 입력 (email, cohort, name, spreadsheetId)
- 시트 B3/C3 자동 작성

트레이너 사전 작업 = 시트 8개 생성 + 서비스계정 폴더 권한 부여만.
마스터 레지스트리 사전 입력 불필요.

## 산출물

`docs/design/prototypes/login.html` — 최종 프로토타입 (이전 v1~v10 탐색본 정리, v10 채택)

### 디자인 요소
1. 로고 splash 시퀀스 — blur-in + scale (1.4s)
2. Aurora 배경 — 14s scale + hue rotate
3. 마우스 spotlight — 320px 빨강 빛 follow
4. Grain texture — 0.04
5. 로고 호흡 (5s) + aura pulse (4s 빨강 glow)
6. **파랑 글래스 도넛** — 8 이모지가 그 안에 떠있음
   - backdrop-filter blur(14px) saturate(140%)
   - radial-gradient mask 가운데 구멍
   - 6s pulse
7. **8개 3D 이모지** (Microsoft Fluent Emoji 3D, jsdelivr CDN)
   - 5탭: 📞 📋 🗓️ 💰 🗂️ → 컨택/일정/캘린더/수납/DB
   - 데코: 📊 🚀 🎯 → 대시보드/성장/타깃
   - 도넛 위 매 45° (반응형 반지름 `min(140px, 38vw)`)
   - 회전 없는 부드러운 scale 등장 + 4~5.5s 호흡
8. 로고 클릭 → boom + 600px ripple + 모든 이모지 boing
9. Google 공식 sign-in 버튼 (Roboto, pill, 4색 G)

### Self-claim 화면
- 기수 number input + 이름 text input
- 입력 검증 → 버튼 활성화
- 안내: 시트 이름 패턴 표시

## 다음 단계 (실 구현 PR)

1. `lib/repo/users.ts` — Drive API 검색 `findSheetByCohortName(cohort, name)`
2. `lib/repo/sales.ts` — `writeProfile(spreadsheetId, cohort, name)` (B3/C3)
3. `lib/service/auth.ts` — `claimAccount(email, cohort, name)` 트랜잭션
4. `app/api/me/route.ts` — needs_claim 응답
5. `app/api/claim/route.ts` — POST { cohort, name }
6. `app/(auth)/login/page.tsx` — 프로토타입 → React 컴포넌트
7. `app/(auth)/claim/page.tsx` — claim 화면
8. `components/TopHeader.tsx` — 좌측 로고 → 로그아웃 팝업
9. NextAuth 설정 (Google provider + 1년 maxAge)
10. SSOT 등재 (components.md, data-model.md)
