> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: VPS 빌드 OOM 을 **힙 상향이 아니라 소스맵 생성 차단**으로 해결한 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `next.config.mjs`, `.github/workflows/deploy.yml`
> - **읽고 나면 알 수 있는 것**: 왜 힙을 안 올렸나 / 왜 소스맵을 꺼도 안전한가 / 언제 되켜지나
> - **관련 문서**: `docs/playbooks/deploy-vps.md`

# 빌드 OOM — 힙을 올리지 않고 일을 줄였다

**발생**: 2026-09-07, PR #943 배포. 재시도도 같은 자리에서 실패.

## 증상

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
  13: v8::internal::JsonStringify(...)
Aborted (core dumped)
```

`--max-old-space-size=2048` 에서 터졌다. **사이트 장애는 없었다** — 무중단 배포라
`.next-build` 단계에서 멈춰 옛 `.next` 가 계속 서빙됐다(health 200). 다만 **master 가
배포 불가 상태**가 되어 다른 트랙까지 막혔다.

## 왜 힙을 안 올렸나

**이미 반증된 처방이다.** RAM 3.8GB VPS 에서 4096 으로 올렸더니 OOM-killer 가 프로세스를
죽여 **BUILD_ID 누락 silent failure** 를 냈다(2026-05-13). `deploy.yml` 주석에 그대로
박제돼 있다. 한도를 올리면 실패가 **더 조용해진다** — 최악의 방향이다.

## 무엇을 줄였나

`SENTRY_AUTH_TOKEN` 이 **미설정**이다. 그러면 소스맵은
- **업로드되지 않고** (토큰이 없으니)
- **제공되지도 않는다** (`hideSourceMaps: true`)

즉 **만들어서 버리고 있었다.** 빌드 로그의 Sentry 경고가 이미 그걸 말하고 있었다.

```js
const sentryUploadEnabled = Boolean(process.env.SENTRY_AUTH_TOKEN);
sourcemaps: { disable: !sentryUploadEnabled },
```

**잃는 관측성 0** — Sentry 스택트레이스는 지금도 minified 다(올라간 맵이 없으므로).
**자동 복원** — 토큰을 넣는 순간 다시 생성·업로드된다.

## 실측

| | 2048MB 빌드 |
|---|---|
| 고치기 전 | OOM (로컬·VPS 모두) |
| 고친 뒤 | **통과** (로컬 동일 조건) |

## 되돌리기

`git revert <squash-sha>`. 단 되돌리면 OOM 이 재발한다 — 되돌릴 이유가 생기면
소스맵이 필요해진 경우일 텐데, 그때는 토큰을 넣으면 이 코드가 알아서 켠다.

## 남은 것

빌드는 계속 자란다. 다음에 또 2GB 를 넘기면 후보는 ①VPS swap 확보 ②빌드를 러너에서
하고 산출물만 전송 ③의존성 다이어트. **힙 상향은 후보가 아니다**(위 사고 이력).
