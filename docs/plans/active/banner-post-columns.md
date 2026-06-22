---
slug: banner-post-columns
status: active
created: 2026-06-22
owner: belie
related: 0023-banner-posting-log-1n, 2026-06-22-banner-post-grid-columns
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 현수막 게시 로그(AF:AI) 컬럼 자가치유로 게시 저장 실패 복구 + 저장 실패 피드백.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/repo/banner-post.ts, BannerPostingLog
> - **관련 문서**: [ADR-0023](../../decisions/0023-banner-posting-log-1n.md), [인시던트](../../incidents/2026-06-22-banner-post-grid-columns.md)

# fix — 현수막 게시 컬럼 자가치유 (C2 게시 저장 복구)

## 변경
- `lib/repo/banner-post.ts`: `ensureBannerCols`(ensureGridColumns 35열 + AF3:AI3 헤더 빈 셀에만, 멱등) → append/update 진입 시 호출. 첫 게시 때 라이브 시트 컬럼 자동 확장.
- `BannerPostingLog.tsx`: 저장/삭제 실패 시 에러 메시지(이전 조용). 남은=0 이면 입력행 숨김(완료 표시).

## 수용 기준
- 컬럼 없는 옛 시트에서 게시 입력→저장 시 AF:AI 자동 확장 후 1행 기록, 목록 갱신, 남은 차감, 영업관리 현수막 생산(E) 게시일 반영.
- 남은=0 → 입력행 숨김. 저장 실패 시 메시지 노출.
- typecheck/lint/test 그린 + build + 배포 + health 200.

## 보류(별도)
- 게시기록 블록을 '기타' 필드 위로 재배치 — RowForm 구조 변경 필요(기능 무관, 후속).
- 37시트+템플릿 일괄 이관 — 자가치유로 점진 대체.

## Log
- 2026-06-22 구현(fix/banner-post-columns): AF:AI 자가치유 + 저장 실패 피드백 + 남은 0 입력행 숨김.
