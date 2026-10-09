# 개발 세션 시작
> **요약**: 과거 controller/registry 전체 대신 현재 요청에서 시작한다.
> **관련**: [AGENTS](../../AGENTS.md)·[CLAUDE](../../CLAUDE.md)·[worklog](../worklog.md).

1. 현재 목표·범위·완료조건 확인.
2. AGENTS·CLAUDE·[현행 workflow](../development/workflow.md)·worklog 최근 관련 항목·해당 plan/SSOT/ADR 읽기. 역할은 총괄·제작·독립 검증이며 필요한 역할 문서만 추가로 읽는다.
3. 실제 저장소·환경·모델·gh 인증·master·열린 PR·현재 소유 확인.
4. 메인 수정 금지, 전용 worktree. 이미 있는 기능 중복 구현 금지.
5. 주문→설계→프로덕션 재사용 목업→사용자 승인→구현/독립 검증→직렬 병합/배포/운영 확인. 승인본·현재 head·검사 증거를 전달하고 승인 후 단계별 재승인을 묻지 않는다. 명시적 직접 구현·목업 생략·검토만·배포 보류는 그 제한 유지.
6. 병렬이 실제 필요할 때만 담당·파일·전달/ACK·반환처 지정.

과거 provider-status/session-registry/dispatch-queue·takeover는 역사 자료다. 사용자 요청/현재 과업이 특정 큐를 명시한 경우만 읽고 최신 상태를 확인한다. 자동 controller 교대·옛 미완료 재개·writer 변경 근거로 쓰지 않는다.
