---
slug: r3-single-cell-writers
status: active
created: 2026-07-15
owner: belie
related: db-write-flip, 0020-production-metric-ssot-to-db, 0024-direct-production-inflow-sync, 0029-lead-inflow-equals-production, 0010-meeting-reservation-card-count
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R3 잔여⑤ — 01 영업관리 단일셀 writer 2개(생산 E 집계 · 미팅예약 H)를 DB 정본으로 전환하는 작업. 구현 전 적대 검증에서 선재 버그가 다수 나와 2 PR 로 분할했다.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `writeProductionCell`(sales-production-cell.ts) · `decrementMeetingReservation`(sales.ts) · `salesDbPayload`(신규) · `persistSalesRows`(R3-1)
> - **읽고 나면 알 수 있는 것**: 왜 2 PR 인가 / PR-1 이 고친 라이브 버그는 무엇인가 / PR-2 가 반드시 지켜야 할 5가지
> - **관련 문서**: docs/plans/active/db-write-flip.md(R3 SoR §6)

# R3 잔여⑤ — 단일셀 writer 2개 DB 정본 전환

## 0. 대상과 배경
R3-1 이 "스코프 밖·후속" 으로 유예한 두 writer:
- `writeProductionCell(sid, date, channel, count)` — 01 **E(생산)**. 매입DB·콜지기소만(직접생산·현수막의 E 는
  컨택 소유). 콜지기소는 **E:F 동시**(ADR-0029). 호출자 = `syncProduction`(03 편집 **완료 후** 재집계) — **에러 삼킴**.
- `decrementMeetingReservation(sid, date, channel)` — 01 **H**. 시트 H 를 읽어 −1(RMW).
  호출자 = 미팅 삭제 cascade(삭제 **완료 후**) — `catch { skip }` **에러 삼킴**.

둘 다 **이미 커밋된 작업의 파생 부수효과**다. 그래서 "실패 = 사용자 에러(throw)" 를 문자 그대로 적용하면
*이미 저장된* 작업이 에러가 되는 회귀가 난다(R3-4 critic-1 이 같은 이유로 파생셀을 스코프에서 뺐다).

**flip 의 실익**: 파일럿은 sales 를 **DB 에서 읽는다**(R2-1). 그런데 두 writer 의 DB 반영은
`mirrorSheetRow`(fire-and-forget, **재시도 0회**)뿐 → 한 번만 실패해도 **파일럿에게 영구 스테일 E/H** 가 남는다.
읽는 저장소를 동기 write 로 바꾸는 것이 이 작업의 본질.

## 1. 구현 전 적대 검증 (2026-07-15) — 설계가 크게 틀렸다
3 검증자 + 완전성 비평가. 초안 설계에서 **결함 5건** 확인:

| # | 발견 | 결과 |
|---|---|---|
| 1 | **직접생산 `production` 은 strip 이 아니라 MAP(:=inflow)** — 시트는 E=유입(ADR-0024)인데 DB 엔 클라 에코가 실림. 아무 writer 도 안 고쳐 **DB 가 0/백필값에 영구 고정** → **파일럿 대시보드가 직접생산 생산을 과소표시 중(라이브 버그)** | **PR-1 로 수리** |
| 2 | **편집기간(1~10주) 가드가 DB 쓰기에 없음** — 시트가 못 담는 행이 DB 에 생기고, 무필터 집계 2곳(대시보드 채널생산·유입대기)이 영구 부풀림 | PR-2 필수 |
| 3 | **"시트는 아무도 안 읽는 사본" 전제가 거짓** — `readProfileBundle`(sumFunnelDataRows)이 **시트 H** 를 합산(기수 게이트 없음), 시트는 **DB 장애 시 폴백 경로** | PR-2 전제 수정 |
| 4 | **시트 H 를 쓰는 경로가 둘** — `fireSheetMirror`(비직렬 **스냅샷 재생**) vs 신규 셀 큐 → lost update. **같은 큐 + 수렴형** 통합 필수 | PR-2 필수 |
| 5 | **H 의 ±1 RMW 는 ADR-0010 이 "COUNT 재계산으로 통일" 하라고 명시한 것** — DB 로 옮기면 부재키 no-op·lost update·카드수 writer 와 충돌 | PR-2: RMW 폐기 |

