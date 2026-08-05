---
slug: cohort-sheet-sa-share
status: active
created: 2026-08-06
owner: DevB(260806)
related: worklog, arena-season2-setup, 0015-admin-oauth-drive-create
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 새로 만든 수강생 시트가 서비스계정(SA)에 공유되지 않아 **링크공유에만 의존**하던 갭(10기 6명 실측)을 복제 함수 한 곳에서 막고, 기존 시트 상태를 재실측할 감사 도구를 남긴다.
> - **누가 읽나요**: 개발자, 반장(FM), belie(운영 조치 1건)
> - **어떤 기능·작업과 연결?**: `lib/repo/drive-client.ts` 복제 경로 · 기수 생성(일반·아레나·pending 재시도) · BBE-45
> - **읽고 나면 알 수 있는 것**: 왜 9기는 되고 10기는 안 됐나 / 어디를 고쳐야 전 경로가 덮이나 / 이미 만들어진 시트는 누가 어떻게 고치나
> - **관련 문서**: `docs/plans/active/arena-season2-setup.md` §7-7 · `docs/decisions/0015-admin-oauth-drive-create.md`

# 수강생 시트 SA 공유 갭 (BBE-45)

## 1. 무엇이 문제인가

앱은 수강생 시트를 **SA(service account)** 로 읽고 쓴다(`lib/repo/sheets-client.ts`, scope `spreadsheets`).
SA 가 그 시트에 닿는 경로는 둘뿐이다.

1. SA 가 **명시 편집자**로 공유돼 있다
2. **부모 폴더**가 SA 에 공유돼 상속된다

둘 다 없으면 남는 건 **링크공유(anyone-with-link writer)** 뿐이다. 지금 앱이 도는 이유가 그것이고,
관리자가 링크공유를 잠그는 순간 **해당 수강생의 앱 접근이 끊긴다**. 보안·가용성 양쪽에서 취약하다.

## 2. 실측 (2026-08-06 · `verify-sa-sheet-access.mjs --cohort 9,10`)

| 기수 | 인원 | SA 명시공유 | 폴더 상속 | 판정 |
|---|---|---|---|---|
| 9기 | 6 | **O** (6/6) | **O** (6/6) | ✅ 안전 |
| 10기 | 6 | **X** (0/6) | **X** (0/6) | ⚠️ 링크공유 의존 |

10기는 **부모 폴더가 SA 조회 결과에 아예 안 잡힌다**(폴더 요약 0건) — SA 가 폴더를 볼 권한조차 없다는 뜻.

## 3. 왜 이렇게 됐나 (근인 — 버그가 아니라 전제 붕괴)

- `704ac5c`(2026-05-12 15:56) 가 **SA 자동 공유**를 넣었다 — "매칭되는 시트를 찾지 못했습니다" 사고의 근본 해결로.
- 같은 날 `fe4a0b8`(21:44) 이 그걸 **걷어냈다**. 근거: *"admin 이 Drive 폴더 단위로 한 번만 공유하면
  그 폴더 안 시트는 자동 권한 상속 — 자동화 자체 불필요."*

이 판단은 **폴더가 실제로 공유돼 있을 때만** 옳다. 9기는 그 전제가 성립했고(폴더 공유 O), 10기는
성립하지 않았다. 즉 **기수마다 결과가 갈리는 우연한 상태**였고, 코드에는 이를 보장하거나 감지하는
장치가 없었다. 이것이 이번 갭의 근인이다.

## 4. 고친 것

### 4-1. 복제 함수 한 곳에 SA 공유 동반 (`lib/repo/drive-client.ts` + `lib/repo/drive-sa-share.ts`)
`copyTemplateSheet` 호출부가 **3곳**이다 — 일반 기수 라우트(`create-cohort-members`), 아레나
라우트(`create-arena-members`), pending 재시도 서비스(`cohort-create.ts`). 서비스 한 곳만 고치면
**주 경로(라우트 직접 호출)가 샌다.** 그래서 세 경로가 전부 지나는 `copyTemplateSheet` 안에 넣었다.

