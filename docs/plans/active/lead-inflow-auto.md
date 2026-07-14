---
slug: lead-inflow-auto
status: active
created: 2026-07-14
owner: belie
related: 0029-lead-inflow-equals-production, 0020-production-cell-ownership
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 콜·지·기·소 유입을 03 접수 건수에서 자동 파생하고(유입=생산) 컨택탭 유입 스테퍼를 제거하는 작업 계획.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: 컨택탭 ChannelTabsAndPanel, `writeProductionCell`, `batchWriteChannelDailyRows`, `saveContactMetrics`
> - **읽고 나면 알 수 있는 것**: 무엇을 바꾸나 / 과거 데이터는 어떻게 되나 / 무엇이 belie 결정 대기인가
> - **관련 문서**: docs/decisions/0029-lead-inflow-equals-production.md (결정 원문)

# 콜·지·기·소 유입 자동화 (유입 = 생산)

## 1. 배경·결정
belie 확정: 콜지기소는 접수 1건 = 생산 1건 = 유입 1건. 유입 수동 입력은 이중 입력이자 불일치 원인.
→ **ADR-0029**: 유입(F) = 생산(E) = 03 접수 건수 파생. 상세·근거는 ADR 참조.

## 2. 선행 dry-run (완료 — 게이트 통과)
`scripts/census-lead-inflow-2026-07-14.mjs` (READ-ONLY, 전 시트):

| 항목 | 실측 |
|---|---|
| 대상 시트(trainee·유니크) | 69 (읽기실패 0) |
| 콜지기소 기록 있는 셀 | 30 |
| **유입 ≠ 생산 어긋난 셀** | **14 (46.7%)** |
| 어긋난 시트(수강생) | 7 / 69 |
| Σ\|생산−유입\| | 15 (셀당 평균 ≈1) |

**판정**: 어긋남은 비율은 높으나 절대량 미미(평균 차이 1) = 수동 입력 누락·오기 → 전제(유입=생산)를 뒤집지 않고
오히려 자동화 근거. **앞으로의 자동화 = 자율 진행**, **과거 14셀 소급 정렬 = belie 결정 대기**(§3).

## 3. 범위
- ✅ **포함(이 PR)**: 파생 writer(E:F), 컨택탭 유입 미기록(G:H), 서버 강제(inflow:=production), UI 🔒DB자동.
  다른 채널 무변경. 비파일럿·DB꺼짐 불변(기존 게이트 그대로 — 이 변경은 게이트 무관 전 채널 공통 규칙).
- 📥 **belie 결정 대기(보류)**: 과거 어긋난 14셀 소급 정렬(F := E). 실행 시 7명 수강생의 지난 주차 유입·
  퍼널 숫자가 바뀜(Σ15) = 수강생 실데이터 변경 → CLAUDE.md §0.7 화이트리스트. 결정 전까지 옛 값 보존.
  - 선택지 ①그대로 둔다(권장 — 과거 기록 보존, 앞으로만 자동) ②소급 정렬(과거도 규칙과 일치, 단 7명 통계 변동)
- ❌ **미포함**: 읽기 시점 파생(배포 즉시 과거 통계 변동 → ADR-0029 에서 기각).

## 4. 구현
**불변식: 콜지기소 생산·유입의 writer 는 `writeProductionCell` 하나뿐. 컨택 저장은 두 값을 어떤 저장소에도 안 쓴다.**

| 레이어 | 변경 |
|---|---|
| repo `sales-production-cell.ts`(신규) | `writeProductionCell` — 콜지기소면 **E:F 동시 기입**(같은 값) + DB 미러 `{production, inflow}` (sales.ts 500줄 캡 분리) |
| repo `sales.ts` | `batchWriteChannelDailyRows` — 콜지기소는 **G:H 만** 기록. DB 미러 payload 에서도 생산·유입 **제외** |
| service `sales-write.ts` | `toDbRows` — DB 정본 쓰기 전 콜지기소 행의 `production`·`inflow` 키 **제거**(jsonb 병합이 파생값 보존) |
| repo `db/client.ts` | `SalesRowForDb.production/inflow` → optional(파생 채널은 미기입) |
| UI `ChannelTabsAndPanel.tsx` | 콜지기소 유입 = ±스테퍼 제거 → `🔒 DB자동` + "생산과 동일 · 자동". 표시값·오늘합계는 **라이브 파생값**(생산 행과 동일 소스) |

