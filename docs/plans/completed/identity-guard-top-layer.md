> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 「다른 분의 화면으로 바뀌었어요」 차단막을 열린 저장 창보다 위로 올리고 초점을 차단막에 묶는다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `components/auth/IdentityGuard.tsx`
> - **관련 문서**: [tokens 적층 표](../../design/tokens.md) · [components](../../design/components.md)

# 신원 가드 차단막 — 맨 위 층 (2026-11-10)

## 목표 (belie 2026-11-10, UI 점검 보고서 1-1 「진행」)
다른 탭에서 다른 수강생을 열면 이 탭을 막는 차단막이 `z-50` 이라, 저장·삭제 창(`z-[300]`)이 열려 있으면 그 아래 깔려 [저장]을 그대로 누를 수 있었다 → 다른 수강생 기록에 저장.

## 수용 조건
1. 차단막 층이 `app`·`components` 안 어떤 z 값보다 높다(지금 최고 10000 → 20000). 새로 더 높은 층을 만들면 시험이 실패한다.
2. 막히는 순간 초점이 [이 탭 새로고침하기] 버튼으로 옮겨지고, Tab 을 눌러도 뒤쪽 입력칸으로 가지 않는다(Enter 저장 방지).
3. 브라우저 기본 대화상자(`showModal` — SheetDialog·MeetingSafetyDialog)는 z 값과 무관하게 맨 위 층이라, 차단막도 `<dialog>.showModal()` 로 띄워 그 위에 온다. Esc 로 닫히지 않는다.
4. (보고서 1-6 「진행」) 30초 확인 사이 공백 막기: 탭이 처음 받은 지문을 같은 사이트 /api 쓰기 요청 머리말 `x-salespt-tab-identity` 에 싣고(`components/auth/tab-identity-stamp.ts`), 서버 `getWritableUserEmail` → `assertTabIdentity` 가 지금 지문과 다르면 `TabIdentityMismatchError`(409)로 거부. 머리말이 없으면(옛 탭·서버 호출) 검사하지 않는다. 지문 계산은 whoami 와 공용(`lib/auth/identity-fingerprint.ts`).
5. 기존 동작 유지: 자동 새로고침 없음, 지문을 못 받으면 막지 않음.

## 검증
- `tests/components/tab-identity-stamp.test.ts`(머리말 싣기), `tests/auth/tab-identity-write-guard.test.ts`(서버 거부) 추가.
- `tests/components/identity-guard-layer.test.ts`(층 비교 + jsdom 초점·Tab) 2건, 기존 `identity-guard.test.ts` 9건(초점 effect 까지 reload 금지 범위 확대).
- 실제 두 탭 전환 재현은 로그인 화면이 필요해 NOT_RUN — 배포 뒤 사용자 확인.

## 되돌리기
squash 커밋 1건 revert. 화면만.
