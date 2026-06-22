---
slug: share-scores-ensure-and-targets
status: active
created: 2026-06-22
owner: belie
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 공유왕(share_scores) 점수 저장 시 탭 자동생성(ensure) + 대상 목록에서 입금 필터 제거(전체 참가자).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/repo/share-scores.ts, lib/service/scoreboard.ts

# fix — 공유왕 점수 저장(탭 ensure) + 대상 전체 참가자

## 변경 (belie 작성분 커밋·배포)
- `lib/repo/share-scores.ts`: `share_scores` 탭이 없으면 자동 생성(ensure) 후 write → 탭 부재로 저장 실패하던 문제 해소.
- `lib/service/scoreboard.ts`: 공유왕 대상 목록에서 입금 필터 제거 → 전체 참가자 대상.

## 수용 기준
- 탭 없는 시트에서도 공유왕 점수 정상 저장. 대상=전체 참가자.
- typecheck/lint/test 그린 + build + 배포 + health 200.

## Log
- 2026-06-22 커밋·배포(fix/share-scores-ensure-and-targets): 탭 ensure + 대상 입금필터 제거.