## 2. PR-1 (본 PR) — DB payload 진실성 + 라이브 버그 수리 (flip 없음)
**컨택 저장의 DB payload 는 시트에 쓰는 것과 정확히 같은 값만 싣는다.** 단일 원천 = 신규
`lib/repo/db/sales-payload.ts` `salesDbPayload`, 두 경로(DB 정본 쓰기 `toDbRows` · 시트정본 DB 미러)에 공통 적용.

| 채널 | 시트 | DB payload |
|---|---|---|
| 매입DB | F:H (E = 03 매입 집계 파생, ADR-0020) | `production` **미기입** |
| 콜·지·기·소 | G:H (E:F = 03 접수 파생, ADR-0029) | `production`·`inflow` **미기입** |
| 직접생산 | E = **유입** (ADR-0024) | **`production := inflow`** (매핑 — strip 하면 영구 0) |
| 현수막 | E = production (게시, ADR-0025) | 그대로 |

- 미기입 → jsonb 병합이 기존 파생값 보존(`writeProductionCell` 이 유일 writer).
- **비파일럿 불변**: 비파일럿은 시트를 읽는다. DB 는 그림자 사본이라 payload 교정이 화면에 영향 없음.
- **자가치유**: 직접생산은 그 날짜를 다시 저장하면 `production := inflow` 로 교정됨.

## 3. PR-2 (구현 완료) — 실제 flip

**PR-1 덕분에 설계가 단순해졌다**: DB 행이 이제 "시트가 가져야 할 값" 과 1:1 이므로, 수렴 미러가
**E:H 를 통째로** 내려찍으면 된다 — **채널 분기 소멸**(E=production · F=inflow · G=contactProgress ·
H=meetingReservation, 4채널 공통). 초기 검증의 "소유 셀만" 권고는 **PR-1 이전** 전제였다.

| 구성 | 내용 |
|---|---|
| `sales-write.ts` (재작성) | 게이트 내장 `persistProductionCell` · `persistMeetingReservationCount` + **시트별 직렬 수렴 큐**(`queueSalesRowSync`/`runSalesRowSync`). **`fireSheetMirror`(스냅샷 재생) 폐기·흡수** — DB 정본 경로의 **유일한 시트 writer** |
| `sales-row-write.ts` (신규) | `writeSalesRowCells`(E:H 통째) · `isWithinSalesWindow`(편집기간 가드) |
| `db/client.ts` | `readSalesRowFromDb`(단일행) — 수렴 잡이 **실행 시점 최신 DB** 를 읽는다 |
| `service/db.ts` | `syncProduction(ctx, …)` → `persistProductionCell` (SalesCtx 관통) |
| `service/contact.ts` | 미팅 삭제 cascade → `persistMeetingReservationCount` |

**의무 5건 이행**
1. ✅ **편집기간 가드** — `isWithinSalesWindow` 가 false 면 **DB 에도 안 쓴다**(무필터 집계 부풀림 차단).
2. ✅ **단일 직렬 + 수렴형** — 스냅샷 재생 폐기. 잡은 최신 DB 행을 읽어 시트를 수렴.
3. ✅ **통째 E:H** — PR-1 로 DB 가 진실해져 오히려 이게 정답(위 설명).
4. ✅ **H = 카드수 절대 재계산**(±1 RMW 폐기, ADR-0010 자체 후속). 재집계는 `readMeetingsFromDb` —
   `findMeetingsByDateRecord` 는 DB 0건 시 **시트 폴백**이라 지운 카드가 부활한다(함수 안에 가둠).
5. ✅ **호출자 삼킴 유지**(파생 부수효과) + 실패는 throw(시트 폴백 금지). 시트 미러 실패는 Sentry 계수만.

**비파일럿 완전 불변**: 게이트 밖이면 `writeProductionCell` / `decrementMeetingReservation` /
`batchWriteChannelDailyRows` 를 그대로 탄다.

