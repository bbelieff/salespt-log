---
slug: db-read-production
status: active
created: 2026-07-09
owner: belie
related: db-read-payments, db-read-meetings-banners, db-migration-pilot, db-first-unlimited-roadmap
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R2 읽기 전환 5호 — DB생산 탭 loadDBOverview(03 DB관리 4섹션 = 4회 시트 read)를 파일럿 기수 한정 DB 단일 쿼리로 전환.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/service/db.ts(loadDBOverview), lib/repo/db/read-db-tab.ts(신규), lib/repo/db.ts(파서 export)
> - **읽고 나면 알 수 있는 것**: 4섹션 payload 2형태 처리 / 직접생산 "생산중" 행에서 왜 필드명은 Zod·열문자는 파서인가 / 합계행·phantom 필터는 어떻게 맞추나
> - **관련 문서**: docs/plans/completed/db-read-meetings-banners.md(payload 이중형태 원리)

# R2-5 — DB생산 탭(03) 읽기 DB 전환

## ⚠️ 이름 혼동
`lib/repo/db.ts` = **시트 03 DB관리 탭** I/O. `lib/repo/db/` = **Postgres**. 본 PR은
후자(read-db-tab.ts)에서 전자의 4섹션을 재현.

## 4섹션 + payload 2형태
| 섹션 | 시트 열 | row_key | backfill 절대열 시작 |
|---|---|---|---|
| 매입DB | B:H | `매입DB:r{행}` | B(1) |
| 직접생산 | I:O | `직접생산:r{행}` | I(8) |
| 현수막 | P:W | `현수막:r{행}` | P(15) |
| 콜지기소 | X:AD | `콜지기소:r{행}` | X(23) |

- dual-write payload = **이미 파싱된 타입 객체**(DBPurchase 등 필드명).
- backfill payload = 절대 열문자(섹션 시작 다름) + 문자열화.

## 핵심 결정 — 형태별 분기 (파서 재실행 vs Zod)
**직접생산 파서의 neo 레이아웃 감지가 배열 위치 의존**(종료일=r[1] 이 ISO 면 신규).
dual-write payload(생산중=종료일 빈)를 배열로 되돌려 파서에 태우면 neo=false 로 오독돼
소재가 밀린다. 그래서:
- **필드명 payload → Zod parse**(파서 재실행 안 함) + 파생 재계산.
- **열문자 payload → 절대→상대 배열 복원 → 시트 파서(parseXRow) 재사용**(neo 감지 정상).

이를 위해 db.ts 의 인라인 콜백 4개를 named export(parseXRow·isXMeaningful·DB_SECTIONS·isSumRow).
합계행(isSumRow)·phantom(isXMeaningful) 필터는 시트 경로와 동일 적용.

## 파생값 정합
주문금액=개당단가×주문개수, 직접생산 개당단가=round(예산/생산개수) — 양 경로 모두
시트 파서와 같은 식으로 재계산(dual-write payload 가 파생을 안 담았어도 맞음).

## 현수막 미세 차이 (무해)
읽기 P:W(8열, r[7]=구 W fallback), backfill P:V(7열). 신규 U(r[5]) 우선이라 backfill 에
r[7]이 없어도 부가세 판정 정상 — 정합 테스트에 명시.

## 수용 기준 스냅샷
- 정합 테스트: 4섹션 열문자==시트 파서, 파생 일치, 생산중 Zod 경로 소재 보존, 현수막 U 우선.
- GET /api/db sheets_calls: 전 4 → **후 0**(파일럿). 비파일럿 불변·pg 격리·check 초록.

## Log
- 2026-07-09 구현: db.ts 파서 4개 named export(리팩터, 중복 제거로 -55줄),
  read-db-tab.ts 신설(형태별 분기), loadDBOverview 게이트, 정합 5테스트.
