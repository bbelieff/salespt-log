---
slug: db-overview-resilient
status: active
created: 2026-06-22
owner: belie
related: 2026-06-22-db-overview-all-or-nothing
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리 overview 를 allSettled 로 바꿔 한 섹션 실패가 4채널 전체를 죽이지 않게.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/service/db.ts loadDBOverview
> - **관련 문서**: [인시던트](../../incidents/2026-06-22-db-overview-all-or-nothing.md)

# fix — DB overview 섹션 격리 (allSettled)

## 변경
- `loadDBOverview`: `Promise.all` → `Promise.allSettled` + `rowsOrEmpty` 헬퍼. 섹션별 실패 시 빈 목록(+경고), 나머지 정상. resolveSheet 만 throw.
- 개별 read 는 이미 전환(tolerant) read — 옛/새 레이아웃 throw 없음(유지).

## 수용 기준
- 표본 시트(옛 레이아웃 포함)에서 4채널 정상 조회 또는 빈 목록(에러 없음).
- 한 섹션 read 강제 throw 시에도 나머지 채널 정상.
- typecheck/lint/structural/unit/doc-drift/size + build + 배포 + health 200.

## 후속(비차단)
- 37개 시트+템플릿 새 레이아웃 이관(별도 PR). incident 기록 완료.

## Log
- 2026-06-22 구현(fix/db-overview-resilient): allSettled + rowsOrEmpty.
