> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 앱을 열지 않아도 수강생 폰(안드로이드·아이폰 홈 화면 앱)과 PC 크롬으로 「오늘 챙길 일」을 알려 주는 웹 푸시의 설계안과 2주 시범 계획.
> - **누가 읽나요**: belie(승인), 개발자/에이전트(단계 2 구현)
> - **어떤 기능·작업과 연결?**: `lib/analytics/dashboard-follow-ups.ts`(알림 재료), `app/manifest.ts`, 새 서비스워커 `public/sw.js`, 새 DB 테이블 3개, VPS 예약 작업
> - **읽고 나면 알 수 있는 것**: 수강생이 알림을 켜는 순서 · 무슨 말을 언제 보내는지 · 무엇을 저장·측정하는지 · 시범을 어떻게 돌리는지
> - **관련 문서**: [extensions.md §2 푸시 알림](../../future/extensions.md) · [dashboard-follow-ups plan](dashboard-follow-ups.md) · [ADR-0009 PostHog](../../decisions/0009-posthog-analytics.md) · [ADR-0028 구글캘린더](../../decisions/0028-user-gcal-oauth-token.md) · [deploy-vps](../../playbooks/deploy-vps.md)

# 웹 푸시 알림 — 설계안 (단계 1, 승인 대기)

