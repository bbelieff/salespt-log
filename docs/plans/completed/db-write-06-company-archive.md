---
slug: db-write-06-company-archive
status: active
created: 2026-07-15
completed: 2026-07-15
owner: belie
related: db-write-flip, contact-company-archive-sync, consultation-log-and-calendar
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 06 업체정보(company_archive) 쓰기의 DB 정본 전환(R3-3 PR-2)을 완결 — 마지막 미전환 지점(계약 생성 시 06 스냅샷)에 syncDb 관통.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `lib/service/contract-payment.ts`(addFromContract), `lib/repo/company-info-archive.ts`, `company-archive-sync.ts`
> - **읽고 나면 알 수 있는 것**: R3-3 PR-2 가 왜 대부분 이미 됐나 / 남은 갭은 무엇이었나 / #559 근인은 어디서 근본수리됐나 / addFromContract 만 warn 유지하는 이유
> - **관련 문서**: db-write-flip.md §6 R3-3, PR #548·#559(patchMeeting·rename 부활)

# 06 업체정보 DB 정본 전환 — R3-3 PR-2 완결

## 0. 착수 전 실측 (§0.5 — 재작업 회피)
디스패치는 "06 upsert·rename·clear 를 syncDb 게이트로 dual-sync + #559 근인 근본수리"였으나, origin/master 실측 결과 **대부분 이미 완료**:
- **upsert 게이트**: `saveCompanyInfoByContract`(294) ✓ · `editContractLinkedFields` rename(140) ✓ · contact.ts patchMeeting(#559) ✓.
- **rename 근본수리(#559 근인)**: `renameKeyOnlyPayload`(company-archive-sync.ts)가 `CompanyInfo.parse({})+커스텀:{}` 를 실어 **얕은 병합 부활**(개명→정보수정→되돌림 옛값 부활)을 근본 차단. **회귀 테스트 존재**(company-archive-write-sync.test.ts ①-b 부활·①-c stale 커스텀·rename 라우터 5).
- **clear**: 06 은 별도 clear writer 없음 — "삭제"는 rename 의 `_cleared:true`(게이트됨)로만. 계약 삭제 cascade 는 02 만 clear(06 스냅샷 보존이 설계).
- **읽기 동반 flip**: `loadCompanyInfoByContract` 파일럿=`readCompanyInfoFromDb` DB 우선(read-your-writes 성립).

## 1. 남은 유일 갭 → 수리 (이 PR)
- **`addFromContract`(계약 생성 시 06 스냅샷, 180)** 만 `syncDb` 미관통(`resolveCtx` = ctx 만) → 파일럿도 async 미러(안전 payload 기본값 없음).
- **수정**: `resolveCtx` → `resolveSheetWithSyncDb` 로 `syncDb` 확보, 06 upsert 에 `{syncDb}` 관통. 파일럿은 이제 동기 정본(재시도)+**안전 payload**(`_cleared:false·커스텀:{}` 병합 — 재사용 자연키의 stale content 부활 차단).
- **⚠️ warn 은 유지(loud 로 안 바꿈)**: 부모 `appendFromContract` 는 `findFirstEmptyRow` 로 새 행을 잡는 **비멱등 append** — 여기서 throw 하면 사용자 재시도가 append 재실행 → **중복 계약행=매출 이중계상**(#558 교훈). 06 스냅샷 실패는 계약을 안 깨고, 미러 미반영 시 read 가 시트 fallback(빈 DB 행)으로 수렴하므로 loud 불요. (patchMeeting 은 patch 가 멱등이라 #559 에서 loud 로 전환한 것과 대비.)

## 2. 자연키 멱등 = "todos 식 진짜 flip" 안전성
06 자연키 = `companyContractRef(계약일, 업체명)` → 같은 키 재호출 = 같은 행 UPDATE(멱등). 그래서 06 **write 자체**는 append(비멱등)와 달리 dual-sync 가 안전. addFromContract 는 write(멱등·syncDb)와 parent-append(비멱등·warn)를 **분리 취급**.

## 3. 수용 기준
- 서비스 게이트 회귀: addFromContract 파일럿→`{syncDb:true}`·비파일럿→`{syncDb:false}`·06 실패해도 append 성공(warn). 기존 rename 부활 회귀 유지. check.sh 초록. §6.8 배포·health 200.

## Log
- 2026-07-15 구현(DevC): 실측으로 R3-3 PR-2 가 ~95% 기완(rename 근인 #559 근본수리·upsert/read 게이트 완료) 확인 → **남은 갭 addFromContract 06 스냅샷만** syncDb 관통. warn 유지(비멱등 append throw=중복행 위험). 게이트 테스트 헤더 정정("addFromContract=R2 정본" 은 stale) + 회귀 3. B 무접촉(C 단독 writer).
