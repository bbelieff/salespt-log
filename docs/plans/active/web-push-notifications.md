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

## 0.5 belie 결정 (2026-10-22) — 아래 본문은 이 결정을 반영했다

| 질문 | 결정 | 반영 위치 |
|---|---|---|
| 시범 대상 | belie + 수강생 3명(belie 지정). **실명·이메일은 레포에 적지 않고** VPS `.env` `PUSH_PILOT_EMAILS` 에만 둔다. 기기 종류는 시범 시작 때 확인 | §8 |
| 아침 알림 시각 | **08:45** 기본(수강생이 바꿀 수 있음) | §3-2, §4 |
| 업체명 | **기본으로 보인다**(숨기지 않음). 수강생이 설정에서 끌 수 있음 | §3-3, §3-4 |
| 비밀 키 | 수강생은 아무것도 안 한다. 서버가 "우리가 보낸 알림"임을 증명하는 서버 전용 도장이라 **에이전트가 단계 2 배포 때 VPS 에서 직접 만들어 `.env` 에 넣는다**(값은 화면·대화·로그에 안 나옴). belie 입력 불필요 | §5 |
| 알림 설정 | **수강생이 시간·주기·알림 종류·내용 종류를 직접 고른다** | §2-2 4번, §4 |

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
3. **허용 뒤** — 바로 시험 알림 1건("알림이 켜졌어요. 아침 8시 45분에 챙길 일을 알려 드릴게요." — 시각은 설정값)으로 실제 도착을 확인시킨다. 거부하면 "브라우저 설정에서 다시 켤 수 있어요" 한 줄만.
4. **알림 설정 화면** (belie 요청 2026-10-22 — 시범판에 포함). 지금 앱엔 설정 화면이 없으므로 새 화면 `/settings/notifications` 를 만들고 상단 내 메뉴와 안내 카드에서 연다.
   - 수강생이 직접 고르는 것 (시범판에 전부 포함):

     | 항목 | 고를 수 있는 값 | 기본값 |
     |---|---|---|
     | 알림 전체 | 켜기 / 끄기 | 켜기 |
     | **알림 종류** | ① 아침 「오늘 챙길 일」 ② 저녁 「오늘 마무리 + 내일 약속」 — 각각 켜기/끄기 | ① 켜기 ② 켜기 |
     | **시간** | 아침 07:00~11:00, 저녁 17:00~21:00, 15분 단위 | 아침 08:45, 저녁 18:00 |
     | **주기** | 매일 / 평일만(월~금) / 요일 직접 고르기 | 평일만 |
     | **내용 종류** | 밀린 약속 · 오늘 할 일 · 미팅 결과 · 첫 연락 DB · 다시 연락할 DB · 진행 멈춤 — 각각 켜기/끄기(끈 종류는 세지도 말하지도 않음) | 전부 켜기 |
     | **업체명 보이기** | 켜기 / 끄기 (끌 때 "잠금화면에 업체명이 안 보여요" 안내) | 켜기 |
     | 기기 | 알림 받는 기기 목록(예: "안드로이드 크롬", "아이폰 홈 화면 앱", "PC 크롬")과 기기별 해제 | — |
     | 시험 | [시험 알림 보내기] — 지금 설정 그대로 본인 기기에 1건(하루 3회까지) | — |

   - 서버가 지키는 선(설정으로 못 넘음): 하루 최대 2건(아침·저녁 각 1), 21:00~07:00 발송 없음, 0건이면 안 보냄.
   - 나중에 같은 화면에 붙일 종류: 새 기능 소식, 맞춤 정책공고.
   - 이 기기가 아직 구독 전이면 화면 위에 [이 기기에서 알림 받기] 버튼(§2-2 의 기기 판별 흐름 그대로). 브라우저 권한이 "차단"이면 기기별로 다시 켜는 방법을 한 줄로 안내.
   - 저장은 `push_preferences` 한 행. 끄기는 즉시 반영(다음 발송부터 대상 아님), 시간 변경은 다음 날부터.
