# append 미러 실패 → 시트 누락행 fallback (R3 §7-3 L4 종결)

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 파일럿 DB-read 화면에서 "방금 만든 계약·DB행·발굴이 미러 실패로 조용히 사라지는" L4 갭을, read 시 시트에서 누락행만 보충해 없앤다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: R3 §7-3(mirror_pending 안전망)의 마지막 잔여 L4(append-silent). `lib/service/contract-payment.ts`·`lib/service/db.ts` read 진입점 + 신규 `lib/service/sheet-backfill.ts`.
> - **읽고 나면 알 수 있는 것**: 왜 mirror_pending이 append 경로를 못 잡나 / union fallback 설계 / 성능 트레이드오프 / 복구법
> - **관련 문서**: `docs/plans/completed/mirror-pending-*`, `docs/plans/active/db-write-flip.md`(R3)

## 배경 — L4 갭 (blocks R3 완료)

R3 §7-3 안전망 `mirror_pending`(#587)은 **DB 정본 쓰기(DB-first)** 경로의 시트-미러-lag만 durable하게 재드라이브한다. 그런데 **신규 생성(append/add)** 경로는 다르다:

- 계약 생성(`addFromContract`/`addPriorContract`), 03 DB탭 4섹션 생성(`appendPurchase/Production/Banner/Lead`)은 **행번호=시트 할당**이라, 동기 재시도 시 중복행(매출 이중계상) 위험이 있어 의도적으로 **R2 fire-and-forget 미러**로 남겨졌다(db-write-flip §6).
- 이 미러가 3회 재시도 후 최종 실패하면 **DB에 그 행이 아예 생성되지 않는다**(placeholder도 없음 — `mirror.ts` 주석 명시). `mirror_pending`은 "이미 존재하는 DB 행"에 표식을 다는 방식이라 **찍을 행이 없어 구조적으로 이 경로를 못 잡는다**.
- 결과: 파일럿(DB-read) 화면에서 방금 만든 **매출 계약/DB행/발굴이 표식·에러 없이 조용히 안 보임**. 후속 편집·arena-carryover(멱등키 한정)·backfill 전까지 지속.

**중요**: 이 미러 실패의 원인은 순간적 DB 장애(blip)다. 그래서 옵션2(append durable redrive)도 같은 blip에 무력하다(재드라이브 대상 행을 DB에 못 만듦). **시트에서 read 시 보충하는 것만이 DB-blip에 견고**하다 — belie 결정(옵션1).

## 설계 — union fallback (DB 우선 + 시트 누락행 보충)

read 진입점(파일럿 분기)에서 **DB read와 시트 read를 병렬** 발사한 뒤, 조인 키 `row`(시트 행번호)로 병합한다. DB read/시트 read가 각 행에 **동일한 시트 행번호를 `row`로 방출**하므로 1:1 매칭이 성립한다.

- **DB 우선(정본)**: DB에 있는 `row`는 DB 값 사용.
- **시트 보충(gap-filler)**: DB에 없는 `row`만 시트에서 끌어온다 = 미러 실패로 누락된 신규행.
- **drift 2차 가드(계약만)**: 사용자가 시트에서 행을 수동 삽입/삭제하면 행번호가 시프트돼 같은 계약이 DB(옛 row)·시트(새 row)에 다른 row로 존재 → 중복될 수 있다. 계약은 `linkedMeetingId`(개명·행이동 불변)를 2차 dedupe 키로 병행해 중복 추가를 막는다. 03 4섹션은 자연 안정키가 없어 `row` 단일 키(drift는 극히 드묾, backfill이 정합 담당).

공통 헬퍼 `backfillMissingRows(dbRows, sheetRows, rowOf, extraKeyOf?)` — googleapis 비의존 순수함수(service util).

### 대상 read 진입점
1. `loadContractPayments` (02 계약) — row + linkedMeetingId
2. `loadDBOverview` (03 4섹션) — 섹션별 row
3. `loadLeadsForPicker` (발굴 피커) — row (보충 lead는 발굴id 없음 → 기존 업체명 폴백 매칭이 흡수)

## 트레이드오프 (자율결정·근거)

- R2-4/R2-5가 얻은 "파일럿 DB-read 시 시트 read 0회" **속도 이득을 반납**한다(이제 항상 시트도 병렬 read). 지연은 `max(DB, 시트) ≈ 시트-only(R2) 수준`이라 R2보다 나빠지지 않고, Sheets API 호출수만 파일럿에서 시트-only 기수와 동일하게 돌아간다.
- 근거: R3 §0 "조용한 반쪽쓰기 금지"에서 **매출 계약이 가장 민감한 클래스** — 정합·정직성 > read 속도. belie가 옵션1로 이 비용을 명시 수용.
- 파일럿(연습·8·9기·아레나) 한정. 비파일럿 완전 불변.

## 수용 기준
- [ ] 미러 실패로 DB에 누락된 신규행(계약·4섹션·발굴)이 read 결과에 보임 (단위 테스트)
- [ ] DB에 있는 행은 DB 값이 정본(시트로 덮이지 않음)
- [ ] 계약 drift(같은 linkedMeetingId, 다른 row) 시 중복 추가 안 됨
- [ ] 비파일럿(sheet 게이트)은 기존 경로 그대로 — 동작 불변
- [ ] DB read 실패 시 기존처럼 시트 전체 fallback (화면 에러 금지)
- [ ] check.sh 초록 (typecheck·lint·structural·test·파일크기·doc-drift)

## 복구법
단일 커밋 PR → 문제 시 `git revert <sha>` 한 번으로 기존 배타 fallback(DB 성공=DB만 / DB 실패 시만 시트)으로 즉시 복귀. 정본=DB라 데이터 손실 없음.
