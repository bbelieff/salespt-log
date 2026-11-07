---
slug: step2-db-management
status: completed
created: 2026-11-07
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch feat/step2-db-management)
---

# STEP 1.5·2 통합 1차 — 이름·메뉴 (ADR-0037)

## Intent (왜)
- belie 2026-11-07: DB관리시트가 컨택관리 일을 대부분 함 → 「STEP 2 DB관리」 하나로. 이름은 「일별 기록」, DB 상태는 「컨택 전 / 컨택 완료」. 계약 전은 「고객」 아닌 「DB」.
- 분석·목록: 보고서 「영업 단계 구조 개편」(artifact) ③ 29곳.

## Acceptance Criteria (수용 기준)
- [x] 사이드탭(PC 왼쪽·폰 서랍): STEP 1 DB생산 · STEP 2 DB관리(→ DB 목록, DB 목록·일별 기록에서 켜짐) · 3 · 4. STEP 1.5 메뉴·배지 없음
- [x] DB 목록·일별 기록 위 띠에 [DB 목록 | 일별 기록] 탭(미저장 확인 거침). DB생산 위 「DB관리시트」 탭 없음
- [x] DB 단계 칸: 「STEP 2 컨택 전」 / 「STEP 2 컨택 완료」(내부 키·정렬 그대로)
- [x] 화면 문구 「STEP 2 …」 → 「일별 기록 …」, 「DB관리시트」 → 「DB 목록」/「DB관리」, 「컨택관리에서 …」 → 「일별 기록에서 …」
- [x] 대시보드 오늘 챙길 일: STEP 2(DB관리)/3/4 세 행
- [x] DB 전환 전 기수: DB 목록 → 일별 기록으로 바로(서버 `code: unsupported`, 미저장 확인 없이). 대시보드 「지원 안 함」 판정은 새 문구도 인식
- [x] 주소 그대로(/db-sheet, /contact)
- [x] 시험: 새 step2-db-management 3개 + 문구 고정 시험 갱신. 문서: ADR-0037, components.md

## 범위 밖(다음 PR)
현수막 게시 → STEP 1, 콜지기소 → DB 목록(ADR-0029 대체), 받은 전화 녹음 → DB 등록·미팅.
