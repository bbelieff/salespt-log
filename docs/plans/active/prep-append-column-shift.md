---
slug: prep-append-column-shift
status: active
created: 2026-07-13
owner: belie
related: registry-write-preferred-row, 2026-06-14 claim-append-columns
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: admin 사전등록(prep) 행이 레지스트리에 8칸 밀려 적재 + 재제출 시 중복되던 버그 수리
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/repo/users-prep.ts(addTraineePrepRow), /admin add-trainee-prep · bulk · create-cohort-members
> - **읽고 나면 알 수 있는 것**: 왜 밀렸나 / 왜 중복됐나 / claim 경로와 같은 선례 / 어떻게 고쳤나
> - **관련 문서**: registry-append.test.ts(claim 좌표 가드), [[registry-write-preferred-row]]

# prep-append-column-shift

## 증상 (2026-07-13, Cowork 실측)
사전등록 행이 레지스트리에 **8칸 밀려 적재**(A~I 빈, J=cohort·K=name·L=sheetId·M=role).
연습용2 3행 + 김현민(8기) 5행 = 8건. **같은 입력 재제출 시 중복 행 생성**(멱등 부재).

## 원인 (기존에 고쳤던 버그의 재발)
`addTraineePrepRow` 가 `appendRows`(= `spreadsheets.values.append`, 테이블 자동감지)로 신규 행을
썼다. 레지스트리에 **빈 A열 prep 행**이 있으면 append 의 table-detection 이 새 행을 J열~로 민다.
→ claim 경로가 2026-06-14 겪은 것과 **동일 버그**(그때 `A{n}` 결정좌표 update 로 고침 —
`users-claim.ts appendRegistryRow`, `registry-append.test.ts`). prep 경로만 옛 방식으로 남아 재발.

**중복의 근인도 같은 밀림**: 밀린 행은 B(cohort)가 비어 dedup 스캔(`r[1]`)이 실패 →
재제출마다 매칭 못 찾고 또 append. 즉 열밀림 하나가 (밀림+중복) 두 증상의 뿌리.

## Fix
1. **결정적 좌표 write** — 신규 행을 `values.append` 대신 `A{nextRegistryRowNumber(rows.length)}`
   `values.update` 로 기록(항상 A열부터). 3개 분기(plain/ffid/memo) → 고정폭(A~Q) 1경로로 통일.
2. **행수 read 범위 A2:M → A2:R** — 밀린 옛 행도 행수에 포함(덮어쓰기 방지, claim 파리티).
3. **멱등 복구** — A열 정렬로 dedup(`findPrepRowIndex`)이 정상 동작 → 재제출은 update(중복 미생성).
4. **순수 헬퍼 추출 + 단위테스트** — `buildPrepRowValues`(열정렬 17칸)·`findPrepRowIndex`
   (밀림 행 매칭실패 회귀 포함).

## 미포함(라이브 데이터)
기존 밀린 8행(연습용2 3·김현민 5)의 **정리는 belie 수동/admin** — 라이브 registry 는 코드가 건드리지
않음. 이 PR 은 **신규 재발 차단**만. (정리 스크립트 필요 시 별건.)

## Acceptance
- [ ] 신규 prep = A열 정렬 고정폭, 밀림 없음
- [ ] 같은 (cohort,name) 재제출 = update(중복 행 0)
- [ ] 밀림 행 매칭실패 회귀 테스트
- [ ] check.sh 통과
- [ ] 라이브: admin 사전등록 1건 → A열 정렬 확인(belie)
