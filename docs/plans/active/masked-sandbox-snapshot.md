> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 화석 코드 정비의 연습장 — 운영 DB 를 읽기만 해서 "가짜로 바꾼 사본"을 만들고, 이 PC 의 PGlite 에 실어 저장 구조를 실측·시험하는 도구.
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `scripts/ops/mask-snapshot-core.mjs`·`masked-snapshot.mjs`·`sandbox-load.mjs`, `db-audit.yml`(masked-snapshot 선택지)
> - **읽고 나면 알 수 있는 것**: 원본이 어디까지 가고 어디서 가려지나 / 무엇을 남기고 무엇을 바꾸나 / 쓰는 순서
> - **관련 문서**: 화석 코드 정비 설계(세션 문서), `docs/plans/active/fossil-a1-dead-code.md`

---
slug: masked-sandbox-snapshot
status: active
created: 2026-10-15
branch: chore/masked-sandbox-snapshot
---

# 연습장 — 가짜로 바꾼 운영 DB 사본

## 승인·범위
- belie 2026-10-15 "가짜로 바꾼 사본 써". 운영 DB 는 **읽기만**(한 연결의 read only repeatable read 트랜잭션, SELECT 만). 쓰기·스키마 변경 0.

## 흐름
1. GitHub Actions `DB Audit (read-only)` → script = `masked-snapshot` (VPS `/opt/salespt-log` 에서 실행).
   - 원본은 VPS 프로세스 메모리 안에서만 가려진다. 파일에는 **가린 값만** `/tmp/salespt-masked-<시각>.ndjson.gz`(권한 600).
   - 한 줄마다 원본 흔적 검사(이메일·전화·주민번호 전체·사업자번호·"○○님/대표") — 걸리면 파일을 지우고 실패.
   - 로그에는 표별 행 수와 운영 스위치 몇 개의 켜짐 여부("1"/미설정)만.
2. 이 PC 로 파일을 옮기고(SSH) VPS 의 파일은 즉시 지운다.
3. `node scripts/ops/sandbox-load.mjs <사본> [.sandbox/pg]` — PGlite 에 운영 스키마 모양 그대로 싣고 실측 질문(백필 비율·행 키 모양·이월 구형·지움 표시·미러 대기 등)을 숫자로만 출력.

## 가리는 규칙 (`mask-snapshot-core.mjs`, `tests/ops/mask-snapshot.test.ts` 12개)
- **기본은 전부 바꾼다.** 남기는 것: 숫자·불리언·날짜·UUID·앱 상태값(enum)·행 키 꼴·6자리 이하 숫자 문자열.
- 그 밖 문자열 → `가짜-<해시8>`(같은 원본=같은 가짜 → 관계 유지), 이메일 → `userNNNNNN@example.test`, 긴 숫자 → 같은 길이 가짜.
- 비밀 표(gcal_tokens·vault_pins·company_vault)는 행 제외. salt 는 실행마다 새로.
- `.sandbox/`·`*.ndjson.gz` 는 gitignore.

## 되돌리기
squash revert 1건(도구만 추가 — 앱 동작 변화 없음).