---
slug: sync-ssot-from-claude-ai
status: active
created: 2026-04-28
worktree: ../wt/ssot-sync
pr: docs/sync-ssot-from-claude-ai
---

# PR — claude.ai SSOT v4 동기화

## Intent
PR 1·1.5 후 claude.ai에 보낸 10개 어긋남 회신에 대한 응답으로 SSOT 4종 갱신본
(data-model v4 / sheet-structure v4 / components v3 / tokens v2)을 받았다.
이를 repo `docs/`로 동기화하고, 추가된 `DailyRevenue` 타입을 lib에 반영.

Meeting 필드명은 한국어로 전환 (사용자 결정 옵션 1) — 시트 컬럼과 1:1 매핑.

## Acceptance Criteria
- [ ] `docs/domains/data-model.md` ← v4
- [ ] `docs/domains/sheet-structure.md` ← v4
- [ ] `docs/design/components.md` ← v3
- [ ] `docs/design/tokens.md` ← v2
- [ ] `lib/types/Meeting`: 한국어 필드명으로 전환 (id/channel/createdAt 등 시스템 필드는 영어 유지)
- [ ] `lib/types`: `DailyRevenue` 신규 추가 (Q~T 일별 실적)
- [ ] `lib/service/gamification.ts`: Meeting 한국어 필드명에 맞춰 갱신
- [ ] `lib/types/Meeting`에 `previousMeetingId`(R) + `주차`(S) 유지 — 실제 시트엔 있음
- [ ] `npm run check` 통과

## Out of Scope
- `DailyEntry` / `DailyView` 합성 타입 — PR 2 service 레이어에서
- XP 가중치에 `DailyRevenue` 반영 — XP 정책 ADR 후 PR 2/3
- API 라우트 (`/api/daily/:date`) — PR 2 구현 시
- 영업관리 좌표 매핑 — PR 2 sales repo

## Steps
1. v4 SSOT 4파일 repo `docs/` 덮어쓰기 (완료)
2. `lib/types/Meeting` 한국어 필드명으로 재작성
3. `lib/types/DailyRevenue` 추가
4. `lib/service/gamification.ts` Meeting 필드 참조 갱신
5. `npm run check`
6. 커밋 + 푸시

## 후속 발견 (다음 핸드오프 회신용)
- v4 `data-model.md` Meeting TypeScript에 `previousMeetingId`(R), `주차`(S) 누락 — 실제 시트엔 있음 (PR 1.5에서 19컬럼 확정)
- 다음 회신 메시지에 이 항목 추가 필요

## Log
- 2026-04-28: claude.ai v4 회신 받음, 워크트리 생성