5. **알림을 누르면** — 해당 화면으로 연다(`FollowUpItem.href` 재사용). 요약 알림은 대시보드 `/?from=push&d=<deliveryId>` 로 열고 「오늘 챙길 일」 카드에 포커스. 이미 열린 탭이 있으면 그 탭을 앞으로.

### 2-3. 이미 「홈 화면에 추가」한 수강생 (belie 질문 2026-10-22)

지금까지 "크롬 메뉴 → 홈 화면에 추가"로 안내해 왔다. 지금 배포된 앱 그대로는 알림이 **안 된다**(알림을 받는 서비스워커가 아직 없음). 시범판을 배포하면 **다시 설치할 필요 없이** 그 아이콘으로 열기만 하면 알림을 켤 수 있게 된다 — 서비스워커는 앱을 여는 순간 자동 등록된다.

| 기기 | 기존 아이콘으로 알림 | 근거 |
|---|---|---|
| 안드로이드 크롬 | **가능**(재설치 불필요). 크롬 알림은 사이트 단위라 아이콘이든 탭이든 같다 | 확인(크롬 표준 동작) |
| 아이폰 크롬으로 추가한 아이콘 | **추정 가능, 실기기 확인 필요**. 그 아이콘이 주소창 없이 전체 화면 앱으로 열리면(우리 앱은 `display: standalone` · `appleWebApp.capable` 설정됨, `app/manifest.ts:20` · `app/layout.tsx:37`) 홈 화면 웹앱이라 iOS 16.4+ 웹 푸시 조건을 갖춘다. 크롬 주소창이 보이며 열리면 단순 바로가기라 불가 | 1차 출처 미확인(병렬 조사 노트 6번) |
| 아이폰 사파리로 추가한 아이콘 | 가능(iOS 16.4+) | 확인(애플 공식) |

- **지금 바로 할 수 있는 확인**(코드 변경 0): 아이폰 수강생 1명이 홈 화면 아이콘을 눌렀을 때 ① 크롬 주소창이 보이는지 ② 설정 → 일반 → 정보에서 iOS 버전(16.4 이상인지). 주소창이 없으면 시범판에서 알림이 될 가능성이 높다.
- 안 되는 경우의 안내: 앱 안 아이폰 안내 3장에서 "사파리로 이 주소를 열고 공유 → 홈 화면에 추가" 로 바꿔 안내(설치 안내문 수정은 belie 몫).
- 매니페스트 아이콘 목록(`icons: []`)이 비어 있다. 안드로이드에서 "앱 설치"(WebAPK)가 아니라 바로가기로 만들어질 수 있으나 알림 동작에는 영향 없다. 정리 여부는 시범판에서 판단.

## 3. 메시지 설계

### 3-1. 톤 기준 (belie 예시 → 원칙)
- 사람이 묻는 말투, 존댓말, 1문장 + 짧은 꼬리. "~하세요" 명령 대신 "~해 보셨어요?" / "~있어요".
- 꾸짖기·남과 비교·연속 실패 강조 금지("또 안 적으셨네요" X). 듀오링고 비판(죄책감·다크패턴)을 피한다.
- **문턱을 작게**: "하나만 정리해도 돼요"처럼 최소 행동 제시.

### 3-2. 시각별 내용

| 시각 | 목적 | 시범(단계 2) | 이후 단계 |
|---|---|---|---|
| **08:45 아침**(설정 가능) | 오늘 움직일 거리 | ✅ 가장 급한 1건 콕 집기 + 전체 건수 | 문구 A/B |
| **18:00 저녁**(설정 가능) | 오늘 마무리 + **내일 전날 체크** | ✅ 내일 약속이 있으면 그것, 없으면 오늘 남은 일 | 오늘 기록 0이면 가벼운 안부 |

### 3-3. 「오늘 챙길 일」 kind → 문구 (업체명 보이기가 기본 — belie 결정)

`followUpHeadline()` 의 우선순위(overdue → meeting → today → initial → recontact → stalled)를 그대로 따르되, 수강생이 끈 내용 종류는 뺀다. 알림 1건에는 **가장 급한 항목 1개(업체명) + 전체 건수**.

