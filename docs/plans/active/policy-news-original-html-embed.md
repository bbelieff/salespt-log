---
slug: policy-news-original-html-embed
status: active
created: 2026-10-03
worktree: C:\Users\belie\Desktop\Belief\클로드\wt\codex-policy-news-original-embed
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 정책자금 원문 전체 기능을 최소 권한의 opaque-origin iframe으로 앱 안에 복원하는 작업 계획입니다.
> - **누가 읽나요**: 개발자, 독립 검수자, 작업반장
> - **어떤 기능·작업과 연결?**: `/payment/news`, `/news/latest`, `POLICY-NEWS-ORIGINAL-HTML-EMBED-R3`
> - **읽고 나면 알 수 있는 것**: 허용 sandbox 권한 / 부모-자식 프레임 경계 / 출시 전 검증 항목
> - **관련 문서**: `CLAUDE.md`, `docs/design/components.md`

# 정책자금 원문 HTML 임베드

## Intent (왜)

Native JSON 재구성 대신 공개 원문 `/news/latest`의 검색·필터·카드/표/캘린더·상세·원문 링크를 그대로 앱 안에서 사용한다. 원문 script는 실행하되 `allow-same-origin` 없이 opaque origin을 유지한다.

## Acceptance Criteria (수용 기준)

- [x] iframe source는 정확한 `POLICY_NEWS_URL` 한 개만 허용한다.
- [x] sandbox는 정확히 `allow-scripts allow-popups`이며 `allow-same-origin` 등 다른 권한은 없다.
- [x] 부모는 `contentDocument`나 `contentWindow`로 자식 DOM 준비를 판정하지 않는다.
- [x] loading/load/error/retry 문구가 부모가 실제로 아는 상태만 말한다.
- [x] PR #1088의 데스크톱 외부 containment와 모바일 자연 흐름을 보존한다.
- [ ] 실제 child frame에서 검색·지역·성격 필터, 카드/표/캘린더, 상세, 원문 링크를 검증한다.
- [x] `bash scripts/check.sh`, production build를 통과한다. 정상 commit hook은 commit 시 확인한다.

## Context (참고)

- 원문은 inline script 1개로 화면을 만들며 `localStorage` 접근은 읽기·쓰기 모두 `try/catch` 처리한다.
- 모든 원문 링크가 `target="_blank"`이므로 `allow-popups`는 원본 링크 동작에 필요한 최소 권한이다.
- Caddy/CSP/auth/header/data는 변경하지 않는다.

## Steps (점진적 공개)

1. RED 테스트로 URL·sandbox·opaque parent·상태·layout 계약을 고정한다.
2. 기존 native fetch/parser/renderer를 고정 URL iframe으로 최소 교체한다.
3. focused/full check와 build 뒤 실제 child frame을 검증한다.
4. commit/push/PR 후 D 독립 검수까지 HOLD한다.

## Log

- 2026-10-03 Stage 1: 원문 23건 및 검색·지역·성격·3개 view·상세 동작 확인. `allow-scripts allow-popups` 보안 계약 확정.
- 2026-10-03 구현: focused 41/41, 전체 구조 90/90, unit/integration 3,226 PASS, doc-drift PASS, production build PASS.
- 2026-10-03 브라우저: 원문 직접 기능은 PASS. 로컬 앱 결합은 원문 CSP의 same-origin 제한과 개발 서버 응답 지연으로 `NOT_RUN_TOOL_DELAY`; 같은 출처 배포 뒤 child-frame 실제 동작을 검증한다.
