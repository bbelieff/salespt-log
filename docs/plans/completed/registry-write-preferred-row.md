---
status: completed
slug: registry-write-preferred-row
created: 2026-06-22
owner: belie
related: 2026-06-22-registry-multirow-write-read-mismatch
completed: 2026-06-22
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 레지스트리 write(updateCell)를 read(pickPreferredUser)와 같은 행에 하도록 통일해 다행 계정 Drive 연결 무한루프 해소.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/repo/users.ts(updateCell), lib/repo/user-priority.ts(pickPreferredRow)
> - **관련 문서**: [인시던트](../../incidents/2026-06-22-registry-multirow-write-read-mismatch.md)

# fix — 레지스트리 write 행 = read 행 통일

## 변경
- `user-priority.ts`: `pickPreferredRow({user,sheetRow}[])` 순수 헬퍼(= pickPreferredUser 동일 우선순위로 행 선택).
- `users.ts updateCell`: 첫 매칭 행 → **pickPreferredRow 행**에 write. parse 전부 실패 시 첫 행 fallback(옛 동작 보존).
- 회귀 테스트(tests/repo/preferred-row.test.ts): 아레나+트레이너 다행 → write 행 = read 행, archived/단일/빈 케이스.

## 수용 기준
- 같은 이메일 2행(아레나+트레이너)에서 updateDriveLink→loadMe 가 같은 행 → driveLinkStatus="ok" 반영(루프 해소).
- 단일 행 계정 회귀 없음. typecheck/lint/structural/unit/doc-drift/size + build + 배포 + health 200.
- 라이브: 테스터(A1-0) 자동/수동 연결 1회로 유지.

## 후속(선택)
- 동일 이메일 중복행 경고 점검 스크립트.

## Log
- 2026-06-22 구현(fix/registry-write-preferred-row): pickPreferredRow + updateCell 행 통일.
