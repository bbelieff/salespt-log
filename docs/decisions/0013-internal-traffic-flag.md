> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 관리자·대리접속(내부) 트래픽을 PostHog `is_internal` super property 로 태깅 — 수강생 지표에서 분리 필터 가능하게. PII 보호(ADR-0009)는 유지.
> - **누가 읽나요**: 개발자, 데이터 분석
> - **어떤 기능·작업과 연결?**: `lib/analytics/index.ts`(markInternal/clearInternal), `components/TopHeader.tsx`(identify), PostHog 인사이트 필터
> - **읽고 나면 알 수 있는 것**: 왜 분리하는지, PII 안전을 어떻게 유지하는지
> - **관련 문서**: `docs/decisions/0009-posthog-analytics.md`, `docs/plans/active/posthog-findings-2026-06-05.md`

- **Status**: accepted
- **Date**: 2026-06-06
- **Supersedes**: 없음 (ADR-0009 보완 — 식별 정책은 그대로, 내부 트래픽 태그만 추가)

# ADR-0013 — 내부(관리자·대리접속) 트래픽 필터링 (is_internal)

## 맥락
ADR-0009: impersonation(관리자 대리접속) 중에는 식별 skip(대상 PII 오염 방지). 부작용으로
**관리자 트래픽이 "미식별"로 수강생 분석에 섞여** DAU·퍼널을 부풀린다(2026-06-05 데일리:
실 수강생 DAU 6 vs 표면 13, 관리자 트래픽 34%).

## 결정
관리자 본인 세션과 대리접속 세션의 모든 이벤트에 **`is_internal:true` super property**
(+ `viewer_role`) 를 붙인다. PostHog 인사이트·대시보드는 **`is_internal=false`** 로 필터하여
실제 수강생만 집계한다.

- `lib/analytics`: `markInternal(viewerRole)` = `posthog.register({is_internal:true, viewer_role})`,
  `clearInternal()` = 해당 super property `unregister`.
- `TopHeader`: `sessionRole==="admin"` 또는 `impersonating` → `markInternal`; 일반 수강생 → `clearInternal`.
- **PII 보호 유지**: 대리접속 중에는 여전히 대상 학생으로 **identify 하지 않음**. is_internal 은
  슈퍼프로퍼티(이벤트 태그)일 뿐 person 식별이 아니다. 비-대리 관리자는 기존대로 role=admin 식별.
- 일반 수강생 이벤트에는 is_internal 미부착. 로그아웃(`resetUser`/`posthog.reset`)이 super property 도 초기화.

## 근거
- super property 는 person PII 없이 이벤트만 태깅 → ADR-0009 정책과 충돌 없음.
- 공용 브라우저에서 이전 관리자 세션 잔재 방지: 일반 수강생 진입 시 `clearInternal` 로 항상 제거.