| kind | 업체명 숨김(수강생이 끔) | 업체명 보이기(기본) |
|---|---|---|
| overdue | 밀린 약속 2건이 있어요. 하나만 먼저 정리해 볼까요? | ○○업체 「서류 보완 요청」 하기로 한 건 연락해 보셨어요? |
| meeting | 지난 미팅 결과가 1건 비어 있어요. 어떻게 됐는지 적어 둘까요? | ○○업체 미팅은 어떻게 됐어요? |
| today | 오늘 하기로 한 일이 3건 있어요. | 오늘 ○○업체 「기관 신청」 하기로 하셨어요. |
| initial | 아직 첫 연락 전인 DB가 5곳 있어요. | 새 DB ○○업체에 첫 연락 해 보셨어요? |
| recontact | 다시 연락할 때가 된 업체가 4곳 있어요. | ○○업체는 요즘 어때요? |
| stalled | 다음 진행을 정할 건이 2건 있어요. | ○○업체 다음 할 일이 비어 있어요. |
| (upcoming) | 알림 대상 아님(내일 전날 체크에서만 사용) | — |

- 제목은 고정 "경영일지", 본문은 위 문구 + 꼬리 "· 전체 N건". 시범은 두 열 모두 쓴다(설정값에 따라).
- **0건인 날**: 보내지 않는다(시범). 이후 단계에서 주 1회까지만 칭찬형("이번 주 챙길 일을 다 정리하셨어요 👏") 허용.
- **문구 풀**: kind 마다 2~3개 변형을 두고, 같은 사용자에게 최근 3회 보낸 변형은 쉬게 한다(듀오링고 KDD'20 "최근 문구 강등"). 시범은 kind 당 2개.
- **전날 체크(저녁 알림, 시범 포함)**: 저녁 시각에 `group === "upcoming"` 이고 `dueISO === 내일` 인 항목(할 일·미팅·다시 연락). "내일 ○○업체 연락하기로 하셨어요. 준비됐나요?"(숨김: "내일 하기로 한 일이 2건 있어요."). 내일 약속이 없으면 오늘 남은 일 중 가장 급한 1건, 그것도 0이면 안 보냄.

### 3-4. 잠금화면 노출 정책 (belie 결정: 업체명 보이기 기본)
- 기본 = **업체명 보임**. 금액·전화번호·메모는 어떤 설정에서도 넣지 않는다.
- 첫 알림 켜기 화면에 한 줄 고지: "잠금화면에 업체명이 보일 수 있어요. 설정에서 숨길 수 있어요."
- 업체명 보이기는 사용자 단위 설정(기기마다 다르게는 안 함).
- 서버 로그·발송 기록에는 문구 원문·업체명을 저장하지 않고 **문구 ID + 건수**만 저장.

### 3-5. 보내지 않는 조건(피로 방지)
- 하루 최대 **2건**(아침·저녁 각 1). 같은 날·같은 시각 슬롯 중복 금지(멱등키).
- 알림을 **14일 연속 안 누르고 앱도 안 열면** 주 2회로 줄이고, 28일이면 멈춘 뒤 "당분간 알림을 쉬어요. 설정에서 다시 켤 수 있어요" 1회(듀오링고 피로 대응). 시범 기간(2주)엔 적용하지 않고 기록만.
- 밤 21시~아침 7시 발송 금지(시각 설정 범위로 강제). 주기 설정(평일만·요일)에 없는 날은 안 보냄.
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
  morning_enabled boolean not null default true,
  morning_time text not null default '08:45' check (morning_time ~ '^(0[7-9]|10):(00|15|30|45)$|^11:00$'),
  evening_enabled boolean not null default true,
  evening_time text not null default '18:00' check (evening_time ~ '^(1[7-9]|20):(00|15|30|45)$|^21:00$'),
  weekdays smallint not null default 31 check (weekdays between 1 and 127), -- 요일 비트(월=1 … 일=64), 31 = 평일만
  kinds text[] not null default '{overdue,today,meeting,initial,recontact,stalled}', -- 받을 내용 종류
  show_company_names boolean not null default true,  -- belie 결정 2026-10-22
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
VPS cron (salespt-log 영역만, 매 15분 07:00~21:00 KST)
  └ curl -X POST http://127.0.0.1:3000/api/internal/push/dispatch  (헤더 X-Push-Cron: PUSH_CRON_SECRET)
      └ service/push-dispatch.ts
          1. 이번 슬롯 대상 = 활성 구독이 있고, 오늘 요일이 weekdays 에 들고, 아침/저녁 시각이 지금 15분 창에 드는 사용자 (+시범 허용 목록)
          2. 멱등키 insert ... on conflict do nothing → 이미 있으면 skip
          3. 재료 4종 로드(기존 서버 로더) → summarizeFollowUps(src, todayKST()) 재사용 → kinds 에 없는 종류 제외
          4. total=0 → status skipped_zero, 아니면 문구 선택(풀·쉬게 하기, show_company_names 에 따라 열 선택)
          5. web-push(VAPID) 로 그 사용자의 모든 활성 구독에 발송
          6. 404/410 → disabled_at 설정, 기타 실패 → failure_count++ (5회 연속이면 비활성)
```

- **라이브러리**: npm `web-push`(MIT, 무료). 외부 푸시 서비스(OneSignal·FCM 콘솔 가입 등) 쓰지 않음 — 수강생 정보가 밖으로 나가지 않는다. 발송은 브라우저 회사의 푸시 서버(구글·애플)를 거치지만 **본문은 암호화**되어 그들이 읽지 못한다(웹 푸시 표준).
- **비밀값(왜 필요한가)**: VAPID 키 = 구글·애플 푸시 서버에 "이 알림은 salesptlog.online 서버가 보낸 것"을 증명하는 **서버 전용 도장**. 수강생·belie 는 만지지 않는다. `VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`·`VAPID_SUBJECT`(mailto)·`PUSH_CRON_SECRET`·`PUSH_PILOT_EMAILS` 은 VPS `/opt/salespt-log/.env` 에만. **단계 2 배포 때 에이전트가 VPS 에서 직접 생성·추가**(값 미출력, `chmod 600` 유지). deploy.yml 의 주입은 `INJECT_KEYS` 목록의 키만 제자리 교체하므로(`.github/workflows/deploy.yml:84,94`) 직접 넣은 키는 배포로 지워지지 않는다. 공개키는 빌드에 굽지 않고 `GET /api/push/public-key` 로 내려 준다(빌드 시점 의존 제거).
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
| 잠금화면에 업체명 노출 | belie 결정으로 기본 보임 → 켜기 화면 고지 한 줄 + 설정에서 끄기 · 금액·전화·메모는 절대 미포함 · 기록에 원문 미저장 |
| 설정 조합이 복잡해 알림이 안 오는 것처럼 보임 | 설정 화면에 "다음 알림: 내일(금) 08:45" 미리보기 한 줄 + [시험 알림 보내기] |
| 서비스워커 버그가 앱 전체에 영향 | 푸시 전용(fetch 없음) · 등록은 시범 대상자만 · **킬 스위치**: `PUSH_ENABLED=0` 이면 발송 중단, `sw.js` 를 빈 동작 버전으로 교체하면 즉시 무력화 |
| 중복 발송(cron 겹침·재시도) | 멱등키 unique · cron 은 flock |
| VAPID 키 유출/분실 | `.env` 에만, 분실 시 새 키 = 전원 재구독 필요(시범 규모라 감수) |
| 시험 중 실제 수강생에게 발송 | 허용 목록(`PUSH_PILOT_EMAILS`) 밖은 발송 코드가 아예 돌지 않음 + 시험 테스트는 모의 sender |
| 다른 프로젝트 자원 침범 | cron·포트·pm2 를 salespt-log 것만 사용 |

## 8. 시범 계획 (단계 2 범위 = 여기까지)

- **대상**: belie + belie 가 지정한 수강생 3명(2026-10-22 확정, 실명·이메일은 VPS `.env` `PUSH_PILOT_EMAILS` 에만). 각자 기기(아이폰/안드로이드, 홈 화면 아이콘을 크롬으로 만들었는지)는 시범 시작 때 확인. PC 크롬 1대 이상.
- **메시지**: 아침 08:45 「오늘 챙길 일」(가장 급한 1건 + 전체 건수) + 저녁 18:00 「내일 약속 / 오늘 남은 일」. 업체명 보임이 기본. 0건이면 안 보냄. 모두 수강생 설정으로 바꿀 수 있음(§2-2 4번).
- **기간**: 2주(배포 후 영업일 10일).
- **만들 것**: 마이그레이션 0009 · `public/sw.js` · 구독/해제/설정 API · 안내 카드 + 아이폰 안내 · 알림 설정 화면 `/settings/notifications`(종류·시간·주기·내용 종류·업체명·기기 목록·시험 알림, §2-2 4번) · 내부 발송 API · cron 한 줄 · PostHog 이벤트 6개 · 단위시험(문구 선택·대상 계산·멱등·410 정리).
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
  - T9 알림 설정: 끄기 → 다음 발송 대상 아님 · 시간 9:00 으로 바꾸면 다음 날 9시 · 평일만 → 토·일 안 옴 · 「첫 연락 DB」 끄기 → 그 종류는 세지도 말하지도 않음 · 업체명 끄기 → 숨김 문구 · 기기 해제 → 그 기기만 안 옴 · 시험 알림 도착
  - T9b 저녁 알림: 내일 약속이 있으면 그 업체, 없으면 오늘 남은 일, 둘 다 0이면 안 옴
  - T10 기존 홈 화면 아이콘(재설치 없이): 안드로이드 크롬 / 아이폰 크롬으로 추가한 아이콘에서 켜기 → 도착
- **시범 후 결정**: 지표 3개 + 소감으로 belie 가 ① 전원 확대 ② 문구·시각 수정 후 재시범 ③ 중단 중 선택. 확대 시 새 기능 소식·맞춤 정책공고 알림 종류를 다음 단계로.
- **되돌리기**: `PUSH_ENABLED=0` → 발송 즉시 중단. 코드 = squash revert. 테이블은 남겨도 무해(읽는 코드 없으면 동작 0).

## 9. belie 결정 현황

- 2026-10-22 답변 4건 반영 완료(§0.5): 시범 3명 지정 · 아침 08:45 · 업체명 보임 · 수강생 직접 설정. 비밀 키는 에이전트가 서버에서 처리(belie 할 일 없음).
- 남은 것: **단계 2 시범판 착수 승인**(실제 운영 DB 에 새 테이블 3개 추가 + 배포가 따르므로 한 번 확인). 시범 3명의 기기 종류는 착수 후 확인.

## 10. 이후 확장 지점 (이번에 만들지 않음 — 막지만 않게)

- 18시 저녁 마감·전날 체크(§3-2/3-3) → `slot` 컬럼이 이미 있음.
- 비서가 볼 13가지 신호(핸드오프 §3) → kind 를 늘리면 문구표에 행 추가.
- 맞춤 정책공고 알림("○○업체(외 0개)에 맞는 공고 0건") → 새 `message_id` 계열.
- 알림 → 컨택 → 계약 매출 환산 → `push_deliveries.id` 출처 꼬리표.
- 하루 쉼 허용 연속 기록·점수·익명 등수·되찾기 이벤트(듀오링고 스트릭·복귀 이벤트) → 별도 설계.

## 11. 단계 2 구현 (2026-10-22 belie 승인 — 「이 설계대로 시범판 만들고 배포까지」)

브랜치 `feat/web-push-pilot`, base 84405f84.

| 영역 | 파일 |
|---|---|
| DB | `lib/repo/db/migrations/0009_web_push.sql`(테이블 3개, 추가만) · `lib/repo/db/push.ts` |
| 발송 | `lib/repo/push-sender.ts`(web-push 3.6.7, aes128gcm, TTL·Topic) |
| 규칙(순수) | `lib/service/push-schedule.ts`(KST 15분 눈금·요일·다음 알림) · `lib/service/push-messages.ts`(문구·변형 돌려쓰기·업체명 숨김) |
| 서비스 | `lib/service/push.ts`(시범 허용 목록·멱등 발송·410 정리·시험 알림 하루 3회) |
| API | `app/api/push`(GET 상태·PUT 설정) · `/subscriptions`(POST·DELETE) · `/test` · `/opened` · `app/api/internal/push/dispatch`(비밀 헤더 + Caddy 경유 거절) |
| 화면 | `/settings/notifications` · `components/push/*` · 대시보드 `PushPrompt` · 상단 메뉴 「알림 설정」(시범 대상만) |
| 서비스워커 | `public/sw.js`(push·notificationclick·pushsubscriptionchange만, fetch 처리기 없음) · `next.config.mjs` no-cache 헤더 · middleware 제외 |

### 운영 적용 절차 (배포 후, 에이전트 수행)
1. `/opt/salespt-log/.env` 에 추가(값 미출력, chmod 600 유지): `VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`(= `npx web-push generate-vapid-keys --json` 을 VPS 에서 실행), `VAPID_SUBJECT=mailto:<운영 메일>`, `PUSH_CRON_SECRET`(openssl rand 48), `PUSH_PILOT_EMAILS`(belie + 지정 3명의 로그인 이메일, registry 읽기로 확인). 이 키들은 deploy.yml INJECT_KEYS 밖이라 배포가 덮어쓰지 않는다.
2. `node scripts/db-migrate.mjs --dry-run` → `node scripts/db-migrate.mjs` (0009 만 새로 적용되는지 확인).
3. `pm2 reload salespt-log --update-env` 로 새 env 반영 → health 200.
4. root crontab 한 줄(salespt-log 전용, flock):
   `*/15 7-21 * * * flock -n /tmp/salespt-push.lock sh -c '. /opt/salespt-log/.env.push-cron; curl -fsS -m 120 -X POST -H "x-push-cron: $PUSH_CRON_SECRET" http://127.0.0.1:3000/api/internal/push/dispatch' >> /var/log/salespt-push.log 2>&1`
   (`.env.push-cron` = PUSH_CRON_SECRET 한 줄, chmod 600. 로그에는 집계 숫자만 남는다.)
5. 확인: 내부 호출 1회 → `{"tick":…,"candidates":0…}` 응답, 공개 주소로 같은 경로 POST → 404.
- 킬 스위치: `.env` 에 `PUSH_ENABLED=0` + `pm2 reload --update-env` → 모든 발송 즉시 중단. cron 줄 삭제로 시계 정지.

### 검증 기록
- 2026-10-22 운영 실측: #1191 배포·0009 적용 후 서버 안 호출이 404 — `next start` 가 로컬 curl 에도 X-Forwarded-For(127.0.0.1)를 붙여 「헤더 없음」 조건이 막았다. 「모든 홉이 루프백일 때만」으로 수정(fix/push-dispatch-local-check). 공개 주소 POST 는 404 유지.
- 집중시험: push-schedule·push-messages·push-device·push-dispatch·dispatch route·sw 구조 = 30+개 PASS. 구조시험 20파일 103개 PASS. tsc·lint PASS. doc-drift PASS.
- 운영 반영 2026-10-22: #1191·#1192 배포 success, 0009 적용, cron 가동, 서버 안 호출 200·공개 404 확인. 구독 0대.
- 실기기 T1~T10: belie·시범 3명 폰에서 확인 필요(에이전트는 실제 폰이 없어 NOT_RUN).

## 진행 기록

- 2026-10-22 belie 결정 반영: 08:45·업체명 보임·수강생 설정(종류·시간·주기·내용 종류)·저녁 알림 시범 포함·VAPID 는 에이전트가 VPS 에서 생성(§0.5).
- 2026-10-22 belie 추가 요청: 알림 설정 화면을 시범판에 포함(§2-2 4번), 기존 「홈 화면에 추가」 아이콘으로 가능한지(§2-3), 점검 T9·T10 추가.
- 2026-10-22 설계안 작성(코드 변경 0). 검증: docs-only — `check.sh` 는 의존성 미설치 워크트리라 NOT_RUN(CLAUDE §6.9 문서 전용 npm ci 금지), CI 가 검증. belie 승인 대기.
