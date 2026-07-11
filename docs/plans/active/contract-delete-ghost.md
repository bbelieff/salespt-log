---
slug: contract-delete-ghost
status: active
created: 2026-07-12
owner: belie
related: db-read-payments, db-migration-pilot, contract-termination
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 이용호(8기) 신고 "계약 삭제 불능 + 0원 계약 잔존"의 근인 진단과 수리 — backfill 이 02 헤더·예시 구간(r3·r5)을 유령 계약으로 적재해 실무/수납(DB read) 화면에 삭제 불가 카드가 표시되던 사고.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: lib/repo/db/read-daily.ts(contracts read), scripts/ops/backfill-sheet-rows.mjs·repair-contracts-header-zone.mjs, 실무/수납 화면
> - **읽고 나면 알 수 있는 것**: 유령 카드가 왜 생겼나 / 왜 삭제가 안 됐나 / 수리·재발 방지는 무엇인가
> - **관련 문서**: docs/plans/completed/db-read-payments.md, docs/plans/active/contract-termination.md(후속 feat)

# fix/contract-delete-ghost — 02 헤더존 유령 계약 수리

## 1. 신고 (2026-07-10, 8기 이용호)

① 휴힐링 계약 삭제 안 됨(환불+수임비 0 처리 후) ② 0원 계약이 건수에 잔존.
Cowork 초기 가설 = "삭제가 DB 미러에 미반영(유령 행)".

## 2. 진단 (2026-07-12, DB 실측 — 읽기 전용 쿼리)

- **휴힐링(r8)은 DB `_cleared:true` 반영 완료**(07-09 20:33 KST) — 초기 가설은 현재
  상태와 불일치. 삭제 자체는 (최종적으로) 성공했다.
- **진짜 근인**: `backfill-sheet-rows.mjs` 의 contracts 적재가 **row≥3** 시작 —
  앱 레이아웃(신형 `02 계약수납관리` firstDataRow=**6**, 구형 `02 계약관리` 5)의
  헤더·예시 구간을 유령 계약으로 적재.
  - **전 기수 94행**(8기 9명 + 아레나 A1-0~A1-6 전원): 사용자마다
    r3("수납총액/0/계약당일 받아올 것" 안내행) + r5(**"00유통" 1,100,000원** 템플릿 예시행).
  - r3 → Zod 통과(계약일=z.string()) → **업체명 "0"·0원 카드, 비이월이라 건수 포함**
    = 신고 ②. r5 → 계약일(2026-05-16)<시작일 → 이월 카드로 표시(집계는 제외).
  - **삭제 불가 재현** = 신고 ①: 카드 삭제 → `clearRow` 가 row<6 을 "헤더 행 보호"로
    거부 → 500 "삭제하지 못했어요". 유령 카드는 구조적으로 지울 수 없었음.
- 대시보드 R2-7a 전수대조가 51/52 diff0 인 이유: r3 는 수임비 0(매출 무영향),
  r5 는 이월 제외 — 집계 수치에는 안 잡히고 **카드 목록·건수 표시**에만 나타남.

## 3. 수리 (2단 PR + ops)

1. **PR #527 (scripts/ 공용부 계약 PR)**: backfill contracts 시작행을 앱 레이아웃과
   동일(신형 6/구형 5)로 — 재발 차단. + `repair-contracts-header-zone.mjs` 신설 —
   시트별 탭 제목으로 레이아웃 확정 후 row<firstDataRow 만 `_cleared+_headerzone`
   jsonb 병합 마킹(dry-run 기본·멱등·payload 보존·구형 r5 실데이터 보호).
2. **ops 실행(VPS)**: repair dry-run → 94행 검증 → `--execute` → 재검증.
   증빙 = PR 코멘트.
3. **본 PR (A트랙 구역)**: `isContractHeaderZoneJunk` 가드 — backfill 출신이면서
   계약일이 날짜가 아닌 행(r3류)은 DB read 에서 제외(시트 경로와 정합: 시트는 이
   구간을 아예 읽지 않음). 정합 테스트 4케이스.

## 4. 수용 기준

- [ ] repair 실행 후: DB `tab='contracts' AND row<6 AND _cleared 아님` = **0행**
      (신형 시트 기준; 구형 r5 실데이터는 보존).
- [ ] 이용호 live 계약 목록(DB read 동치) = 실계약만 — r3·r5 유령 부재.
- [ ] 정합 테스트 초록(기존 5 + 신규 4) + check.sh + 배포 success + health 200.
- [ ] 유령이 이월/건수에 남지 않음: r3 가드로 즉시, r5 는 repair 마킹으로.

## 5. 남긴 것 / 후속

- **mirror fire-and-forget 무재시도**(유령 행 리스크 일반형)는 R3-3(contracts 쓰기
  정본 전환)이 구조적으로 해소 — 이 fix 에서는 비접촉(§0.5 판단, db-write-flip.md §1).
- 03 DB관리 backfill 시작행(row 4)은 유사 사고 여부 미검증 — db 트랙(R3-4) 확인 권장.
- 후속 feat = [[contract-termination]] (계약해지: 사유·반환·soft delete).
