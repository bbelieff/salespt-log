---
status: completed
slug: sheets-retry-no-proxy
created: 2026-05-19
completed: 2026-05-19
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: PR #244 Proxy 사고 fix — 명시적 메서드 wrapping 으로 변경
> - **누가 읽나요**: 개발자

# sheets-retry-no-proxy

## 사용자 보고 (2026-05-19)
"⚠ 불러오기 실패: 'get' on proxy: property 'spreadsheets' is a read-only and
non-configurable data property on the proxy target but the proxy did not return
its actual value (expected '#<c>' but got '#<c>')"

## Root Cause
PR #244 의 wrapWithRetry Proxy 가 모든 property access 를 가로채 nested Proxy
반환. googleapis 의 `spreadsheets` 는 non-configurable + read-only data property
→ Proxy invariant 위반 → 모든 sheets API 호출 실패.

## Fix
Proxy 제거. 명시적 메서드 wrapping:
- `patchMethods(obj, names)` — instance 에 메서드를 shadow 로 재정의
- spreadsheets.values.{get,batchGet,update,batchUpdate,append,clear,batchClear,...}
- spreadsheets.{get,batchUpdate,getByDataFilter}

기존 retry 로직 (1s→2s→4s→8s, jitter)은 그대로.

## Acceptance
- [ ] 페이지 로드 정상 (Proxy 에러 사라짐)
- [ ] 429 발생 시 자동 재시도 동작
- [ ] check.sh 통과
