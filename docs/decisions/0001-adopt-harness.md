---
id: 0001
status: accepted
date: 2026-04-16
---

# 0001 — 하네스 엔지니어링 방법론 채택

## 맥락
Claude Code 기반 개발을 확장 가능하게 하려면 "더 똑똑한 프롬프트"가 아니라 **기계 검증 가능한 환경**이 필요하다.

## 결정
OpenAI Codex 팀의 Harness Engineering 방법론(Tools / Guardrails / Feedback / Observability 4요소)과 Hashimoto 원칙("같은 실수 → 환경을 고쳐라")을 이 레포의 개발 시스템으로 채택한다.
세부 규약은 `CLAUDE.md` 와 `docs/playbooks/` 에 둔다.

## 결과
- 모든 작업은 **워크트리 + active plan + `scripts/check.sh`** 통과를 요구.
- 에이전트의 실수는 프롬프트가 아니라 **하네스 패치**로 대응 (`docs/playbooks/fix-harness.md`).
- 이 ADR 은 supersede 되기 전까지 불변.
