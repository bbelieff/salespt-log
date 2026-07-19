---
slug: lead-chain
status: active
created: 2026-07-14
owner: belie
related: db-write-flip, consultation-log-and-calendar, 10-db-management
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 콜·지·기·소 여정에서 같은 정보(대표자명·업체명·연락처·소개처)를 03→04→02/06 에 반복 기입하지 않도록, 발굴(영업기회)을 미팅·계약으로 **흘려보내는** 설계.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: 03 DB관리(콜·지·기·소) · 04 업체관리(미팅 생성) · 06 업체정보 · 02 계약수납
> - **읽고 나면 알 수 있는 것**: 무엇을 어디로 흘려보내나 / 왜 v1 에 "발굴 링크"를 넣지 않나 / 어떤 PR 로 쪼개고 누가 하나
> - **관련 문서**: `db-write-flip.md`(R3 쓰기전환), `consultation-log-and-calendar.md`(§1-2 06 스냅샷), `docs/plans/completed/10-db-management.md`(§Phase2 에 이 흐름이 미구현 후속으로 등재돼 있었음)

# 발굴 체인 — 영업기회 → 미팅 → 계약 승계

## 0. 결론 (TL;DR)

- **belie 확정 방향**: "한 번 적으면 흘려보낸다."
- **v1 = 프리필(값 복사)** — 완료(#567). **v2 = 발굴 링크** — belie 승인(2026-07-15), §4.
- 🆕 **스펙 확장(belie 2026-07-15)**: 발굴은 **미매칭이면 이월**된다(만료 없음, 매칭 즉시 제외).
  → **"매칭됨"을 알아야 이월 판정이 되므로 발굴↔미팅 링크가 v1 에 필수로 들어온다** — v1+링크를 **한 몸**으로 짓는다(§4-1).
- **시트 컬럼 신설 0** 은 v1·v2 **양쪽 원칙**(belie 확정). 소개처 정형 컬럼 승격은 **기각** — 커스텀 자유 메모 유지.
- 🔴 **적대 검증이 설계 blocker 3건 확증** → §4 재작성 + **PR-0(읽기 경로 교정) 선행 필수**(R12~R14).
- 근거: belie 의 목적("반복 기입 제거")은 **미팅 생성 시점 프리필만으로 100% 충족**된다. 안정 id·링크 저장은 목적이 아니라 **§5 전환추적(통계)** 을 위한 것이고, 그것을 위해 시트 3탭 스키마 변경 + 배포 블로커 4개를 감수해야 한다(§4).
- **소개처는 이미 뚫려 있는 배관으로 흘려보낸다** — `CompanyInfo.커스텀` → 04 AN → 06 Y → TXT 전 구간 연결 확인(§3-2). 신규 컬럼이 필요 없다.
- 02/06 승계는 **기존 경로가 그대로 흘려보낸다** — `addFromContract` 가 이미 04 업체정보를 06 에 통째 복사한다. v1 은 **02·06 코드를 건드리지 않는다**.

> ⚠️ 이 문서의 모든 코드 주장은 **master `d5c1592` 실측**이다. 설계 중 참조한 일부 사전조사는 master 이동으로 stale 이었다(§7 부록).

---

## 1. 현행 구조 (실측)

### 1-1. 발굴(lead) 은 03 콜·지·기·소 섹션에만 있다
- 좌표 `X:AD` (`lib/config/index.ts` `SHEET_RANGES.dbManagement.sections."콜·지·기·소"`). **03 의 마지막 섹션** — AE 이후는 비어 있다.
- 타입 `DBLead` (`lib/types/index.ts:194-204`): **구분**(콜드콜/지인/기고객/소개)·**접수일**·**대표자명**·**업체명**·**소개처**·**연락처**·**조건**
- CRUD: `appendLead`/`updateLead`/`clearLead` (`lib/repo/db.ts`), 서비스 `addLead`/`patchLead`/`removeLead` (`lib/service/db.ts`)
- 행 인정 = `isLeadMeaningful` (대표자명 OR 업체명 OR 연락처 중 하나)
- 생산(E) 집계 = **접수일 기준 행 수**(ADR-0020). 비용 없음 — "정보만".
- R3-4 로 03 은 **dual-sync**(`persistDbRow`/`clearDbRow`, `lib/repo/db/db-tab-sync.ts`). append 는 행번호를 시트가 할당하므로 async 미러 유지(4개 append 전부 `_cleared:false` 병합 — 재추가 부활 보장).

### 1-2. 04 미팅 생성 시 사용자가 손으로 적는 것
`buildMeetingFromSlot` (`app/(app)/contact/page.tsx`): **미팅날짜·미팅시간·업체명·장소·예약비고·업체정보**. (channel 은 슬롯 고정, id/예약일/예약시각/상태는 자동)
→ **발굴에서 오는 값이 하나도 자동으로 안 채워진다.** 이게 이 문서가 없애려는 반복 기입.

### 1-3. 04 업체정보(CompanyInfo) 의 실제 필드
`COMPANY_FIELDS` 20 (T~AM) + `커스텀` JSON (AN, `COMPANY_CUSTOM_COL=39`) + `COMPANY_FIELDS_EXT` 3 (AQ~AS). **AO~AP=이월깃발, AT=gcal 이벤트id** 로 막혀 있어 신규 정형 컬럼은 AU 이후만 가능.
- **`대표자이름`** 은 있다 (lead 는 `대표자명` — 키 이름만 다름).
- **`연락처통신사`** 는 있다 — 에디터 라벨이 "연락처/통신사", placeholder `010-0000-0000(통신사)` → **전화번호를 담도록 이미 설계된 필드**.
- **`소개처` 는 없다.** (`소개처` 는 `DBLead` 에만 존재 — `lib/types/index.ts:200`)

### 1-4. 계약 전환 승계는 이미 동작한다
`addFromContract` (`lib/service/contract-payment.ts`): 04 미팅 lookup → 02 에 계약일·업체명·수임비 + AK=meetingId → **06 스냅샷 = 미팅의 `업체정보` 통째 복사**(`upsertCompanyInfoArchive`, 자연키 `계약ref = {계약일}|{업체명}`).
→ **04 에 실린 값은 계약 시 06 으로 자동으로 흘러간다.** v1 이 04 만 채우면 02/06 은 공짜다.

### 1-5. 발굴↔미팅 연결은 **전무**
공유 키·외래 참조·prefill 코드 0건. (`docs/plans/completed/10-db-management.md` 에 "영업기회 → 미팅 등록 흐름"이 미구현 Phase-2 후속으로 등재돼 있었음)

---

## 2. v1 설계 — 프리필 (권장·이번 구현 범위)

### 2-1. ① 미팅 생성 시 "발굴에서 가져오기" 피커
- **위치**: 컨택탭 미팅 슬롯 입력부. 채널이 **콜·지·기·소** 일 때만 노출(다른 채널은 발굴 개념이 없음).
- **동작**: [발굴에서 가져오기] → 최근 발굴 목록(03 콜·지·기·소, **접수일 내림차순**, 기본 20건 + 검색) → 선택 → 폼 프리필 → 사용자가 확인·수정 후 저장.
- **직접 입력 폴백 유지** — 피커는 **선택 사항**이다. 안 쓰면 지금과 100% 동일.
- **목록 소스**: 기존 `readLeads` 재사용(파일럿은 DB read, 비파일럿은 시트 — 기존 게이트 그대로). 신규 시트 I/O 0.
- **표시**: `업체명 · 대표자명 · 접수일 · [구분]` 한 줄. 업체명이 비면 대표자명으로 대체(= `isLeadMeaningful` 규칙과 일치).

### 2-2. ③ 필드 매핑 (확정)

| DBLead (03) | 귀착지 | 근거 |
|---|---|---|
| **업체명** | `Meeting.업체명` (04 G) | 동일 개념 |
| **대표자명** | `CompanyInfo.대표자이름` (04 AF) | **키 이명 매핑**. 스키마 rename 금지(§6 R3) |
| **연락처** | `CompanyInfo.연락처통신사` (04 AG) | 이미 전화번호용 필드(에디터 placeholder `010-…`). 신규 컬럼 0 |
| **소개처** | `CompanyInfo.커스텀.업체["소개처"]` (04 AN JSON) | **유일하게 정형 귀착지가 없다.** 커스텀 배관이 04 AN → 06 Y → TXT 로 **이미 전 구간 연결**(§3-2) |
| **조건** | `Meeting.예약비고` (04 I) 프리필 | `계약조건`(P)은 계약 시점 조건이고 Q 수식에 물림 → 의미 오염 금지 |
| **구분** | 예약비고 머리말 `[지인]` 텍스트 | `Meeting.channel` 이 이미 "콜·지·기·소" 고정. 세부 구분이 미팅 화면 행동을 바꾸지 않음 |
| **접수일** | **미승계**(03 보존) | lead 라이프사이클 메타. 미팅엔 예약일(B)이 이미 있음 |

### 2-3. 프리필 의미론 (못박는 규칙)
1. **미팅 생성 시점 1회 복사(스냅샷)**. 이후 03 lead 수정이 04/06 을 **덮지 않는다**. 정본은 하류(04 CompanyInfo). — 역동기화는 사용자가 04 에서 다듬은 값을 03 옛값으로 되돌리는 사고를 낳는다(§6 R5).
2. **빈 필드에만 채운다(non-destructive merge)**. 사용자가 이미 적은 값은 절대 덮지 않는다(CLAUDE.md §2.5 정신).
3. **매퍼는 순수 함수**로 격리 — `lib/service/lead-prefill.ts` (신규): `leadToMeetingDraft(lead) → Partial<Meeting>`. 테스트 대상.

### 2-4. ④ 계약 전환 승계 + 06 초안 — **추가 코드 0**
`addFromContract` 가 이미 04 `업체정보` 를 통째로 06 에 복사한다(§1-4). 따라서 v1 이 04 CompanyInfo 를 프리필로 채우면:
```
03 발굴 ──프리필──▶ 04 업체정보(대표자이름·연락처통신사·커스텀.소개처)
                      └─계약 액션(기존)─▶ 06 업체정보 스냅샷 ─▶ payment 카드 · TXT 내보내기
```
**02·06 코드는 건드리지 않는다.** "06 업체정보 초안 자동 생성"은 이 경로의 자연스러운 결과다.

---

## 3. 왜 이렇게 정했나 (핵심 근거 2개)

### 3-1. 링크(발굴id)를 v1 에서 뺀 이유 (→ v2 로 분리, belie 승인 후 §4 에서 해결)
belie 의 목적은 **반복 기입 제거** = 값 복사. "이 미팅이 **어느** 발굴에서 왔는가"(계보)는 목적이 아니라 **전환추적 통계**(§5)를 위한 것이다. 링크를 v1 에 섞으면 다음이 전부 따라와 프리필 출시가 지연된다:
- 발굴의 **안정 id 가 없다** — DB row_key 가 `콜지기소:r{행번호}`(행 좌표). `clearLead` 는 행을 비우기만 하고 `appendLead` 는 그 빈 행을 재사용하므로, **같은 키가 다른 lead 를 가리킨다**(키 재사용 오염 — #559 에서 고친 `_cleared` 재사용과 동형). → 03 에 id 컬럼(AE) 신설 + 백필 + 지연부여 + 대조 스크립트가 딸려온다.
- **리스케줄·추가미팅은 새 미팅 UUID 로 새 행을 만든다**(`previousMeetingId` 체이닝). 링크를 미팅 UUID 에 걸면 **한 번만 일정 변경해도 계보가 끊긴다** → 전환추적이 과소집계.
- 비파일럿 기수(DB 없음)·로컬·CI 에서 링크가 통째로 죽는다.

→ **v1 에서 빼면 이 문제들이 전부 증발한다** — 프리필을 먼저 출시(#567).
→ **v2(§4) 는 이 3개를 정면으로 푼다**: 안정 id = DB payload 전용 `발굴id`(시트 컬럼 0, §4-1) · 리스케줄 = `previousMeetingId` 상속(§4-3) · 비파일럿 = 미러가 코호트 무관이라 DB 에 쌓임(§4-0, 화면만 파일럿 게이트).

### 3-2. 소개처를 정형 컬럼(04 AU) 대신 커스텀 JSON 에 넣는 이유
커스텀 배관이 **이미 전 구간 연결돼 있음을 코드로 확인**:
`meetings-rows.ts:94 COMPANY_CUSTOM_COL=39(AN)` → `meetings-rows.ts:117-120`(읽기)·`:156-159`(쓰기) → `company-info-archive.ts` 가 Y 로 기록 → `company-info-txt.ts` 가 렌더 → `CompanyInfoEditor` 가 UI 표시.
정형 컬럼(04 AU)을 만들면 **배포 블로커 3개**가 붙는다:
- **04 읽기 range 확장 = 라이브 사이트 다운 위험.** `SHEET_RANGES.meetings.range` 를 **3개 reader 가 공유**(`meetings.ts:224`·`:265`, `gcal-schedule-read.ts:20`). 45/46열 라이브 시트에서 AU(47열) 읽기는 `400 exceeds grid limits` — #522 에서 **실제로 터진 사고**(gcal AT 도입 때).
- **`clearMeeting` 이 AU 를 안 지운다** → `findFirstEmptyRow` 가 재사용한 행에 **삭제된 미팅의 소개처가 상속**된다(현재 `ensureGridColumns(…,45)` 로 AQ~AS 까지만 클리어).
- **06 도 A:AB→A:AC + `SHEET_RANGES.companyInfoArchive.headerRow` 동반 변경** 필요 — config 를 빠뜨리면 `values.update(A1:AB1, 29열)` → 400 → **계약 전환 전체가 죽는다**.

→ v1 은 커스텀으로 간다. **정형 컬럼 승격은 "정렬·필터·운영자 export 가 실제로 필요하다"가 증명된 뒤 별도 PR**(§5).

---

## 4. v2 — 발굴 링크 · 전환추적 (belie 승인 2026-07-15, 착수)

> **belie 확정 제약**: v2 착수 **승인**. 단 **소개처 정형 컬럼 승격은 기각**(커스텀 자유 메모 유지)이고
> **"시트 컬럼 신설 0" 원칙은 v2 에도 유지**한다.
>
> ⚠️ 이 제약이 **구설계(03 AE 컬럼에 발굴id)를 폐기**시켰다. 아래는 그 대체 설계다.

### 4-0. 핵심 통찰 — 시트를 안 건드리고도 안정 id 를 만들 수 있다

세 가지 실측이 이걸 가능하게 한다:
1. **`mirrorSheetRow` 는 코호트 게이트가 아니다** — `dbEnabled()` 만 본다(`lib/repo/db/mirror.ts:35`). 프로덕션은 `DATABASE_URL` 이 주입되므로 **비파일럿 기수도 sheet_rows 에 03 lead 가 쌓인다**. 링크가 죽는 건 로컬·CI(DB 없음)뿐.
2. **03 은 R3-4 로 dual-sync** — `updateLead`/`clearLead` 는 `persistDbRow`/`clearDbRow`(동기+재시도). append 만 async 미러.
3. **DB upsert 는 jsonb 얕은 병합**(`payload || excluded`, `client.ts:88-92`)이고 `upsertSheetRow` 가 `JSON.stringify(payload)` 를 쓴다 → **payload 에 없는 키(undefined 포함)는 기존 값이 보존된다.**

→ **발굴id 를 DB payload 에만 둔다. 시트 컬럼 0.**

### 4-1. 🆕 스펙 확장 — 발굴은 **미매칭이면 이월된다** (belie 2026-07-15)

> 요구 원문: "컨택관리에서 콜지기소 미팅예약 시 발굴된 건(업체명·대표자명 등)을 불러와 매칭 /
> **매칭 안 된 건은 다음날·다다음날에도 후보로 남아 언젠가는 매칭 가능**"

- **후보 = 미매칭 발굴 전부. 만료 없음** — 접수일이 지나도 계속 후보로 남는다(날짜 컷오프 **없음**).
- **매칭 즉시 후보에서 제외.**
- ⚠️ **이 요구가 v1/v2 경계를 지웠다**: "매칭됨"을 알아야 이월 판정이 되고, 그러려면 **발굴↔미팅 링크가 v1 에 필수**로 들어온다(원래 v2 전환추적 스코프). belie 가 v2 를 승인했으므로 **v1+링크를 한 몸으로** 짓는다.
- **`matched` 는 저장하지 않고 파생한다** — 미팅 쪽 `발굴id` 를 스캔해 계산.
  역방향(03 에 "전환됨" 마킹)은 **금지**: `콜지기소:r{N}` 행 재사용 시 그 마킹이 **새 lead 로 이월**돼 새 발굴이 **피커에서 조용히 사라진다**(R10 동형). 정방향 링크는 행이 재사용돼도 새 lead 가 **새 id** 를 받으므로 자연히 미매칭 = 안전.

**`matched` 판정 (단일 규칙 — 파일럿/비파일럿 공통)**
```
matched(lead) = lead.발굴id  ? 미팅들의_발굴id_집합.has(lead.발굴id)      // 링크 (정확)
                             : 미팅들의_정규화업체명_집합.has(norm(lead.업체명))  // 폴백 (근사)
```
- 폴백은 **id 가 없는 lead**(백필·legacy·비파일럿 시트 읽기)에만 걸린다 → 시간이 지나면 링크 기준으로 수렴.
- 폴백 한계(문서화 의무): 동명 업체 **오탐**(후보가 사라짐) · 미팅에서 업체명 수정 시 **미탐**(후보 재등장) · 업체명 없는 lead(대표자명만) 는 폴백 불가 → 영구 후보.
- **손으로 친 미팅은 lead 를 소비하지 않는다**(링크가 없으므로). 스펙상 "매칭"은 피커로 고른 것 — 그 lead 는 계속 후보로 남는다(만료 없음이므로 무해).

### 4-2. 🔴 선행 필수 — **B1: 백필 열문자 폼 shadowing** (라이브 버그 동시 해소)

**적대 검증(blocker)**: `read-db-tab.ts` 의 `readDbTabFromDb` 는 payload 에 열문자 키(`X`)가 있으면 **무조건 열문자 폼을 우선**해 `parseLeadRow`(7필드 배열)로 읽는다. `backfill-sheet-rows.mjs` 는 03 을 **열문자 키로만** 적재하므로 **파일럿의 기존 lead 는 100% 열문자 폼**이다.
→ payload 에 `발굴id` 를 넣어도 **읽기에서 통째로 버려진다**(parseLeadRow 가 7필드만 생성).
→ 지연 부여가 **매 수정마다 새 uuid 를 재발급**(무한 remint), 피커는 기존 lead 를 **영영 링크 불가**.

**덤 — 이미 존재하는 라이브 버그**: 같은 분기 때문에 **백필된 03 행을 앱에서 수정해도 파일럿 화면은 옛 값을 계속 표시**한다(필드명 키를 써도 열문자가 이긴다). 코드도 인지하고 있다 — `db-tab-sync.ts:10` "백필 컬럼폼 shadowing → R3-4b 후속".

**→ PR-0(단독 선행)**: `read-db-tab` 의 폼 우선순위를 **필드명 우선**(또는 `contractFromDbPayload` 식 *열문자 base + 필드명 overlay*)으로 교정 + 혼합 payload 회귀 테스트. 이 PR 이 **03 편집 stale 라이브 버그도 같이 닫는다.**
※ 4섹션 공통 변경이므로 직접생산 neo 배열 밀림 회피 규칙(필드명은 Zod, 열문자만 파서 재실행)을 유지할 것.

### 4-3. 발굴 안정 id (`발굴id`)

| 경로 | payload 의 `발굴id` | 근거 |
|---|---|---|
| `appendLead` | **항상 새 uuid 명시** | 재사용 행에 남은 옛 id 를 덮는다(R10) |
| `updateLead` | **서버가 읽어온 기존 id 를 명시**(없으면 그때 mint) | ↓ B2 |
| `clearLead` | `{_cleared:true, 발굴id:""}` — **id 를 명시 무효화** | ↓ B3 |

- **타입**: `DBLead.발굴id`·`Meeting.발굴id` = **`z.string().optional()`** — **`.default("")` 절대 금지**(R11: default 를 주면 `{...l}` payload 에 빈 문자열이 실려 **매 수정마다 링크를 지운다**).
- **생성**: 서비스(`addLead`)에서 `crypto.randomUUID()`. **라우트는 클라이언트발 id 를 strip**(링크 탈취 방지).

**🔴 B2 — `patchLead` 가 기존 id 를 알 방법이 없다** (적대 검증 blocker)
`patchLead` 가 받는 건 **클라이언트 바디**이고, 03 탭용 **단건 DB payload read 가 레포에 아예 없다**. 라우트가 id 를 strip 하면 서버는 그 행에 id 가 이미 있는지 모른다 → "생략=보존"과 "없으면 mint"가 **동시 성립 불가**(전자면 기존 lead 영구 링크불가, 후자면 매 수정마다 링크 파괴).
**→ PR-5 에 `readDbRow(spreadsheetId, 'db', '콜지기소:r{N}')` 단건 payload read 를 신설**하고, `patchLead` 가 그것으로 **기존 id 를 읽어 명시 전달**(없으면 mint). "생략=보존"에 의존하지 않는다.

**🔴 B3 — `appendLead` 의 DB 쓰기만 fire-and-forget(무재시도)** (적대 검증)
R10 의 "최악은 dangling" 증명은 **append 의 id 쓰기가 도달함**을 전제한다. 그런데 append 만 `mirrorSheetRow`(await 없음·재시도 0)다. 미러가 유실되면 DB 엔 `{죽은 uuid, _cleared:true}` 가 남고, 뒤이은 `updateLead`(동기+재시도)가 그 행을 `_cleared:false` 로 되살리면서 **새 lead 가 죽은 lead 의 신원을 상속** → 미팅이 **살아있는 엉뚱한 발굴**을 가리킨다.
**→ `clearLead` 가 `발굴id: ""` 를 명시 무효화**한다. 그러면 append 미러가 유실돼도 최악이 **dangling(안전 실패)**.
> ⚠️ `null` 로 무효화 금지 — `z.string().optional()` 은 `null` 을 거부해 `safeParse` 실패 → **그 행이 03 화면에서 통째로 사라진다.** 반드시 **빈 문자열**.

### 4-4. 🔴 R10 — 키 재사용 신원 상속 (#559 와 동형)

`clearLead` 는 행을 비우고(`{_cleared:true}` 병합 — **옛 payload 키 전부 잔존**), `appendLead` 는 그 빈 행을 재사용한다(`콜지기소:r{N}`).
→ append 가 `발굴id` 를 명시하지 않으면 죽은 lead 의 id 가 살아남아 **새 lead 가 그 신원을 상속** → 옛 미팅이 **엉뚱한 발굴**을 가리킨다 = 조용한 오귀속.
**규칙**: append=새 id 명시 + clear=id 무효화(B3). 그러면 최악이 **dangling**("출처 미상")이지 **절대 다른 lead 를 가리키지 않는다** = 안전 실패. **회귀 테스트 의무.**

### 4-5. 링크 저장 (미팅 → 발굴)

- **시트 컬럼 없음** — `meetingToRow` 는 명시 컬럼 인덱스만 쓰므로 `발굴id` 는 시트에 안 써진다(의도). 04 읽기 range 무변경 → **grid-400 위험 0**.
- **쓰기**: 파일럿은 `createMeetingRecord` → `writeRowToDb({payload: m})` 에 자연히 실린다. 비파일럿은 `appendMeeting` + `mirrorSheetRow`(코호트 무관) → DB 에 쌓인다.
- **리스케줄·추가미팅**: 새 UUID 로 **새 행**을 만든다(`previousMeetingId` 체이닝) → 계보가 끊긴다 → 생성 시 **`previousMeetingId` 의 `발굴id` 를 상속**(필수). 안 하면 일정 변경 한 번에 lead 가 **후보로 부활**한다(이월 스펙 위반).

### 4-6. 읽기·게이트

- lead 목록은 **기존 `readLeads` 게이트 그대로**(파일럿=DB, 비파일럿=시트). 시트가 정본이므로 미러 유실로 lead 가 피커에서 사라지는 일이 없다.
- `matched` 계산에 필요한 미팅 집합도 **기존 게이트**(파일럿=DB, 비파일럿=시트).
- **로컬·CI(DATABASE_URL 없음)**: 링크 no-op → 전 lead 가 `발굴id` 없음 → **폴백(업체명)만으로 동작**. 피커는 그대로 쓸 수 있다.

### 4-7. 롤백

시트 스키마 무변경 → **revert 로 완전 복구**. 되돌려도 DB payload 의 `발굴id` 는 남지만 아무도 안 읽으므로 무해(구설계의 "endCol 되돌리면 죽은 uuid 상속" 위험이 **구조적으로 소멸**).

---

## 5. 부수효과 — 발굴→미팅 전환 추적 (④)

- **v1 에서 이미 가능한 것(거친 퍼널)**: 발굴 수(03 접수일 기준 = 생산 E, ADR-0020) vs 콜·지·기·소 채널 미팅 수 → **채널 단위 전환율**은 링크 없이도 집계된다.
- **v2 가 열어주는 것**: *어느* 발굴이 *어느* 미팅·계약이 됐는지(건별 계보) → 발굴 품질(구분별·소개처별 전환율), 미전환 발굴 리마인드. **파일럿 한정**(§4-4) — R3 완료 시 전 기수 자동 확대.
- 아레나 이월 미팅은 `carryover` 가 A~AN 만 복사하므로 계보가 없다 → 전환추적 분모에서 **제외**하거나 "출처 미상"으로 표기.

---

## 6. 위험 (구현 시 반드시 반영)

| # | 위험 | 대응 |
|---|---|---|
| R1 | **`COMPANY_FIELDS_EXT`(AQ~AS) 에 4번째 필드 append 금지** — 쓰기는 `slice(START, START+3)`·`AQ:AS` 하드코딩이라 4번째가 **조용히 안 써지고**, 읽기는 AT(gcal JSON)를 업체정보로 오독 | v1 은 정형 필드를 안 늘린다(커스텀 사용) |
| R2 | 04 읽기 range 확장 시 **45/46열 라이브 시트 400** (reader 3곳 공유) | v1 은 range 무변경. v2/정형승격 시 grid-400 fallback 필수 |
| R3 | `CompanyInfo.대표자이름` → `대표자명` **rename 금지** — jsonb 얕은병합상 옛 키가 영구 잔존하고 신규 키는 빈값(계약 고객 데이터 사장) | 매퍼에서 **이름만 바꿔 매핑**(스키마 불변) |
| R4 | 프리필이 **사용자 입력값을 덮음** | 빈 필드에만(§2-3.2). 재프리필 경로도 동일 |
| R5 | **역동기화**(03 수정 → 04/06 갱신) 확장 유혹 | 금지. 프리필 = 생성 시점 1회 스냅샷(§2-3.1) |
| R6 | 커스텀 JSON 은 사용자가 에디터에서 **✕ 로 삭제 가능**하고 손상 시 catch 무시 | 소개처는 "편의 정보"라 수용. 정형 승격이 필요해지면 §5 |
| **R7** | **발굴 교체 시 교차 혼합 레코드** — `mergeLeadDraft` 는 "빈 칸 채움"이라 프리필 유래 값과 사용자 타이핑 값을 **구분하지 못한다**. 발굴 A 프리필 후 B 를 고르면 A 값이 "사용자 값"으로 보존돼 A+B 혼합이 저장된다 | **PR-3 의무**: 교체 시 프리필 **직전 원본 스냅샷**에 merge 하거나 `leadToMeetingDraft(B)` 로 **대체**. 매퍼 docstring + 테스트로 고정됨 |
| **R8** | **`CompanyInfoEditor` 는 mount 시 `value` 로 1회 초기화**하고 이후 prop 을 동기화하지 않는다 → 마운트 후 업체정보를 주입하면 **안 그려지고, 다음 타이핑이 프리필 값을 덮는다** | **PR-3 의무**: 주입 후 `key` 를 바꿔 **리마운트**(레포 선례: `CompanyInfoContractSection` remount-key) |
| **R12** | 🔴 **백필 열문자 폼 shadowing**(B1) — `read-db-tab` 이 열문자 폼을 무조건 우선해 `parseLeadRow`(7필드)로 읽는다. 백필된 03 행(=파일럿의 기존 lead 전부)은 payload 에 `발굴id` 를 넣어도 **읽기에서 버려진다** → 무한 remint·링크 불가. **덤: 백필 lead 편집이 화면에 미반영 = 이미 라이브 버그** | **PR-0(선행 필수)** — 필드명 우선/overlay 로 교정 + 혼합 payload 회귀 테스트(§4-2) |
| **R13** | 🔴 **`patchLead` 가 기존 `발굴id` 를 모른다**(B2) — 03 탭용 단건 DB payload read 가 레포에 **없다**. 라우트가 id 를 strip 하면 "생략=보존"과 "없으면 mint"가 **동시 성립 불가** | **PR-5**: 03 단건 payload read 신설 → `patchLead` 가 기존 id 를 **읽어서 명시 전달**(mint 는 부재 시에만) |
| **R14** | 🔴 **append 의 DB 쓰기만 fire-and-forget**(B3) — 미러 유실 시 죽은 uuid 가 잔존하고, 뒤이은 `updateLead`(동기)가 `_cleared:false` 로 되살려 **새 lead 가 죽은 신원을 상속** → 미팅이 살아있는 **엉뚱한 발굴**을 가리킨다 | **`clearLead` 가 `발굴id:""` 를 명시 무효화**(§4-3 B3). ⚠️ `null` 금지 — zod optional 이 거부해 그 행이 03 화면에서 **사라진다** |
| **R10** | 🔴 **키 재사용 신원 상속** — `clearLead`→`appendLead` 행 재사용 시 얕은 병합이 죽은 lead 의 `발굴id` 를 남겨 **새 lead 가 그 신원을 상속** → 옛 미팅이 **엉뚱한 발굴을 가리킨다**(#559 stale 커스텀과 동형) | `appendLead` 가 `발굴id` 를 **항상 새 값으로 명시**(§4-2). 최악이 dangling=출처 미상(안전 실패). **회귀 테스트 의무** |
| **R11** | **`발굴id` 에 `.default("")` 를 주면 링크가 매 수정마다 지워진다** — `updateLead`/`updateMeeting` payload 에 빈 문자열이 실려 병합에서 기존 id 를 덮음 | `DBLead.발굴id`·`Meeting.발굴id` 는 **`.optional()`**(default 금지). `JSON.stringify` 가 undefined 키를 탈락시켜 보존이 성립(§4-0) |
| **R9** | 03 `조건` 은 무제한 자유텍스트인데 `Meeting.예약비고` 는 `max(500)` → 프리필 값이 저장 시 zod 400 | 매퍼가 **500 클램프**(하류 스키마 위반값을 애초에 안 내보냄). 고정 테스트 보유 |

---

## 7. PR 분할 + 트랙 배분 (제안 — Cowork 확정)

| PR | 범위 | 구역 | 트랙 제안 |
|---|---|---|---|
| **PR-1** | `lib/service/lead-prefill.ts`(신규) — `leadToMeetingDraft(lead) → Partial<Meeting>` 순수 매퍼 + 단위테스트(매핑표 §2-2 고정, 비파괴 merge, 커스텀.소개처) | `lib/service/` | **DevB** (CompanyInfo·06 주인) |
| **PR-2** | 발굴 목록 조회 서비스/API — 기존 `readLeads` 재사용, 접수일 내림차순 + 검색. 시트 I/O 신규 0 | `lib/service/db.ts`·`app/api/db` | **DevB** 또는 03 소유 트랙 |
| **PR-3** | 컨택탭 **발굴 피커 UI** — 채널=콜·지·기·소 슬롯에 [발굴에서 가져오기], 선택 시 프리필, 직접입력 폴백 유지 | `app/(app)/contact/**` + `components/` | **UI 트랙**(컨택탭 소유) |

| **PR-0** 🔴 | **선행 필수** — `read-db-tab` 백필 열문자 폼 shadowing 교정(필드명 우선/overlay) + 혼합 payload 회귀 테스트. **03 편집 stale 라이브 버그 동시 해소**(§4-2) | `lib/repo/db/read-db-tab.ts` | **DevB** — 이게 없으면 발굴id 가 **읽히지 않아** PR-5·6 이 무의미 |
| **PR-4** | 공용 계약 — `DBLead.발굴id`·`Meeting.발굴id` **optional 추가**(default 금지, R11) + SSOT(`data-model.md`) 등재 | `lib/types` (**공용부**) | **DevB** — §3.5 상 **단독 선행 PR** |
| **PR-5** | 발굴 id 부여·보존 — `addLead` uuid 생성 · `appendLead` **항상 명시**(R10) · **`clearLead` 가 `발굴id:""` 무효화**(B3) · **03 단건 payload read 신설 → `patchLead` 가 기존 id 를 읽어 명시**(B2) · 라우트 id strip · **회귀 테스트(행 재사용 신원 상속 재현)** | `lib/repo/db.ts` · `lib/repo/db/*` · `lib/service/db.ts` · `app/api/db` | **DevB** (03 소유 트랙과 조율) |
| **PR-6** | 링크 배선 + **matched 파생** — 미팅 생성 시 `발굴id` 기록 · **`previousMeetingId` 상속**(리스케줄) · `listLeadCandidates` (matched 계산·미매칭 이월) | `lib/service/contact.ts` · `meetings-write.ts` · `lib/service/db.ts` | **DevB** |

- **의존**: **PR-0 → PR-4 → PR-5 → PR-6**(읽기 교정 → 공용 계약 → id → 링크). PR-1(완료) → PR-3.
  **PR-2·PR-3 는 PR-6 의 계약(아래)에 의존** — PR-6 머지 후 착수하거나, 계약만 먼저 합의하고 병렬.

### 7-1. 🔒 PR-2(C)·PR-3(F) 가 소비할 계약 (못박음)

```ts
// lib/service/db.ts (PR-6)
export interface LeadCandidate extends DBLead {
  발굴id?: string;   // 링크 키. 없으면 legacy/백필/비파일럿 → matched 는 업체명 폴백으로 판정
  matched: boolean;  // true = 이미 미팅으로 전환됨 → 피커에서 제외
}
/** 콜·지·기·소 발굴 후보. **만료 없음** — 미매칭이면 접수일이 지나도 계속 후보. 접수일 내림차순. */
export function listLeadCandidates(email: string): Promise<LeadCandidate[]>;
```
- **PR-3(피커) 는 `!matched` 만 노출**한다(이월 = 미매칭이 계속 남는 것 = 필터의 자연 결과. 별도 만료 로직 **없음**).
- 프리필은 **PR-1 의 매퍼 계약** 그대로: `mergeLeadDraft(current, lead)` + §6 R7(발굴 교체 시 원본 스냅샷 merge 또는 `leadToMeetingDraft` 대체) · R8(`CompanyInfoEditor` 리마운트).
- **미팅 저장 시 `발굴id` 를 함께 보낸다** — 그래야 PR-6 이 링크를 기록하고 그 lead 가 후보에서 빠진다.
- **공용부 계약 변경 0** — `lib/types`·`lib/config`·SSOT 4문서 **무변경**(커스텀 키는 스키마 밖 자유 키). → §3.5 선행 단독 PR 불요.
- **롤백**: 각 PR revert 1건. 시트 스키마를 안 건드리므로 revert 가 안전하다(v2 와의 결정적 차이).

---

## 8. ✅ belie 결정 (2026-07-15 확정 — 미결 없음)

| 안건 | 결정 | 반영 |
|---|---|---|
| **v2(전환추적 링크) 착수** | ✅ **승인** | §4 재작성 → PR-4·5·6 |
| **소개처 정형 컬럼 승격** | ❌ **기각** — 자유 메모 유지 | `CompanyInfo.커스텀` 확정(§2-2). 04 AU/06 AC 안 폐기 |
| **시트 컬럼 신설 0** | ✅ **v2 에도 유지** | 구설계(03 AE=발굴id) **폐기** → DB payload 전용 id(§4-0~4-1) |

---

## Log
- 2026-07-15 **PR-4 구현(DevB)** — 공용 계약. `DBLead.발굴id`·`Meeting.발굴id` = `z.string().optional()`
  추가(**default 금지 R11** — 주석에 근거 못박음: default("") 면 update payload 에 빈 문자열이 실려 링크 소멸).
  DB payload 전용(시트 컬럼 0). SSOT data-model.md 두 항목 갱신. 계약 테스트 5건: optional·no-default,
  DB 왕복 시 발굴id 생존(meetingFromDbPayload 가 strip 안 함), meetingToRow 시트 미기록(04 range 무변경).
  PR-5(id 부여·R13/R14 수리)·PR-6(링크·matched) + C/F 피커가 이 계약 위에 빌드.
- 2026-07-15 **PR-0 구현(DevB)** — R12(백필 열문자 폼 shadowing) 해소. `read-db-tab` 의 파싱을
  "열문자 폼 무조건 우선" → **열문자 base + 필드명 overlay**(= `contractFromDbPayload` 와 같은 규칙)로 교체.
  배열 파서(`parseXRow`)는 **열문자에만** 재실행해 직접생산 neo 밀림 회피 규칙을 유지.
  효과 ①앱이 쓴 필드명이 항상 이긴다 → **백필 03 행 편집이 파일럿 화면에 반영**(이미 라이브였던 stale 버그 종결)
  ②필드명 전용 키(`발굴id`)가 **열문자 base 를 뚫고 overlay 경로를 탄다** = 링크의 **필요조건**.
  ⚠️ 실제 생존은 아님 — `merged()` 가 Zod `safeParse` 로 끝나고 `z.object` 는 미지 키를 **strip** 한다.
  `발굴id` 가 진짜 살아남는 건 **PR-4 에서 `DBLead.발굴id` 를 스키마에 추가하는 순간**(그때 진짜 assert 를 넣는다).
  4섹션 공통 적용.
  🔴 **적대 검증이 자체 blocker 1건 확증(선제 수리)**: overlay 도입으로 열문자 base 가 처음으로 Zod 를 타게 되는데,
  백필 raw 값은 refinement 를 자주 깬다(기간예산은 부가세 제외 `=금액/1.1` → `2999999.9999999995`; 종료일 빈
  "생산중" 행은 legacy 분기가 생산개수←기간예산으로 매핑 → `int` 위반). 그러면 `safeParse` 실패로 **그 행이 03 화면과
  대시보드 총비용·영업이익에서 조용히 사라진다**(시트 모드에선 보임 = 분기). 예전 열문자 분기는 Zod 를 **거치지 않고**
  그대로 렌더했으므로 이는 **렌더 보증을 뺏는 회귀**였다. → Zod 는 **overlay 검증용**으로만 쓰고, 실패 시 base+overlay 를
  그대로 렌더 + warn(관찰 가능). 회귀 테스트로 고정.
  회귀 테스트 7건(혼합 payload 우선순위·**Zod 위반 백필 행 렌더 유지**·순수 폼 2종 불변·합계행 skip·내부키 누출 방지).
- 2026-07-15 **스펙 확장(이월) 흡수 + 적대 검증 blocker 3건 반영 → §4 재작성**(DevB).
  ① **belie 스펙 확장**: 발굴은 미매칭이면 **이월**(만료 없음)·매칭 즉시 제외. "매칭됨" 판정에 링크가 필요하므로
  **v1+링크를 한 몸으로** 재설계. `matched` 는 **저장하지 않고 파생**(미팅→발굴 정방향 링크 스캔) — 03 에 역기록하면
  행 재사용 시 마킹이 새 lead 로 이월돼 **새 발굴이 피커에서 조용히 사라진다**(R10 동형). 폴백=업체명 정규화(id 없는 lead 한정).
  ② **적대 검증(2렌즈·10에이전트) blocker 3건 확증** — 내 설계의 실제 구멍:
  **R12** `read-db-tab` 이 백필 열문자 폼을 무조건 우선 → 파일럿의 **기존 lead 전부**에서 `발굴id` 가 읽기에서 버려짐
  (무한 remint·링크 불가). **덤: 백필 03 행 편집이 화면에 미반영 = 이미 라이브 버그**(코드도 인지: `db-tab-sync.ts:10`)
  → **PR-0 선행 필수**(라이브 버그 동시 해소).
  **R13** `patchLead` 가 기존 id 를 읽을 **단건 DB read 가 부재** → "생략=보존"과 "없으면 mint" 동시 성립 불가 → PR-5 에 단건 read 신설.
  **R14** `appendLead` 의 DB 쓰기만 fire-and-forget → 미러 유실 시 죽은 uuid 잔존 → 다음 `updateLead`(동기)가 되살려
  **새 lead 가 죽은 신원 상속** → `clearLead` 가 `발굴id:""` **명시 무효화**(⚠️`null` 금지 — zod 가 거부해 행이 화면에서 사라짐).
  ③ PR 분할 재정렬: **PR-0 → PR-4 → PR-5 → PR-6**. PR-2·3 계약(`LeadCandidate{발굴id?, matched}` + `listLeadCandidates`) §7-1 에 못박음.
- 2026-07-15 v2 설계 재작성(DevB): belie 승인(전환추적 링크 착수) + **"시트 컬럼 신설 0" 유지** 제약 반영.
  구설계(03 `X:AD→X:AE` 에 발굴id 컬럼)를 **폐기**하고 **DB payload 전용 `발굴id`** 로 대체 — 성립 근거 3실측:
  ①`mirrorSheetRow` 는 코호트 게이트가 아니라 `dbEnabled()` 만 봄 → 프로덕션은 비파일럿도 DB 에 lead 가 쌓임
  ②03 은 R3-4 dual-sync(update/clear 동기+재시도) ③jsonb 얕은 병합 + `JSON.stringify` 의 undefined 탈락
  → **키 부재 = 보존** 의미론 성립. 새 위험 2건 등재: **R10**(clear→append 행 재사용 시 죽은 lead 의 `발굴id`
  상속 → 미팅이 엉뚱한 발굴을 가리킴 = #559 stale 커스텀과 동형. `appendLead` 가 항상 새 id 명시로 차단,
  최악은 dangling=안전 실패) · **R11**(`발굴id` 에 `.default("")` 를 주면 매 수정마다 링크가 지워짐 → `.optional()` 강제).
  시트 스키마 무변경이라 **revert 1건으로 완전 복구**(구설계의 "endCol 되돌리면 죽은 uuid 상속" 위험이 구조적으로 소멸).
- 2026-07-15 PR-1 구현(DevB): `lib/service/lead-prefill.ts` — `leadToMeetingDraft`(§2-2 매핑 스냅샷)·`mergeLeadDraft`(§2-3 비파괴 병합)·`leadRemark`·`LEAD_REFERRER_CUSTOM_KEY` = PR-2·3 공용 계약. @/types 만 의존(클라이언트 import 안전). 자가검토 수정 1건: 양쪽 커스텀 전무 시 커스텀 키 생략 — 커스텀 객체가 존재하면 meetingToRow/06 스냅샷이 유령 '{"업체":{},"대표자":{}}' 를 시트 AN/Y 에 기록하는 것 방지. 테스트 21케이스. **적대 리뷰(2렌즈) 확증 4건 선제 수정**(blocker 0이었으나 PR-2·3 이 소비할 공용 계약이라 지금 박음): 예약비고 500 클램프(§6 R9)·사용자 값 verbatim 보존·발굴 교체 계약(§6 R7)·CompanyInfoEditor 리마운트 의무(§6 R8) — 뒤 둘은 docstring+테스트+위험표 3중 고정.
- 2026-07-14 설계 등재(DevB): 병렬 설계 3영역(발굴id·링크저장·필드매핑) + 적대 비평 3렌즈 워크플로우. **비평 만장일치로 v1 스코프 축소**(프리필 only, 링크 v2 분리) + 소개처 커스텀 JSON 채택.
  ⚠️ 비평이 제기한 "라이브 버그(03 append `_cleared:false` 누락)"·"`db-tab-sync.ts` 부재"·"meetings.ts 499줄"은 **master 재실측 결과 전부 stale**(R3-4 머지·추출 완료로 이미 해소) — 보고 전 재검증으로 오보 방지. 유효한 구조적 위험(04 range 400·clearMeeting·06 config·리스케줄 UUID)만 §6 에 반영.
