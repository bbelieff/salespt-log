> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 외부 기술 실사(투자사·신규 개발자) 관점 코드 리뷰(2026-10-14)에서 나온 B(구조)·C(데이터·운영) 항목 중 안정성 90% 이상인 것만 묶어 고친 1차 정비.
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `lib/util/week.ts`(parseISO·todayKST) · `lib/repo/contract-payment-link.ts` · `lib/service/contact*.ts` · `app/api/health` · `tests/structural/ui-repo-boundary.test.ts`
> - **읽고 나면 알 수 있는 것**: 무엇을 고쳤고 무엇을 미뤘나 / 왜 안전한가 / 되돌리는 법
> - **관련 문서**: `docs/architecture.md`, CLAUDE.md §2·§6.8

---
slug: yc-hardening-safe-fixes
status: active
created: 2026-10-15
branch: chore/yc-hardening-safe-fixes
---

# 코드 정비 1차 — 안전한 수정 묶음

## 1. Scope (belie 2026-10-15: "보안 빼고 B·C, 잘 되는 기능 망가지지 않게, 안정성 90% 넘으면 진행")

| 항목 | 바꾼 것 | 왜 안전한가 |
|---|---|---|
| B5 | 같은 `parseISO` 6곳(복사본) → `@/util/week` 하나. 밖에서 쓰던 export 2곳은 재수출 유지 | 6개 본문이 원본과 글자까지 같음(실측) — 동작 변화 0 |
| C5 | "오늘" 을 UTC 로 재던 6곳 → `todayKST()` (DB 입력 기본 날짜·배너, 일정 결과/변경 기본 날짜, 연속기록) | 이미 쓰는 SSOT 함수. KST 09시 이후는 결과 동일, 0~9시만 어제→오늘로 바로잡힘 |
| C4 | 계약카드 지우기(`clearRowByLink`)가 미팅 id(AK) 로 먼저 찾고, 못 찾으면 예전 (계약일+업체명) | `findRowByLink` 의 id 우선·폴백 경로는 수정(updateLinkFields)이 이미 쓰던 것. id 없는 옛 행은 이전과 같음 |
| C1 | `/api/health` 에 `DATABASE_URL` 존재 확인 → 없으면 503 → 배포 실패·자동 롤백 | 값은 노출 안 함(boolean). 운영은 DB 정본이라 이미 있음 |
| B7 | `tests/structural/ui-repo-boundary.test.ts` — app·components 의 repo 직접 import 를 새로 막음. 기존 34곳은 박제(줄어드는 방향만) | 테스트만 추가 — 런타임 무변화 |

## 2. 미룬 것 (안정성 90% 미달 — 별도 계획)

B1·B2·B3(시트→DB 전환 마무리·스키마·런타임 DDL), B4(큰 파일 분해), B6(데이터 불러오기 통일), B8·B9(주석·이름 정리 — 변경량 큼), C3(미팅 연쇄 삭제 트랜잭션), C6(시트 미러 대기열), C7(백업 — VPS), C9(서버 분리). C2(미팅 동시 저장)·C8(CI 빌드)는 다음 PR 에서 가능성 확인.

## 3. 검증 · 되돌리기

- `check.sh`(pre-commit) 전체, 구조 테스트 94개.
- 되돌리기: squash revert 1건. 데이터 변경 없음.

## 4. 2차 (2026-10-15, chore/ci-build-and-architecture-doc)

- **C8**: CI(	ypecheck.yml)에 uild 잡 추가 — PR 마다 운영과 같은 
pm run build(Node 22, 비밀값 없음, SKIP_BUILD_CHECKS=1). 로컬 실측 약 6분·성공.
- **B10**: docs/architecture.md 현행화 — 옛 판은 "시트가 유일 SSOT · Docker 배포"(2026-08 이전). DB 정본·시트 미러·pm2 배포·구조 테스트·알려진 숙제로 다시 씀.
- **C2 보류 사유**: 미팅 부분 수정은 DB 를 읽고 앱에서 합친 뒤 행 전체를 다시 쓴다(`meetings-write.ts patchMeetingRecord`). 잠금 트랜잭션으로 감싸는 길은 확인했으나 이 저장 경로를 흉내 낸 서비스 테스트 10여 개를 함께 바꿔야 하고 실제 DB 동시성 시험이 필요해 이번 기준(90%) 미달 → 별도 PR.
