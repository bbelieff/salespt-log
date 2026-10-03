# 수강생 대시보드 7개 피드백 반영

- 작업: STUDENT-DASHBOARD-260913, writer: 경영일지 데탑 G총괄(260913).
- 사용자 2026-09-13 요청 및 dashboard-v4 미커밋 초안 승계 승인. 원본 worktree 보존.
- 기준: fb1f4e00a256002d31c7b85c2dcc4c8feb0691a7.
- 소유 범위: TopHeader/RoleViewSwitch, 대시보드 페이지·진행/재무 카드, WeeklyGoalSummary, 공유 헤더 높이의 sticky 소비처, 관련 토큰/문서/검사. 다른 트레이너 권한·Drive 작업은 수정하지 않음.
- 요구: 대리접속 문구 제거, 한 줄 헤더, 학생 dashboard 링크, 배너 아래 날짜·진행 고정, D-day 우측, 재무 세트 본문 배치, 주간목표 현재 주 기본·이전주 탐색.
- 금액/권한/기록 정책 불변. IdentityGuard 및 DirtyGuard 유지. 주차는 서버 금~목 계산 사용.
- 검증: 타입/린트/회귀/check.sh/build, PC·모바일·넓은 화면 스크롤 및 목표 이동 합성 fixture, 운영 읽기 확인. 실제 실행만 기록.
- 성능 #882: 별도 실측 지속. 이번 UI 변경으로 성능 개선 완료를 주장하지 않음.
- Muse Spark 1.3 호출은 HTTP402로 결과 없음. 결제 변경 없음.
- 롤백: 본 변경 커밋 revert. 운영 데이터 쓰기 없음.