- 상태: **설계만. 코드 변경 0.** belie 승인 뒤 단계 2(시범판)로 간다.
- 기준: origin/master `2e6e1208`(#1188), 2026-10-22 읽기 조사. 브랜치 `docs/web-push-notifications-plan`.
- 근거: 「돋보기 산파술」 결론(핸드오프 `_docs/경영일지_알림설계_핸드오프_20261022.md`) + 듀오링고 공개자료 벤치마크(같은 파일).

## 0. 한 줄 목표와 왜

수강생이 기록한 건 기능 덕이 아니라 belie 의 전화 덕이었다. 수료하면 전화가 끊기고 사용이 0에 가까워진다.
「오늘 챙길 일」은 이미 할 일을 정확히 찾지만 **앱을 열어야만 보인다.** 그래서 알림이 **belie 전화를 대신**한다.
원칙: 일반 독촉("기록하세요")이 아니라 **내 고객·내 약속·내 빈칸을 콕 집어** 묻는다. 꾸짖거나 남과 비교하지 않는다.

착수 조건 확인: extensions.md §2 의 "기록 일관성 70% 이하"는 이미 충족(최근 28일 기록일 60% 넘는 사람 1명, 날짜 지난 Todo 미체크 60% — 2026-10-19 DB 집계, 핸드오프 §2).

## 1. 현재 상태 (실측, origin/master 2e6e1208)

| 항목 | 상태 | 근거 |
|---|---|---|
| 서비스워커·웹푸시·예약 발송 | 0건 | `git grep` serviceWorker/push/cron 결과 없음 |
| PWA | `app/manifest.ts` 만(display standalone, 아이콘은 `app/icon.tsx`·`app/apple-icon.tsx`) | `app/manifest.ts:14` |
| 「오늘 챙길 일」 계산 | **순수 함수** `summarizeFollowUps(src, today)` — 화면(클라이언트)에서만 호출 | `lib/analytics/dashboard-follow-ups.ts:162`, `components/dashboard/DashboardFollowUps.tsx:21` |
| 재료 4종 서버 로더 | 모두 이메일만 받으면 서버에서 읽을 수 있음 | `loadContractPayments(email)` · `listAllTodos(email)` · `loadFollowUpMeetings(email, through)` · `loadDbSheet(resolveDbSheetContext(email))` (각 `app/api/*/route.ts`) |
| 앱 밖 통로 | 구글캘린더 단방향 동기화(연결자만, 알림 미지정) | `lib/service/gcal-sync.ts`, ADR-0028 |
| 카톡 인앱 감지 | 이미 있음(`kakaotalk://web/openExternal` 로 외부 크롬) | `components/auth/WebviewWarning.tsx:38,72` |
| 분석 | PostHog `EVENTS` 상수, 속성은 비-PII 만 | `lib/analytics/index.ts:26`, ADR-0009 §5 |
| DB | Postgres, 마이그레이션 `lib/repo/db/migrations/0001~0008`, 사용자 자연키 `(email, cohort)` | `0001_users_cohorts.sql:17` |

→ 새로 만들 것은 **통로(구독·발송)** 뿐이고, **무엇을 말할지(규칙)는 기존 함수를 그대로 재사용**한다. 화면과 알림이 다른 숫자를 말하는 일이 없도록.

## 2. 사용자 흐름

### 2-1. 기기별로 알림을 받을 수 있는 조건

| 기기 | 조건 | 확실성 |
|---|---|---|
| 안드로이드 크롬 | 사이트에서 권한 허용만 | 확인(표준 동작) |
| PC 크롬·엣지 | 권한 허용만(브라우저가 꺼져 있으면 못 받음) | 확인(표준 동작) |
| 아이폰 사파리 | iOS 16.4+ · **홈 화면에 추가한 아이콘으로 열고** · 버튼 탭으로 권한 요청 | 확인(애플 공식) |
| 아이폰 크롬에서 홈 화면 추가 | iOS 16.4+ 부터 크롬도 공유 메뉴 → 홈 화면 추가 가능. 추가된 아이콘이 푸시를 받는지는 | **추정 — 실기기 확인 필수**(시범 T2) |
| 카톡 인앱브라우저 | 받지 못한다고 보고 처리 | 추정 → 기존 외부 브라우저 안내 재사용 |

### 2-2. 흐름 (권한은 첫 화면에서 바로 묻지 않는다)

1. **알림 안내 카드** — 대시보드 「오늘 챙길 일」 카드 아래에 작은 카드 1개.
   문구: "챙길 일을 아침에 폰으로 알려 드릴까요? 앱을 안 열어도 놓치지 않게요." [알림 받기] [나중에]
   - 노출 조건: 로그인 3회 이상 또는 첫 기록 저장 후(가치를 먼저 본 뒤). [나중에] → 7일 숨김. 3번 거절하면 설정 화면에만 남김.
   - 시범 기간엔 **시범 대상자에게만** 보인다(§7 기능 스위치).
2. **기기 판별 후 분기**
   - 안드로이드/PC 크롬 → [알림 받기] 탭 = 브라우저 권한 창.
   - 아이폰 + 일반 탭(홈 화면 앱 아님) → 권한 창 대신 **3장짜리 안내**: ① 공유 버튼 → ② "홈 화면에 추가" → ③ 홈 화면 아이콘으로 열고 다시 [알림 받기]. iOS 16.4 미만이면 "아이폰 업데이트 후 가능" 안내.
   - 카톡 인앱 → 기존 `WebviewWarning` 의 외부 브라우저 열기로 보낸다.
3. **허용 뒤** — 바로 시험 알림 1건("알림이 켜졌어요. 내일 아침 8시에 챙길 일을 알려 드릴게요.")으로 실제 도착을 확인시킨다. 거부하면 "브라우저 설정에서 다시 켤 수 있어요" 한 줄만.
4. **설정 화면**(설정 메뉴 안 「알림」 한 줄): 켜기/끄기 · 아침 알림 시간(기본 08:00, 07~10시 30분 단위) · 저녁 알림(시범엔 숨김) · **알림에 업체명 보이기(기본 끔)** · 이 기기 해제. 기기별 구독 목록(예: "안드로이드 크롬", "아이폰 홈 화면")을 보여 준다.
5. **알림을 누르면** — 해당 화면으로 연다(`FollowUpItem.href` 재사용). 요약 알림은 대시보드 `/?from=push&d=<deliveryId>` 로 열고 「오늘 챙길 일」 카드에 포커스. 이미 열린 탭이 있으면 그 탭을 앞으로.

## 3. 메시지 설계

### 3-1. 톤 기준 (belie 예시 → 원칙)
- 사람이 묻는 말투, 존댓말, 1문장 + 짧은 꼬리. "~하세요" 명령 대신 "~해 보셨어요?" / "~있어요".
- 꾸짖기·남과 비교·연속 실패 강조 금지("또 안 적으셨네요" X). 듀오링고 비판(죄책감·다크패턴)을 피한다.
- **문턱을 작게**: "하나만 정리해도 돼요"처럼 최소 행동 제시.

### 3-2. 시각별 내용

| 시각 | 목적 | 시범(단계 2) | 이후 단계 |
|---|---|---|---|
| **08:00 아침** | 오늘 움직일 거리 | ✅ 요약 1건: "오늘 챙길 일 N건" | 가장 급한 1건 콕 집기 |
| 18:00 저녁 | 오늘 기록 마감 + **내일 전날 체크** | ❌ | "내일 ○○업체 연락하기로 하셨어요" / 오늘 기록 0이면 가벼운 안부 |

### 3-3. 「오늘 챙길 일」 kind → 문구 (업체명 숨김이 기본)

`followUpHeadline()` 의 우선순위(overdue → meeting → today → initial → recontact → stalled)를 그대로 따른다. 알림 1건에는 **가장 앞선 종류 1개 + 전체 건수**만.

| kind | 업체명 숨김(기본) | 업체명 보이기(사용자가 켬, 이후 단계) |
|---|---|---|
| overdue | 밀린 약속 2건이 있어요. 하나만 먼저 정리해 볼까요? | ○○업체 「서류 보완 요청」 하기로 한 건 연락해 보셨어요? |
| meeting | 지난 미팅 결과가 1건 비어 있어요. 어떻게 됐는지 적어 둘까요? | ○○업체 미팅은 어떻게 됐어요? |
| today | 오늘 하기로 한 일이 3건 있어요. | 오늘 ○○업체 「기관 신청」 하기로 하셨어요. |
| initial | 아직 첫 연락 전인 DB가 5곳 있어요. | 새 DB ○○업체에 첫 연락 해 보셨어요? |
| recontact | 다시 연락할 때가 된 업체가 4곳 있어요. | ○○업체는 요즘 어때요? |
| stalled | 다음 진행을 정할 건이 2건 있어요. | ○○업체 다음 할 일이 비어 있어요. |
| (upcoming) | 알림 대상 아님(내일 전날 체크에서만 사용) | — |

- 제목은 고정 "경영일지", 본문은 위 문구 + 꼬리 "· 전체 N건". 시범 문구는 위 표의 **업체명 숨김 열**만 쓴다.
- **0건인 날**: 보내지 않는다(시범). 이후 단계에서 주 1회까지만 칭찬형("이번 주 챙길 일을 다 정리하셨어요 👏") 허용.
- **문구 풀**: kind 마다 2~3개 변형을 두고, 같은 사용자에게 최근 3회 보낸 변형은 쉬게 한다(듀오링고 KDD'20 "최근 문구 강등"). 시범은 kind 당 2개.
- **전날 체크(이후 단계)**: 18시에 `group === "upcoming"` 이고 `dueISO === 내일` 인 항목. "내일 ○○업체 연락하기로 하셨어요. 준비됐나요?"(숨김: "내일 하기로 한 일이 2건 있어요.")

### 3-4. 잠금화면 노출 정책
- 기본 = **업체명·금액·전화번호 없음**. 잠금화면에 보여도 남이 알 수 없는 말만.
- 업체명 보이기는 사용자가 설정에서 직접 켤 때만(기기 단위 아님, 사용자 단위). 켜는 순간 "잠금화면에 업체명이 보일 수 있어요" 확인.
- 서버 로그·발송 기록에는 문구 원문을 저장하지 않고 **문구 ID + 건수**만 저장.

### 3-5. 보내지 않는 조건(피로 방지)
- 하루 최대 **2건**(시범은 1건). 같은 날·같은 시각 슬롯 중복 금지(멱등키).
- 알림을 **14일 연속 안 누르고 앱도 안 열면** 주 2회로 줄이고, 28일이면 멈춘 뒤 "당분간 알림을 쉬어요. 설정에서 다시 켤 수 있어요" 1회(듀오링고 피로 대응). 시범 기간(2주)엔 적용하지 않고 기록만.
- 밤 21시~아침 7시 발송 금지(시각 설정 범위로 강제).
- 수료(archived) 사용자도 본인이 켠 구독은 유지(ADR-0031 무제한 CRM). 다만 시범 대상 외 자동 발송 없음.

## 4. 데이터 (마이그레이션 0009, 단계 2에서 추가)

사용자 연결 키는 `email`(`0001_users_cohorts.sql` 주석 권고 — 기수 행이 바뀌어도 끊기지 않게). id 는 앱이 `crypto.randomUUID()` 로 생성(기존 관례).

```sql
-- 0009_web_push.sql (초안 — 단계 2 에서 확정)
create table if not exists public.push_subscriptions (
  id uuid primary key,
  email text not null,
  endpoint text not null unique,          -- 브라우저 푸시 주소(그 자체가 비밀은 아니나 로그 금지)
  p256dh text not null, auth text not null,
  platform text not null check (platform in ('android','ios_pwa','desktop','other')),
  browser text not null default '',       -- chrome / safari / edge … (UA 원문 저장 안 함)
  created_at timestamptz not null default now(),
  last_success_at timestamptz, last_failure_at timestamptz,
  failure_count int not null default 0,
  disabled_at timestamptz                 -- 404/410 또는 사용자 해제
);
create index if not exists push_subscriptions_email_idx on public.push_subscriptions (email) where disabled_at is null;

create table if not exists public.push_preferences (
  email text primary key,
  enabled boolean not null default true,
  morning_time text not null default '08:00',
  evening_enabled boolean not null default false,
  show_company_names boolean not null default false,
  prompt_dismissed_count int not null default 0, prompt_snoozed_until date,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_deliveries (
  id uuid primary key,
  idempotency_key text not null unique,   -- '<email>:<YYYY-MM-DD KST>:<slot morning|evening|test>'
  email text not null, slot text not null, local_date date not null,
  message_id text not null,               -- 예: 'morning.overdue.v1' (문구 원문 저장 안 함)
  item_count int not null,
  status text not null check (status in ('sent','skipped_zero','skipped_cap','failed')),
  devices_sent int not null default 0, devices_failed int not null default 0,
  created_at timestamptz not null default now(),
  opened_at timestamptz                   -- 알림 탭으로 들어온 첫 시각(출처 꼬리표)
);
```

- **출처 꼬리표 대비**: 알림 링크에 `from=push&d=<delivery id>` → 앱이 `opened_at` 기록 + PostHog `push_opened`. 나중에 "알림 → 컨택 → 계약" 환산은 이 id 로 이어 붙인다(이번엔 기록만).
- **SSOT 4문서 갱신**(단계 2 같은 PR): 새 Zod 타입 → `docs/domains/data-model.md`, 새 컴포넌트 → `docs/design/components.md`.
- 보존: 발송 기록 180일 후 삭제 작업은 이후 단계. 운영 DB 적용은 기존 `scripts/db-migrate.mjs` 절차(dry-run → 승인 범위 확인).

## 5. 발송 구조

```
VPS cron (salespt-log 영역만, 매 30분 07:00~21:00 KST)
  └ curl -X POST http://127.0.0.1:3000/api/internal/push/dispatch  (헤더 X-Push-Cron: PUSH_CRON_SECRET)
      └ service/push-dispatch.ts
          1. 이번 슬롯 대상 = enabled 구독이 있고 morning_time 이 지금 30분 창에 드는 사용자 (+시범 허용 목록)
          2. 멱등키 insert ... on conflict do nothing → 이미 있으면 skip
          3. 재료 4종 로드(기존 서버 로더) → summarizeFollowUps(src, todayKST()) 재사용
          4. total=0 → status skipped_zero, 아니면 문구 선택(풀·쉬게 하기)
          5. web-push(VAPID) 로 그 사용자의 모든 활성 구독에 발송
          6. 404/410 → disabled_at 설정, 기타 실패 → failure_count++ (5회 연속이면 비활성)
```

- **라이브러리**: npm `web-push`(MIT, 무료). 외부 푸시 서비스(OneSignal·FCM 콘솔 가입 등) 쓰지 않음 — 수강생 정보가 밖으로 나가지 않는다. 발송은 브라우저 회사의 푸시 서버(구글·애플)를 거치지만 **본문은 암호화**되어 그들이 읽지 못한다(웹 푸시 표준).
- **비밀값**: `VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`·`VAPID_SUBJECT`(mailto)·`PUSH_CRON_SECRET` 은 VPS `.env` 에만. 공개키만 클라이언트에 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` 로. deploy.yml `INJECT_KEYS` 추가는 deploy-vps.md 「Secret 추가 절차」대로 별도 검토, 값은 belie/운영자가 GitHub Secrets 에 직접 입력.
- **왜 앱 안 API + cron curl 인가**: 기존 서비스·레포·경로별칭을 그대로 쓰고(규칙 중복 0), 별도 상주 프로세스를 만들지 않는다. 내부 경로는 `127.0.0.1` 바인딩 + 비밀 헤더로만 허용하고 Caddy 공개 경로에서 막는다.
- **레이어**: `web-push` import 는 `lib/repo/push-sender.ts` 한 곳(외부 I/O 는 repo 구역 — Sheets 격리 규칙과 같은 원리). 문구 선택·대상 계산은 `lib/service/push-*.ts` 순수 함수로 두고 단위시험.
- **요청 경로 시트 호출 금지 가드**(`sheets-request-path-guard.test.ts`)와 충돌 없음: 재료 로더는 활성 기수 전부 DB 정본. 비활성 레거시 기수(1·2·3·5기)는 시범 대상 외.
- **동시성**: 한 번 실행 시 사용자를 순서대로 처리(시범 ≤5명). 대상이 100명을 넘으면 동시 5개 제한으로 바꾼다(이후).
- **서비스워커 `public/sw.js`**: `push`·`notificationclick`·`pushsubscriptionchange` 3개 이벤트만. **`fetch` 처리기 미등록(빈 처리기도 금지)·캐시·오프라인 없음**(BBE-242 로딩 작업과 충돌 방지). `Cache-Control: no-cache` 로 서빙해 업데이트가 즉시 반영되게, 파일 안에 버전 상수.
- **운영 보호**: cron 은 salespt-log 사용자 crontab 한 줄만 추가. 모아워크(:3100)·카페봇·헤르메스 자원 접근 없음. pm2 설정 변경 없음.

### 5-1. 플랫폼 사실로 정해지는 구현 규칙 (1차 출처 검증, 2026-10-22 병렬 조사 노트 `webpush-platform-facts-20261022.md`)
- **조용한 푸시 금지**: 받은 푸시는 반드시 알림을 띄운다(안 띄우면 Safari 가 권한 회수). 그래서 「0건이면 안 보냄」은 **서버에서 발송 자체를 생략**한다 — 받고 나서 숨기지 않는다.
- **아이폰 권한 요청**은 버튼 클릭 처리 안에서 바로 `subscribe` (지연·비동기 뒤 호출 금지).
- **알림 모양**: iOS 는 actions·image·badge·requireInteraction·vibrate·renotify 미지원 → `title`·`body`·`icon` 만 쓰고, 이동 URL·delivery id 는 `data` 에 넣는다.
- **전송 헤더**: 페이로드 ≤ 4KB, `TTL` 필수(아침 알림 = 4시간, 지나면 의미 없음), `Urgency: normal`, `Topic` = 슬롯 키(32자 이내 — 같은 topic 은 대기 중 알림을 덮어써 중복 방지 보조).
- **응답 처리**: 404/410 = 구독 비활성, 413 = 크기 초과(문구 버그로 기록), 429 = `Retry-After` 준수, 403 = VAPID 설정 문제(전체 발송 중단·경보).
- **서비스워커에 fetch 처리기를 아예 등록하지 않는다**(빈 처리기도 페이지 이동마다 SW 를 깨워 비용) → BBE-242 로딩 속도와 충돌 없음.
- **크롬 남용 알림 제재**(남용 판정 시 권한 요청이 조용한 UI·차단으로 바뀜) → 하루 상한·반복 금지는 정책상으로도 필수.
- **카톡 인앱**: 공식 문서 없음. UA `KAKAOTALK` + `'PushManager' in window && 'serviceWorker' in navigator` 기능 확인으로 판정, 기존 `kakaotalk://web/openExternal`(비공식 경로) 안내 재사용.
- `web-push` npm 3.6.7(2024-01 이후 릴리스 없음, 저장소 활동 중) — 사용 가능. 단계 2 에서 aes128gcm 인코딩 기본값 확인.
- 확장 후보: `navigator.setAppBadge(N)` (iOS 16.4+ 홈 화면 앱 지원) — 앱 아이콘에 「오늘 챙길 일」 숫자. 이번 시범 범위 밖.

## 6. 측정

| PostHog 이벤트(새 `EVENTS` 상수) | 언제 | 속성(비-PII만) |
|---|---|---|
| `push_prompt_shown` | 안내 카드 노출 | platform, standalone |
| `push_prompt_result` | 카드 버튼 결과 | result: accepted/denied/later/ios_guide |
| `push_subscribed` / `push_unsubscribed` | 구독 생성/해제 | platform, browser |
| `push_opened` | `from=push` 로 들어옴 | slot, message_id, item_count |
| `push_settings_changed` | 설정 저장 | field, value(시간·불리언만) |

- 서버 발송 수는 PostHog 대신 `push_deliveries` 집계(서버에서 PostHog 로 보내는 코드가 아직 없으므로 새로 만들지 않는다).
- 시범 판정 지표 3개:
  1. **도착률** = 발송 성공 기기 / 시도 기기 (목표 ≥ 90%)
  2. **누른 비율** = `opened_at` 있는 발송 / 성공 발송 (목표 ≥ 20% — 업계 평균 비교값은 근거 미확인이라 쓰지 않고, 시범 결과를 다음 기준으로 삼는다)
  3. **알림 후 당일 기록 여부** = 발송일에 일일 기록·Todo 체크·DB 연락 중 하나라도 저장한 비율 — 시범 전 2주(같은 사람)와 비교
- 사람 수가 적어(4명) 통계 검정은 하지 않는다. 숫자 + 각 사람 소감 한 줄로 판단. A/B(문구·시각 나눠 보내기)는 대상이 20명 넘을 때부터.

## 7. 위험과 대응

| 위험 | 대응 |
|---|---|
| 아이폰 미수신(홈 화면 추가 안 함, iOS 16.4 미만, 크롬 추가 아이콘 미지원) | 기기 판별 안내 3장 · 시범 T2 에서 크롬 추가 아이콘 실측, 안 되면 "사파리에서 추가" 로 문구 고정 · 구독 목록에 기기 표시 |
| 아이폰 "집중 모드"·알림 요약으로 늦게 보임 | 통제 불가 — 시범 소감에서 확인만 |
| 스팸 피로로 알림 끄기 | 0건 안 보냄 · 하루 상한 · 문구 풀 · 무반응 감속(§3-5) |
| 잠금화면에 업체명 노출 | 기본 숨김, 사용자 단위 opt-in, 기록에 원문 미저장 |
| 서비스워커 버그가 앱 전체에 영향 | 푸시 전용(fetch 없음) · 등록은 시범 대상자만 · **킬 스위치**: `PUSH_ENABLED=0` 이면 발송 중단, `sw.js` 를 빈 동작 버전으로 교체하면 즉시 무력화 |
| 중복 발송(cron 겹침·재시도) | 멱등키 unique · cron 은 flock |
| VAPID 키 유출/분실 | `.env` 에만, 분실 시 새 키 = 전원 재구독 필요(시범 규모라 감수) |
| 시험 중 실제 수강생에게 발송 | 허용 목록(`PUSH_PILOT_EMAILS`) 밖은 발송 코드가 아예 돌지 않음 + 시험 테스트는 모의 sender |
| 다른 프로젝트 자원 침범 | cron·포트·pm2 를 salespt-log 것만 사용 |

## 8. 시범 계획 (단계 2 범위 = 여기까지)

- **대상**: belie + 잘 쓰는 수강생 3명(**명단은 belie 확인 필요**), 아이폰·안드로이드 섞어서(가능하면 아이폰 2·안드로이드 2), PC 크롬 1대 이상.
- **메시지**: 08시 「오늘 챙길 일 N건」 1종(§3-3 숨김 열), 0건이면 안 보냄. 저녁 알림·업체명 보이기·전날 체크는 꺼 둠.
- **기간**: 2주(배포 후 영업일 10일).
- **만들 것**: 마이그레이션 0009 · `public/sw.js` · 구독/해제/설정 API · 안내 카드 + 아이폰 안내 · 설정의 알림 한 줄(켜기·시간·기기 해제) · 내부 발송 API · cron 한 줄 · PostHog 이벤트 6개 · 단위시험(문구 선택·대상 계산·멱등·410 정리).
- **안 만들 것**: 설치형 앱, 맞춤 정책공고, 세줄일기, 점수·등수, 알림톡, 외부 푸시 서비스, A/B.
- **검증 체크리스트(PASS/FAIL/NOT_RUN 로 기록)**
  - T1 안드로이드 크롬: 권한 → 시험 알림 도착 → 탭 → 대시보드 이동
  - T2 아이폰 사파리 홈 화면 앱 / T2b 아이폰 크롬에서 추가한 홈 화면 앱: 같은 3단계
  - T3 PC 크롬: 같은 3단계(브라우저 꺼짐 시 미수신 확인)
  - T4 카톡 인앱: 외부 브라우저 안내가 뜨는지
  - T5 0건 사용자: 발송 안 됨(`skipped_zero`)
  - T6 같은 슬롯 두 번 실행: 1건만
  - T7 구독 해제 후: 발송 대상 아님 · 브라우저에서 권한 회수 → 410 → 비활성
  - T8 화면과 알림 숫자 일치: 같은 시각 대시보드 「오늘 챙길 일」 건수 = 알림 N
- **시범 후 결정**: 지표 3개 + 소감으로 belie 가 ① 전원 확대 ② 문구·시각 수정 후 재시범 ③ 중단 중 선택. 확대 시 18시 저녁·전날 체크·업체명 opt-in 을 다음 단계로.
- **되돌리기**: `PUSH_ENABLED=0` → 발송 즉시 중단. 코드 = squash revert. 테이블은 남겨도 무해(읽는 코드 없으면 동작 0).

## 9. belie 결정이 필요한 것 (단계 2 착수 전)

1. 이 설계로 시범판을 만들어도 되는가(승인).
2. 시범 수강생 3명 명단(아이폰/안드로이드 표기).
3. 아침 알림 기본 시각 08:00 유지?(시범 중 사용자가 바꿀 수 있음)
4. 업체명은 기본 숨김으로 시작하는 데 동의?
5. VAPID 키를 VPS `.env`·GitHub Secrets 에 넣는 작업(무료, 값은 운영자가 직접 입력).

## 10. 이후 확장 지점 (이번에 만들지 않음 — 막지만 않게)

- 18시 저녁 마감·전날 체크(§3-2/3-3) → `slot` 컬럼이 이미 있음.
- 비서가 볼 13가지 신호(핸드오프 §3) → kind 를 늘리면 문구표에 행 추가.
- 맞춤 정책공고 알림("○○업체(외 0개)에 맞는 공고 0건") → 새 `message_id` 계열.
- 알림 → 컨택 → 계약 매출 환산 → `push_deliveries.id` 출처 꼬리표.
- 하루 쉼 허용 연속 기록·점수·익명 등수·되찾기 이벤트(듀오링고 스트릭·복귀 이벤트) → 별도 설계.

## 진행 기록

- 2026-10-22 설계안 작성(코드 변경 0). 검증: docs-only — `check.sh` 는 의존성 미설치 워크트리라 NOT_RUN(CLAUDE §6.9 문서 전용 npm ci 금지), CI 가 검증. belie 승인 대기.