## 3-old. 초기 검증이 요구한 5가지 (이행 근거 보존)
1. **편집기간 가드**를 DB 쓰기 **앞**에 둔다(`salesRowFor` 실패 = 시트도 DB 도 안 씀). 미러 잡 안에서도.
2. **시트 미러 = 단일 직렬 큐 + 수렴형**. `fireSheetMirror`(스냅샷 재생)를 같은 큐로 흡수하고
   **실행 시점 최신 DB 를 읽어** 시트를 수렴시킨다(todos `runSheetSync` 패턴). 직렬화만으로는 부족 —
   스냅샷 재생이 수렴값을 덮는다.
3. **소유 셀만 쓴다**(E/F 또는 H). E:H 통째 재기입 금지 — 직접생산 E(=유입)·컨택 소유 셀을 깨뜨린다.
4. **H 는 RMW 폐기 → COUNT 재계산**(ADR-0010 의 자체 후속). 삭제 후 (예약일, 채널) 카드수를 다시 세어
   `meetingReservation = cardCount` 로 **절대값 upsert**(멱등·부재키 모호성 없음·lost update 없음).
   ⚠️**함정**: 재집계에 `findMeetingsByDateRecord` 를 쓰면 안 된다 — DB 0건일 때 **시트로 폴백**하는데,
   삭제 경로에선 DB 0 이 진실이고 미러 안 된 시트엔 카드가 남아 있어 H=1 로 되돌린다. 파일럿은
   `readMeetingsFromDb` 직접 사용.
5. **호출자 삼킴 유지 + 재수렴 큐**. throw 는 하되(시트 폴백 금지) 호출자는 기존대로 catch.
   대신 **재계산 자체를 큐에 태워** 백오프 재시도 → 일시 실패가 파일럿 정본에 영구 스테일로 남지 않게.

## 4. 남은 것 (belie 결정)
- **기존 오염 행 리페어**: strip/map 은 jsonb 병합이라 **이미 저장된 스테일 값을 치유하지 못한다**.
  손대지 않은 과거 날짜는 계속 틀린 생산을 보여준다(직접생산 특히). 리페어 = DB 재계산 스크립트가 필요하고
  **파일럿 수강생의 표시 숫자를 바꾸므로**(정확한 값으로) 📥 결정함 등재. 로컬엔 DATABASE_URL 이 없어
  dry-run 도 VPS/belie 필요.

## 5. 후속 티켓 (D 적대 리뷰 CONCERN — 비차단, master 이월 클래스)
- **#1 관찰성**: 정본 쓰기 실패(`syncProduction` `persistProductionCell` throw·`removeMeetingWithCascade` catch)가
  console.warn/무음 — 삼킴 자체는 옳으나(파생 부수효과) flip 후엔 *정본* 실패라 무게↑ → **Sentry 계수 격상** 권고.
- **#2 정합**: 편집기간 가드가 `persistProductionCell`/`persistMeetingReservationCount` 엔 있으나 형제 경로
  `persistSalesRows`(R3-1 컨택 저장)엔 없음 → 편집기간 밖 DB 행이 무필터 집계 부풀림 가능. 도달구간 매우 좁음
  (UI 읽기전용 + 편집유예 70일≈10주창). 형제도 같은 가드로 맞추길 권고.
- (참고·무액션) cascade 자손이 타 (예약일,channel)이면 그 H 미재집계 — master `decrementMeetingReservation`
  동일 선재 갭, 이 PR 신규 회귀 아님(동일행 자손은 절대재계산으로 개선).

## Log
- 2026-07-15 D 적대 리뷰(F 대행, 5렌즈) = **LAND(무-BLOCKER)**. 최고위험 2렌즈(비파일럿 불변·읽기 동반 flip)
  clean PASS. CONCERN 3(트리비얼 미사용 salesCtx)만 접어넣고 land, #1·#2 후속 티켓(§5).
- 2026-07-15 착수(DevF): 구현 전 적대 검증 → 설계 결함 5건 → **2 PR 분할**. PR-1(payload 진실성 +
  직접생산 라이브 버그 수리) 구현·테스트 19·check.sh 초록(620).
