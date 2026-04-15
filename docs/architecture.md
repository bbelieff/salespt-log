---
status: draft
---

# Architecture Map

레이어 (단방향 의존):

```
Types → Config → Repo → Service → Runtime → UI
```

상위는 하위를 import 할 수 없다. 위반은 `tests/structural/`에서 감지한다.

## 도메인

(여기에 도메인 목록과 각 `docs/domains/<name>.md` 링크를 유지.)

- 예시: [[docs/domains/example.md]]

## UI Boundary

UI 레이어는 Repo에 직접 접근할 수 없다. 반드시 Service 경유.
