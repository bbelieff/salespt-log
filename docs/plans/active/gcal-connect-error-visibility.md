---
slug: gcal-connect-error-visibility
status: active
created: 2026-07-28
owner: belie
track: DevE
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 구글 캘린더 연동 실패가 원인을 삼킨 채 한 갈래로 뭉치던 문제를, 사유별 로깅·안내로 갈라 진단 가능하게 만든다.
> - **누가 읽나요**: 개발자(DevE 구현·D VERIFY), 캡처/사용법 담당(USE08 재개 판단)
> - **어떤 기능·작업과 연결?**: `app/api/gcal/callback/route.ts`, `app/(app)/calendar/_components/GcalConnectCard.tsx`
> - **읽고 나면 알 수 있는 것**: 왜 원인을 못 찾았나 / 무엇을 배제했나 / 다음 발생 시 어떻게 즉시 규명하나
> - **관련 문서**: `docs/incidents/2026-07-28-cowork-consolidated-bug-report.md` 버그3, ADR-0028

# 구글 캘린더 연동 실패 — 원인 가시화 (버그3 / 통칭 gcal_99)

## 무엇이 문제였나

연동 실패가 **전부 `?gcal=error` 한 갈래**로 뭉쳤다.

- 사용자: "연결에 실패했어요. 다시 시도해 주세요" — 같은 이유로 다시 실패해도 알 길이 없음.
- 서버: `catch` 가 **에러 클래스명만** 분석 이벤트에 남기고 메시지를 버림.
  **state 불일치 경로는 기록이 아예 없었다**(`if (...) return fail("error")`).
- 라우트는 리디렉션(307)으로 끝나 **HTTP 상태로도 실패가 안 보이는 무음 실패**.

→ 그래서 7/15 캡처 중단 이후 진단이 불가능했다. 실제로 프로덕션 로그를 grep 해도 **gcal 관련 줄이 0건**이다.

## 진단에서 배제한 것 (실측)

| 가설 | 결과 |
|---|---|
| 연동 시도자가 registry 행이 없어 저장 실패 | ❌ 기각 — 관리자 계정도 행 보유(행25/trainer) |
| `AUTH_URL` 미설정 → redirect_uri 불일치로 구글이 거부 | ❌ 기각 — VPS `.env.local` 에 공개 도메인으로 설정돼 있음 |
| 기능 자체가 망가짐 | ❌ 기각 — 현재 **3개 계정이 정상 연결 상태**(S열 토큰 보유) |
| 실패 흔적이 레지스트리에 남음 | ❌ 없음 — 설정만 있고 토큰 없는 계정 0 |

즉 **상시 장애가 아니라 특정 조건에서만 실패**하며, 그 조건이 로그에 안 남아 미궁이었다.

## 수정

| 파일 | 변경 |
|---|---|
| `app/api/gcal/callback/route.ts` | 실패를 `GcalFailKind` 5종으로 분류(`denied`/`expired`/`unregistered`/`noconsent`/`error`). 모든 실패에서 **서버 로그에 원인 메시지**(이메일 마스킹) + 분석 이벤트에 사유 코드. state 실패는 **어느 조각이 비었는지**(code/state/cookie/match)까지 기록 |
| `GcalConnectCard.tsx` | 사유별 안내 문구 맵 — "다시 시도" 대신 **다음 행동**을 제시. 실패 토스트는 6초(읽을 시간) |
| `tests/api/gcal-callback-failure-kinds.test.ts` | 분류기 회귀 4종(알려진 두 원인이 서로·일반 폴백과 구분되는지) |

**로그 금지 유지**: refresh/access token·OAuth code 원문은 남기지 않는다. 화면 문구도 §4-1 금지 용어
(동기화·토큰·만료·OAuth·캘린더 ID) 미사용.

## 다음 발생 시 규명 절차 (1분)

```bash
pm2 logs salespt-log --lines 500 --nostream | grep gcal-callback
```
→ `kind=expired detail=code=有 state=有 cookie=無 match=false` 처럼 **원인이 바로 읽힌다**.
`kind` 별 빈도는 분석 이벤트(`gcal_connect_error`)로도 집계된다.

## 수용 기준

- [x] 모든 실패 경로가 로그를 남긴다(무기록 경로 0)
- [x] 알려진 두 원인이 사용자 행동으로 이어지는 문구로 분기
- [x] 토큰·code 미로깅 / 금지 용어 미노출
- [x] 회귀 테스트 + check.sh 초록
- [ ] 배포 후 재현 1회로 `kind` 확정 → 근본 원인 수정(필요 시 후속 PR)
- [ ] 해소 확인 시 USE08 캡처 재개 + 인시던트 문서 버그3 해소 표시
