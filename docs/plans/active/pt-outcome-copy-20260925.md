---
slug: pt-outcome-copy-20260925
status: active
created: 2026-09-25
---
# 전주 PT과제와 성과의 복사 매칭

## Intent
회의록 복사에서 성과만 출력되어 어떤 과제의 결과인지 알 수 없는 문제를 수정한다.

## Acceptance Criteria
- 전주 과제와 성과를 편집기와 동일한 위치 매칭으로 함께 출력한다.
- 중간 미입력 성과, 과제 없는 기존 성과, 빈 기록을 보존한다.
- Notion 14열 순서, HTML escaping, 한 행 TSV 및 접근권한을 유지한다.
- 관련 회귀 테스트와 프로젝트 검사 통과 후 배포 및 운영 복사를 확인한다.

## Steps
1. Muse에 복사 formatter 및 회귀 테스트 위임.
2. 변경 통합, 문서 동기화 및 검사.
3. PR/CI/병합/배포/운영 확인.
