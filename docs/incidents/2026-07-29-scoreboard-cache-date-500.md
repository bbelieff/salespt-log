# 2026-07-29 — 아레나 전광판 SSR 500 (unstable_cache Date 강등, 2번째 재발)

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: `/admin/arena/scoreboard` 가 캐시 히트 시 전면 500 — unstable_cache 에 Date 를 캐싱해 히트 시 string 으로 강등된 것이 원인이며, **me.ts 2026-05-13 과 동일한 실수 클래스의 2번째 재발**이다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/service/scoreboard.ts` · unstable_cache 를 쓰는 모든 코드
> - **읽고 나면 알 수 있는 것**: ① 왜 배포 없이 갑자기 터졌나? ② 왜 pm2 로그로 못 잡았나? ③ 재발 방지 하네스 갭은 무엇인가?
> - **관련 문서**: `docs/plans/completed/p0-scoreboard-cache-date-500.md` · `lib/service/me.ts` cachedReadBundle 주석(1차 사고)

## 타임라인 (KST)

- 시즌1 마감일, 해지 계약(02 AL 해지일)이 실데이터에 기입됨 — **코드 배포 없이** 잠복 경로 활성화.
- Cowork 가 admin 계정 재현 확정: Digest 4057402273, F5 지속 500. FOREMAN → DevA P0 배정.
- DevA: VPS pm2 로그 시도 → **앱 출력이 pm2 로그에 전혀 안 흐름**(out = next start 배너만,
  error = 0 bytes) → 스택 확보 실패. 로컬 실데이터 재현으로 전환.
- 재현 1차(unstable_cache 패스스루 목킹) = **성공** → 서비스 로직 무죄 → 캐시 직렬화 용의.
- 재현 2차(unstable_cache 를 JSON 왕복으로 목킹) = **throw 재현**:
  `TypeError: earlier.getTime is not a function` (week.ts diffDays ← weekIndexOf ←
  terminatedByWeek ← scoreboard.ts:139).

## 원인

- #550/#553 이 도입한 `cachedCourseStart` 가 **Date 를 unstable_cache 에 저장**.
  unstable_cache 는 JSON 직렬화 — **미스는 원본 Date, 히트는 string** 반환(타입은 Date 로
  거짓말 → typecheck 무력). string 이 `terminatedByWeek → weekIndexOf → .getTime()` 에서 throw.
- 단, 이 경로는 **해지 계약(해지일 + 유효 계약일)이 1건 이상**일 때만 실행 → 도입 후 수주간
  무증상, 시즌 마감에 해지가 기입되자 30분 캐시 창 전체가 500.
- 용의 배제 실측: #626(주차 SSOT)는 이전 구현과 `.getTime()` 의미 동일(무죄), #635/#636 무관.

## 수리 (fix/scoreboard-cache-date-500)

- 캐시 경계를 **"YYYY-MM-DD" 문자열**로 통일 + 캐시 키 v1→v2(오염 캐시 회피), 소비처 3곳
  `parseISO` 복원. me.ts 1차 사고의 확립 패턴(primitive 만 캐시) 준수.
- 회귀 테스트 `tests/service/scoreboard-cache-date.test.ts`: unstable_cache 를 JSON 왕복으로
  목킹 + 해지 계약 fixture → 번들 성공·차감 정합 고정.

## 하네스 갭 (Hashimoto — 같은 실수 2회)

1. **[미해결] unstable_cache + Date 구조 가드 부재** — 1차 사고(2026-05-13)는 me.ts 주석으로만
   남았고 기계검증이 없어 #550 이 재도입. 후속: unstable_cache 래핑 함수의 반환 타입에 Date 가
   포함되면 실패하는 구조 테스트(또는 lint) 필요.
2. **[미해결] pm2 로그에 앱 stdout/stderr 미유입** — 서버측 digest 스택 확보 불가로 진단이
   로컬 재현에 의존했다. next start 출력 파이프라인 점검 필요(별도 하네스 이슈).
3. **재현 레시피 박제** — "unstable_cache 용의 시 JSON 왕복 목킹으로 히트 경로를 모사"가
   이번 진단의 결정타. 회귀 테스트 상단 주석에 박제됨.
