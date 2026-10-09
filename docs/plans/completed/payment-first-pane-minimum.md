---
slug: payment-first-pane-minimum
status: completed
created: 2026-10-09
---

# 실무/수납 1뎁스 기본 너비 최소값

- 요청: PC 실무/수납 목록의 기본 너비를 기존 최소값으로 줄인다.
- 범위: useMasterPaneWidth와 page의 기본 너비 복원 버튼, 디자인 정본·worklog.
- 기준: 초기·복원·드래그 하한이 같은 300px. 드래그 상한·2뎁스 6:4·모바일·데이터 저장은 유지.
- 검증: check.sh·production build·현재 head CI·squash·해당 SHA Deploy success·공개 health 200, 실제 PC 목록 300px 및 모바일 레이아웃 확인.
- 참고: docs/design/tokens.md·components.md의 현재 payment 공통 컴포넌트 규격 재사용. 새 디자인 토큰 없음.
- base: 910d903338437cc3b9bd4e322b79c66ae0a45179.
- 구현·로컬 게이트: check.sh PASS(구조 92, 단위/통합 3,335·기존 스킵 45), production build PASS. 현재 head CI·배포·운영 확인은 해당 PR 최종 검증 기록으로 남긴다.
