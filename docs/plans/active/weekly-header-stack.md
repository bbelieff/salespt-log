# 주간 목표 상단 세 줄 스크롤 고정
- 운영에서 재현: body 높이 720px, 미리보기 확장 문서 2284px. 맨 아래에서 헤더/배너는 음수 위치로 이탈하고 주차 바만 남음.
- Muse 구현: WeeklyGoalPage에 내용 높이를 따라 늘어나는 min-h-dvh 부모를 추가. TopHeader 두 줄과 Content의 공통 포함 영역을 확보. 글로벌 CSS·다른 화면 변경 없음.
- Muse 재현 fixture: html/body/root 높이 100% 조건 추가와 동일 부모 구성. GPT 통합 시 불필요한 추가 spacer와 구조만 검사하는 jsdom 초안은 제외.
- 검증: 실제 브라우저 PC/모바일에서 미리보기 열림/닫힘, 문서 맨 아래 세 줄 유지. 필수 check.sh와 next build 후 기존 배포 절차로 운영 확인.
