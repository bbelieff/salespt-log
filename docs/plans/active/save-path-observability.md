# 저장 경로 관측성 — assign/dept 저장 무결성 추적 (2026-09-14)

## 왜

2026-09-13 관리자가 트레이너 담당 체크박스를 저장했으나 다음 날 반영돼 있지 않았다.
원인 조사에서 **로그가 존재하지 않아 판별 자체가 불가능**했다.

실측 근거:
- VPS `~/.pm2/logs/salespt-log-out-0.log` 16,648줄 중 `api_timing` **0건**, `registry-mirror` **0건**.
  내용은 전부 npm 배너(`> next start` 4,162회 + 빈 줄).
- 반증 실험: 파일 크기 170,642 고정 → `POST /api/admin/assign-trainee`(401) → 3초 후 **크기·mtime 불변**.
  `withApiTiming` 의 `finally` 는 401 에서도 반드시 `console.log` 한다. 즉 찍혔는데 파일에 안 들어갔다.
- 기전: pm2 `exec_mode=cluster_mode` + `script=/usr/bin/npm args=['start']`.
  `npm → sh -c next start → next-server` 손자 프로세스의 raw fd 1 출력은 pm2 수집 경로 밖.

→ **"저장 실패 기록이 없다"는 결론이 성립 불가**였다. 관측기 자체가 죽어 있었다.

부가 사실: 운영 `.env` 에 `REGISTRY_DB_READ=1` — **읽기는 Postgres, 쓰기는 시트**.
시트 쓰기 성공 후 DB 미러는 fire-and-forget 이고, 실패해도 호출부로 throw 하지 않는다.
미러가 실패하면 시트엔 있고 DB엔 없으며 UI 는 DB 를 읽으므로 **"저장 안 된 것처럼" 보인다.**
그리고 `picked === null`(행 parse 실패) 경로는 미러를 건너뛰면서 **아무 흔적도 남기지 않았다.**

## 무엇을 한다

### P0 — 운영 (완료, 2026-09-14)
VPS `ecosystem.config.cjs` 를 `script: node_modules/.bin/next` 직접 실행으로 교체(npm 경유 제거) + `time: true`.
검증: 교체 전 0바이트 증가·`api_timing` 0건 → 교체 후 +131바이트·1건.
`deploy.yml:171` 은 `git reset --hard` 만 하고 `git clean` 이 없어 untracked 설정이 배포에 살아남는다.

### P1 — 코드 (이 계획)
pm2 로그 한 번 grep 으로 5분 안에 아래를 판별할 수 있게 만든다.

| 질문 | 남기는 라인 |
|---|---|
| (a) 요청이 도달했나·status 는 | `api_timing` (기존 + `request_id` 추가) |
| (b) 시트 어느 행에 무엇을 썼나 | `sheet_write` (신규) |
| (c) DB 미러가 성공/실패/**스킵**됐나 | `db_mirror_result` (신규) |
| (d) 셋을 한 요청으로 묶을 수 있나 | `request_id` (ALS 재사용) |

파일:
- `lib/analytics/api-timing.ts` — `TimingStore.requestId` 추가, `als`·`currentRequestId()` export,
  `api_timing` 에 `request_id` **추가만**(기존 필드 불변 — 운영 grep 보존), 로깅 try/catch
- `lib/analytics/save-observability.ts` (신규) — 해시·redact·3종 로그 라인
- `lib/repo/users.ts` — `updateUserCell` 에 `sheet_write` + `picked===null` 스킵 warn
- `lib/repo/db/registry-mirror.ts` — 성공/실패/`db_disabled` 스킵을 구조화 한 줄로.
  기존 `[registry-mirror] 실패` 문자열 warn 은 **병행 유지**(운영 grep 이 깨지지 않게)

제약:
1. PII 원문 금지 — 이메일·이름은 sha256 앞 8자리. 해시 실패 시에도 원문 폴백 금지(`hashfail`)
2. 기존 `api_timing` 필드 제거·개명 금지 (추가만)
3. 로깅 실패가 응답 실패가 되면 안 된다 — 전부 삼킨다
4. 한 줄 = 한 JSON (pm2 줄 단위 수집)
5. `requestId` 는 fire-and-forget **호출 동기 시점**에 캡처 — 재시도 `setTimeout` 이후 ALS 를 믿지 않는다

### P2 — 옵티미스틱 UI 실패 롤백 (보류)
`TrainerMgmtPanel.call()` 은 실패 시 `setErr` 만 하고 체크 상태를 되돌리지 않는다.
해당 파일은 현재 OC 소유(수리3 레이아웃) → **OC PR 머지 후 rebase 하여 별도 진행**.

## 완료 기준

- [x] `tests/structural/save-path-observability.test.ts` 8케이스 green
- [ ] `bash scripts/check.sh` 통과
- [ ] `npx next build` 성공
- [ ] 배포 후 실제 담당 체크 1회 → pm2 로그에서 `api_timing`·`sheet_write`·`db_mirror_result` 3줄이
      같은 `request_id` 로 나오는지 확인

## 알려진 한계 (Muse 자기검토에서 확인, 그대로 인정)

- fire-and-forget 특성상 **프로세스가 먼저 죽으면 미러 결과 라인이 영영 안 남는다.**
  "미러 결과 없음"이 대기 중인지 유실인지는 로그만으로 구분 불가.
- 쓰기 요청당 로그가 최대 3줄로 늘어난다. pm2 logrotate 미설치 상태라 장기 볼륨 감시 필요.
- Edge 런타임 라우트에서는 ALS 가 동작하지 않아 `request_id: "none"` 이 된다(현재 해당 라우트 없음).

## 되돌리는 법

커밋 revert. 운영 P0 은 `ecosystem.config.cjs.bak-20260914-dh` 복원 후 `pm2 delete && pm2 start`.
