> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 관리자 수식 복원의 오래된 timeout 가설을 최신 master에서 재진단하고, Sheets quota를 지키는 최소 복구를 출시한다.
> - **누가 읽나요**: 개발자, 운영자, 독립 검수자
> - **어떤 기능·작업과 연결?**: `install-formulas-bulk`, `installFormulas`, 관리자 수식 복원
> - **읽고 나면 알 수 있는 것**: HTTP 500에서 증명된 것과 미확정인 것은 무엇인가 / Sheets 요청을 어떻게 줄이고 제한하는가 / 어떤 검증 뒤 운영에 배포하는가
> - **관련 문서**: `CLAUDE.md` §2·§3·§6.8, `docs/plans/completed/formulas-preserve-user-data.md`, `docs/plans/completed/sales-m3-5-ratio-formulas.md`

# ADMIN-FORMULA-RESTORE-C2-R1

## 배경과 진단 경계

- source `fix/m345-batchget-merge`는 `3dff145`에서 미커밋 상태였고 최초 진단 base `3fe78acc`보다 403 commit 뒤였다. source checkout은 읽기 전용으로 보존했다.
- 사용자 보고는 관리자 수식 복원 POST의 HTTP 500이다. 현재 인증된 운영 로그와 live Sheets 재현은 이 lease에 없으므로 정확한 예외 클래스는 미확정이다.
- 현재 master의 bulk route는 모든 대상 시트를 순차 처리한다. `installFormulas`는 시트마다 read 7회와 write 1회를 호출한다. 60개 시트면 최대 read 420회·write 60회다.
- Google Sheets 공식 기본 quota는 service account를 단일 사용자로 보고 read/write 각각 60회/분이다. 기존 429 retry는 최대 약 15초라 quota refill을 보장하지 못한다.
- self-hosted `next start`는 Next.js 자체 실행시간 제한이 없다. `maxDuration`은 deployment platform용 metadata라 현재 VPS의 HTTP 500 근인으로 단정하거나 복구 수단으로 의존하지 않는다.

## 결정

1. 한 시트의 모든 FORMULA pre-read를 단일 `values.batchGet`으로 합친다. M3:M5뿐 아니라 04 N/O/Q, 영업관리 I:P·D·R4:U5·F4:F5·O5, 계약 D3:D4를 함께 읽는다.
2. write는 기존 단일 `values.batchUpdate`를 유지한다. raw text/number/boolean 보존, 수식·빈 셀만 교체, 대상 수식과 응답 형식은 바꾸지 않는다.
3. bulk route는 concurrency 5를 유지하되 5개 wave 사이를 7.5초 제한한다. 한 install이 read 1회·write 1회이므로 bulk 자체 상한은 종류별 약 40회/분이며 60 quota에 headroom을 둔다.
4. `maxDuration`은 추가하지 않는다. Caddy·self-hosted Next 경로에 효력이 없는 설정으로 안전을 가장하지 않는다.
5. 실제 Sheets apply/restore는 하지 않는다. mock 기반 호출 수·순서·보존 계약, 전체 검사, 배포 후 health와 read-only route availability만 검증한다.

## File lease

- `app/api/admin/install-formulas-bulk/route.ts`
- `lib/repo/setup-formulas.ts`
- `tests/api/admin-install-formulas-bulk.test.ts`
- `tests/repo/setup-formulas-batch-read.test.ts`
- `docs/plans/active/admin-formula-restore-c2-r1.md` → 완료 시 `completed/`
- `docs/worklog.md` append-only checkpoint

## 수용 조건

- [ ] base에서 focused tests가 순차 처리·다중 pre-read 때문에 RED이고 후보에서 GREEN이다.
- [x] 한 `installFormulas`가 정확히 pre-read 1회와 batch write 최대 1회만 사용한다.
- [x] M3:M5·D3:D4·O5와 기존 전 범위의 raw 값 보존·수식 교체 계약이 유지된다.
- [x] bulk route가 한 번에 최대 5개만 실행하고 wave 시작 간 최소 7.5초를 둔다.
- [x] 일부 시트 실패는 기존처럼 `failed`에 격리하며 나머지 시트를 계속 처리한다.
- [x] focused tests, typecheck, `scripts/check.sh`, production build, 정상 hook가 PASS한다.
- [ ] 독립 review가 PASS한다.
- [ ] PR/CI/squash merge/직렬 자동 배포/public health가 PASS한다.
- [x] 운영 Sheets·DB·R6 migration write는 0이다.

## R2 current-master checkpoint (2026-08-02)

- `origin/master=3b500960d1931d136f94638ca136b6ae316abeab`를 merge했고 제품 파일 충돌은 없었다. `docs/worklog.md` 충돌은 양쪽 append를 모두 보존했다.
- 집중 검증 3 files/55 tests, typecheck, lint, 구조 23/23, 전체 107 files/943 tests, doc-drift, 정상 hook, production build 71/71이 PASS했다.
- 운영 Sheets·DB·환경·PM2·deploy·merge는 실행하지 않았다. 독립 review와 원격 CI 이후에만 release 단계로 진행한다.

## Rollback

- squash merge SHA를 정상 revert PR로 되돌린다. force-push·운영 데이터 역변경은 하지 않는다.

## 종료 기록 (2026-08-03 · A(260803))

- 머지 실측: `78b5ddc fix(admin): bound formula restore Sheets requests (#651)` — `origin/master` 반영 확인.
- 배포 실측 (2026-08-03 A(260803) 보강): "Deploy to VPS" run `30739460991` (headSha `78b5ddc`) = **success**.
- 미확인 잔여: 인증 필요한 실제 수식 복원 라이브 왕복(belie 운영 판단). 공개 health 200 확인.
- 판정: 후보 코드가 master 에 있고 관련 테스트가 전체 검사(check.sh PASSED)에 포함되므로 **완료**로 이관.
  운영 Sheets 실제 복원 실행은 이 계획 범위 밖(belie 운영 판단).
