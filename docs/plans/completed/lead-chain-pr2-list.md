---
slug: lead-chain-pr2-list
status: active
created: 2026-07-19
completed: 2026-07-19
owner: belie
related: lead-chain, db-read-production
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 발굴 체인 PR-2 — 컨택탭 발굴 피커(PR-3)가 소비할 **발굴(콜·지·기·소 영업기회) 목록 조회 서비스/API**. 접수일 내림차순 + 검색, 시트 I/O 신규 0.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie), PR-3(피커 UI)·PR-6(matched) 트랙
> - **어떤 기능·작업과 연결?**: `lib/service/lead-list.ts`(신규 순수), `lib/service/db.ts`(loadLeadsForPicker), `app/api/leads`
> - **읽고 나면 알 수 있는 것**: PR-2 가 왜 matched 를 안 넣나 / 발굴id 는 왜 파일럿만 실리나 / F(03 쓰기)와 어떻게 안 겹치나
> - **관련 문서**: lead-chain.md §7-1(소비 계약), PR-4(#581 발굴id 타입)·PR-5(#583 id 부여)

# 발굴 체인 PR-2 — 발굴 목록 조회 서비스

## 0. 스코프 경계 (§0.5 — PR-6 과 충돌 회피)
lead-chain §7-1 은 최종 계약을 `listLeadCandidates(email): Promise<LeadCandidate{...,matched}>` 로 못박고 **PR-6(B) 소유**로 배정. 디스패치: "PR-2=조회 서비스, **matched 배선은 PR-6 착지 시 연결**".
→ PR-2 는 **matched 없는 순수 조회**만 구현. PR-6 이 이 위에 matched 파생 + `listLeadCandidates` 를 얹는다(파일·함수 분리 → 충돌 0).

## 1. 구현
- **`lib/service/lead-list.ts`(신규 순수)**: `LeadForPicker = DBLead & {row, 발굴id?}` · `sortLeadsByRecent`(접수일 desc, 동률 row desc) · `filterLeads`(대표자명·업체명·소개처·연락처·구분 부분일치, 공백·대소문자 무시) · `selectLeadsForPicker`(검색→정렬).
- **`lib/service/db.ts` `loadLeadsForPicker(email, query)`**: `loadDBOverview` 와 **동일 게이트** 재사용 →
  · 파일럿(DB): `readDbTabFromDb().leads`(**발굴id 포함**) — 성공 시 즉시 반환(빈 목록도 정답, 시트 fallback 안 함). 실패만 시트로 silent fallback + Sentry.
  · 비파일럿/DB실패: `readLeads`(시트 X:AD, 발굴id 미보유=legacy). 둘 다 실패=빈 목록(화면 에러 금지).
  · **시트 I/O 신규 0** — 새 리더 없이 기존 것만.
- **`app/api/leads/route.ts`(신규)**: `GET /api/leads?q=` → `{ leads }`. withApiTiming 계측.

## 2. 왜 발굴id 는 파일럿만
발굴id = **DB payload 전용**(시트 컬럼 0, §4-3). 시트 리더(`readLeads`=X:AD 7필드)는 발굴id 를 못 만든다 → 비파일럿·시트 fallback 은 발굴id 없음(legacy). PR-6 의 matched 는 발굴id 있으면 링크 기준, 없으면 업체명 폴백(§7-1).

## 3. 구역 분리 (§3.5)
- `db.ts` 는 F(03 쓰기)와 공유하지만 **함수 단위 분리**(F=append/patch/clear write, C=loadLeadsForPicker read) → 충돌 0.
- 공용부(lib/types·config·SSOT 4문서) **무변경** — `LeadForPicker` 는 service-local, 발굴id 타입은 PR-4(#581)가 이미 등재.
- 신규 파일(lead-list.ts·api/leads)은 완전 독립.

## 4. 수용 기준
- 순수 헬퍼 단위테스트(정렬·동률·검색 5필드·공백/대소문자·mutate 없음·검색후정렬). next build(/api/leads 컴파일)·check.sh 초록. §6.8 배포·health 200.
- 머지: B PR-4 위 rebase(디스패치). matched 는 PR-6 착지 시 연결(계약엔 이미 존재).

## Log
- 2026-07-19 구현(DevC): 발굴 해제 후 PR-2 착수. lead-list.ts(순수 3함수)+db.ts loadLeadsForPicker(loadDBOverview 게이트 재사용, 파일럿 빈목록 정답 처리)+api/leads. matched 제외(PR-6 몫)로 스코프 경계 명시. 단위10. B 무접촉(함수 분리).