- 복제 성공 직후 `permissions.create`(SA·writer·알림메일 없음)
- **실패해도 throw 하지 않는다**: 복제는 이미 성공했고, 여기서 던지면 호출부가 시트를 만들어 놓고
  실패로 처리해 pending 재시도가 **중복 복제**를 시도한다(#546 멱등 전제 훼손). 링크공유가 살아
  있는 한 앱은 동작하므로 경고만 남기고 §4-2 감사로 잡는다.
- `already exists` 는 정상 흡수(멱등).
- 헬퍼(`shareWithServiceAccount`)는 `lib/repo/drive-sa-share.ts` 로 분리 — 500줄 캡 + `driveCreatorClient`
  ADR-0015 구조 가드 구간(선언~다음 `export`)에 `serviceAccount(` 가 걸리는 것을 위치로 회피.

### 4-2. 읽기 전용 감사 도구 (`scripts/ops/verify-sa-sheet-access.mjs`)
기수 단위로 명시공유·폴더상속·링크공유를 실측해 표로 출력. 쓰기 0건, SA readonly scope 로만 인증해
**구조적으로 쓰기가 불가능**하다. `--execute` 를 붙이면 부족한 시트에 SA 공유를 추가한다(권한 추가만·멱등).

## 5. 남은 것 — 이미 만들어진 10기 6개 (belie 액션)

코드 수정은 **앞으로 만들 시트**를 막는다. 이미 만들어진 6개는 별도 조치가 필요하다.

- **`--execute` 는 파일 소유자 자격(admin OAuth)이 필요**하고, 로컬 `.env.local` 토큰은 `invalid_grant`
  (반장 실측과 동일). 살아있는 토큰은 GitHub Secrets → 배포 시 VPS `.env` 로 주입되므로 **VPS 실행**이 정본 경로.
- ⚠️ **BBE-72 와 같은 의존**: VPS 토큰은 인증은 되지만 `files.copy` 가 `PERMISSION_DENIED` 다(scope 의심).
  같은 토큰으로 하는 `permissions.create` 도 **같은 이유로 막힐 수 있다.** BBE-72 확정 전에는 성공을 보장 못 한다.
- ✅ **권장(토큰 무관·즉시)**: belie 가 Drive 에서 **10기 부모 폴더를 SA 에 편집자로 공유**.
  폴더 상속이 현행 설계의 전제이므로 근본 조치이고, 그 폴더에 **앞으로 들어올 시트까지 한 번에** 덮는다.
  6개 시트 개별 공유보다 적은 조작으로 끝난다.

## 6. 아레나(A2)는? — 확인 결과 이미 적용됨

- 런북 `arena-season2-setup.md` §7-7 이 사람 1명당 절차에 **"SA 편집자 공유"** 를 명시.
- 배치 스크립트 `scripts/ops/arena-season2-batch.mjs` 에 `shareToSA()` 구현(주석에 "10기 갭" 명시).
- **원칙 적용됨 — 이번 PR 범위에서 아레나 파일은 건드리지 않는다**(A 트랙 `lane:arena` 점유, §3.5).

## 7. 수용 기준

- [x] `copyTemplateSheet` 가 SA 공유를 동반 (3 호출부 전부 커버)
- [x] 공유 실패가 복제 성공을 뒤집지 않음 (회귀 테스트 4건, 되돌리면 실제로 빨개지는 것까지 실측)
- [x] 감사 도구로 9기/10기 실측 대비표 확보
- [x] check.sh 초록
- [ ] §6.8 배포 success + health 200
- [ ] 10기 6개 실제 공유 — belie 폴더 공유 또는 VPS `--execute`(BBE-72 이후)

## 8. 범위 밖 (후속 등재)

- **anyone-writer 링크공유 관행 자체** — 전 기수 공통(템플릿 승계 추정). 보안 정책 개선 후보이나
  링크공유를 잠그려면 §5 가 먼저 끝나야 한다(순서 의존). 별건으로 남긴다.
- `createFolder`(아레나 전용) 의 폴더 SA 공유 — 아레나 레인이라 이번 PR 미접촉.

## Rollback

이 PR 을 revert 하면 복제가 공유 없이 돌아간다(현행 동작). 감사 스크립트는 읽기 전용이라 잔여 영향 0.
`--execute` 로 추가한 공유는 Drive 공유 대화상자에서 SA 를 제거하면 원복된다.
