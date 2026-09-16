# 2026-09-16 트레이너 주간목표 배포 빌드 실패

- 영향: PR #990 배포 run 35043638490이 빌드에서 중단. 기존 실행 빌드를 유지하며 서비스 교체 전 실패.
- 원인: 주간목표 Link href를 문자열 덧셈으로 만들면서 string으로 확장됨. Next 프로덕션 빌드가 생성하는 typed route 선언에서 거부됐으나, 생성 타입 없는 새 작업 폴더의 tsc/QA에서는 드러나지 않음.
- 수정: 고정 /weekly-goals 경로를 포함한 단일 template literal을 as const로 보존. 이메일·복귀경로 인코딩 및 동작은 동일.
- 재발 방지: Link 경로 변경은 fresh Next production build로 생성 route 타입까지 확인. 실행 성공 및 후속 배포 증거는 작업 결과에 기록.