트리거는 기존 그대로: 03 콜지기소 add/patch/remove → `syncProduction` → `writeProductionCell`(이제 E:F).

**왜 "클라 값 무시"가 아니라 "저장 안 함"인가** (적대 리뷰 CONFIRMED): 컨택탭 draft 는 60초 캐시라 03 에 방금
등록한 접수를 모를 수 있다. 그 스테일 값을 서버가 저장하면 파일럿의 **DB 정본이 0 으로 덮이고 시트(E:F)와 영구
불일치**한다(유입 스테퍼도 없어져 사용자가 고칠 수도 없음). 저장 경로에서 두 키를 빼는 것이 유일하게 안전.
부수 효과로 **과거 날짜의 유입도 컨택 저장으로 덮이지 않는다**(§3 보류 항목과 정합).

## 4.5 적대적 리뷰 결과 (2회) — 이 PR 이 잡은 것

**1차 리뷰: CONFIRMED HIGH 회귀 발견 → 설계 교체.** 초안은 `saveContactMetrics` 가 `inflow := m.production`
(클라 값)으로 채웠는데, 컨택 draft 는 60초 캐시(03 변경이 dayKey 를 invalidate 안 함)라 **스테일 0 이 파일럿의
DB 정본을 덮고 시트(E:F)와 영구 불일치**(유입 스테퍼도 없어 사용자가 못 고침) + **과거 유입까지 저장마다 소급
덮어씀**. → 위 §4 "저장 안 함"(toDbRows/미러 strip) 구조로 교체.

**2차 리뷰(수정본 재검증)**: clobber **FIXED**(writer 전수조사·jsonb 병합·최초저장 케이스 확인), 타 채널 회귀
**없음**. UI 표시 불일치 2건 지적 → 수정(잠긴 행·오늘합계·**탭 배지**가 모두 동일한 라이브 파생값 사용,
DBOverview 로딩 전엔 저장값 폴백).

**남은 잔여(비차단·후속)**:
1. **스테일 draft 로 인한 헛 dirty**(기존 클래스, 이번에 inflow 로 확대): 03 변경이 `dayKey` 를 invalidate 하지
   않아 draft 의 콜지기소 생산·유입이 낡을 수 있음 → 아무 스테퍼나 건드리면 미저장 이탈 가드가 뜸. **저장은
   무해**(두 키는 어차피 제외됨). ADR-0020 이후 `production` 에 이미 있던 문제. 후속: 03 mutation 훅이
   `dayKey` 도 invalidate.
2. **파일럿 DB 파생값은 fire-and-forget 미러로만 도착**(`writeProductionCell`) — 미러 실패 시 DB 가 옛 값 유지
   (다른 writer 가 없으니 자가복구 없음). `production` 이 ADR-0020 부터 갖던 노출을 `inflow` 로 확대한 것이라
   신규 회귀는 아님. 후속: 파일럿 동기 쓰기 또는 정합 대조/복구 잡(R3 mirror_pending 과 함께).

## 5. 수용 기준
- 콜지기소 03 접수 등록/수정/삭제 → 01 E·F 가 같은 값으로 갱신.
- 컨택탭 저장이 콜지기소 F 를 건드리지 않음(다른 채널 F 는 그대로 기록).
- 다른 채널(매입DB·직접생산·현수막) 동작 완전 불변.
- check.sh 초록 + §6.8 배포 관찰.

## Log
- 2026-07-14 착수(DevF): census dry-run 실행·판정 → 자율 진행. ADR-0029 등재. 구현·테스트.
