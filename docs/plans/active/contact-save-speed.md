> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 컨택관리(STEP 2) 숫자 저장이 느린 원인(저장마다 시트 read+write 동기 호출)과 수정 계획·결과.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `POST /api/daily/:date` → `saveContactMetrics` → `syncDirectProductionForDate`(lib/service/db.ts) · `writeProductionCountCell`(lib/repo/db-production-cell.ts)
> - **읽고 나면 알 수 있는 것**: 왜 느렸나 / 무엇을 바꿨나 / 남은 위험은 무엇인가
> - **관련 문서**: `docs/plans/active/contact-autosave-ux.md`(화면 쪽 선행 수정), `docs/plans/active/api-timing-baseline.md`, ADR-0024(직접생산 생산개수)

# 컨택 숫자 저장 지연 (fix/contact-save-speed, 2026-10-23)

## 증상
"숫자 저장이 되게 오래 걸림" — STEP 2 채널별 숫자(생산·유입·컨택) 자동저장.

## 증거 (운영 pm2 로그 `api_timing`, 읽기 전용 조회)
- `api/daily/[date]:POST` 평시 **ms 850~1,200, 그중 sheets_ms 620~1,000, sheets_calls=2** (10-20 ~ 10-22, 40건 연속 동일 패턴).
  → 저장 시간의 약 75~80%가 구글 시트 왕복이다. 같은 시간대 `GET` 은 sheets_calls=0, 76~312ms.
- 2026-10-23 09:58~10:00: **ms 20,144 / 25,796 / 20,086 / 25,957**, 그중 두 건은 **503**.
  같은 시각 error 로그에 `Quota exceeded ... 'Read requests per minute per user'` — 시트 읽기 할당량(서비스계정 공용)이
  바닥나면 429 재시도로 저장이 20초 넘게 멈추고 실패한다.

## 원인
`saveContactMetrics`(lib/service/contact.ts) 는 화면이 4채널을 항상 같이 보내므로 **매 저장마다**
`syncDirectProductionForDate` 를 부른다. 그 안에서:
1. `readProductions(sid)` — 03 DB관리 I:O 섹션 **시트 read** (DB 정본 기수도 예외 없음).
2. 활성 레코드가 있으면 `writeProductionCountCell` — M 셀 **시트 update 를 동기로** 기다린 뒤 DB 반영.

DB 가 정본(BBE-245)인데 요청 경로에 시트 왕복 2회가 남아 있었다. 구조 테스트
(`sheets-request-path-guard`)는 파일 단위 화이트리스트라(`lib/repo/db.ts` = union-백필-안전망) 이 호출을 잡지 못했다.

## 수정
- `syncDirectProductionForDate(sid, date, cohort, { inflow })`:
  - DB 정본 기수: 활성 레코드를 `readDbTabFromDb` 에서 찾는다(시트 read 0).
  - DB 에 없고 유입 0 → 보류 모달·M 동기화 대상이 없으므로 시트 read 생략.
  - DB 에 없고 유입>0, 또는 DB read 실패 → 기존 시트 read 안전망(append 미러 누락 대비) 그대로.
  - 비DB 기수: 기존 경로 불변.
- `writeProductionCountCell(..., { syncDb, sheetViaQueue })`: 레코드가 DB 에 있음이 확인된 경우에만
  DB 반영을 먼저 기다리고, 시트 M 셀은 기존 수렴 미러 큐(`queueDbTabRowSync`, patchProduction 과 같은 경로)로 넘긴다.
  DB 반영 실패면 예전처럼 시트에 직접 쓴다(값 유실 방지).
- 사용자 작성값 보존(§2.5): M 은 앱 소유 파생값(기존에도 항상 overwrite, §2.5 비대상) — 변경 없음.

## 검증
- 단위: `tests/service/production-count-sync-db-gate.test.ts` (+5), `tests/repo/db-production-count-cell.test.ts` (+3).
- 전후 시간: PR 본문 참조(운영 기준선 = 위 로그, 수정 후 = 시트 호출 0 → DB 왕복만).

## 남은 위험
- 시트에만 있고 DB 에 없는 직접생산 레코드(append 미러 실패)는 유입 0 저장 때 M 이 갱신되지 않는다. 다음 유입>0 저장 또는
  DB관리 화면 수정 시 수렴. 드문 경로.
- 시트 M 셀은 응답 뒤 수 초 안에 반영(큐). 실패 시 mirror_pending 표식 + self-heal(기존 동작).

## 되돌리기
squash 커밋 revert.
