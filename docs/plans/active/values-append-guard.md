---
slug: values-append-guard
status: active
created: 2026-08-10
worktree: ../wt/bbe97-values-append-guard
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: `spreadsheets.values.append`(Sheets 테이블 자동탐지)가 두 번(2026-06-14·2026-08-05) 열밀림 사고를 낸 걸 구조 테스트로 기계 강제(BBE-97).
> - **누가 읽나요**: 개발자, 반장(FM)
> - **어떤 기능·작업과 연결?**: `tests/structural/values-append-guard.test.ts` · `lib/repo/sheets-client.ts` · `scripts/ops/**`
> - **읽고 나면 알 수 있는 것**: 왜 `.values.append(` 를 금지하는지 / 무엇이 면제됐고 왜인지 / 위반 발견 시 뭘 봐야 하는지
> - **관련 문서**: `scripts/ops/arena-season2-batch.mjs` 헤더(2026-08-05 사고 원문 기록) · `docs/worklog.md`

# BBE-97 — values.append 열밀림 기계 가드

## Intent (왜)
같은 근인(Sheets `values.append` 의 "테이블 자동탐지")으로 2회 사고가 났다 —
2026-06-14 로그인 무한반송, 2026-08-05 A2 열밀림(등록 54명이 registry `users!A:T` 대신
`S~AL` 로 밀려 화면에서 사라짐). 지금까지 주석 + 개별 리뷰로만 막고 있었다. CLAUDE.md §0
Hashimoto 원칙: 같은 지적이 두 번 나오면 skill issue 가 아니라 harness issue — 구조 테스트로
승격한다.

## Acceptance Criteria
- [x] `tests/structural/values-append-guard.test.ts` — `lib/repo/**`·`scripts/ops/**` 에서
      `.values.append(` 사용 시 실패, 면제는 파일 단위 사유와 함께 등록
- [x] **먼저 실패 확인** — 신설 직후 실제 위반 3건 검출(`arena-season2-batch.mjs:158,371` ·
      `finalize-cohort9.mjs:136`). 지시받은 "2건"과 실측이 달라 3건째(`finalize-cohort9.mjs`)를
      추가 발견 — worklog·보고에 명시.
- [x] 위반 3건 수정 — 158·136 은 `values.update`(다음 빈 행 직접 계산)로 전환, 371 은
      2026-08-05 사고를 진단하려던 임시 코드라 근인 확정·영구수정 완료 후 이제 불필요 →
      **삭제**(디버그 목적상 안전한 대체가 없어 "고치는" 대신 "치운다"가 맞는 판단)
- [x] `lib/repo/sheets-client.ts`(appendRows 유일 정의 지점)만 면제 — 사유: registry 단일
      논리 테이블(users/cohorts)만 씀, 03 DB관리 같은 다중 섹션 탭은 안 씀
- [ ] `npm run check` 통과(진행 중)

## Context (참고)
- [[scripts/ops/arena-season2-batch.mjs]] `appendA2Row` 주석 — 2026-08-05 사고 원인 원문
- [[lib/repo/db.ts]] `findFirstEmptyRow`+`writeRow` — 안전한 대체 패턴의 기존 선례
- [[tests/structural/layers.test.ts]] — 구조 테스트 walk+violation 배열 패턴 참고

## Log
- 2026-08-10 경영일지 데탑 C작업원B(260809) — belie 직접 지시로 착수. 지시된 위반 수(2건)와
  실측(3건)이 달라 재확인 후 3건 전부 수정. `--diag-append` 진단 브랜치는 수정 대신 삭제 —
  근인이 이미 확정·영구수정된 임시 디버그 코드라 "안전하게 고칠 방법"이 없다(그 코드의 존재
  이유 자체가 위험한 API 를 직접 호출해보는 것).
