# 주간목표 정성·정량 분리 목업
- 기준 origin/master ff067b2e / feat/weekly-goals-split-mockup.
- 사용자 요청: 날짜를 제목에 유지, 정성목표 왼쪽·정량목표 오른쪽, 빈 줄을 줄여 도넛 확대, 두 열 하단 유지.
- 정성목표는 기존 PT과제, 정량목표는 기존 생산→유입→컨택완료→미팅완료→계약. 데이터·저장 계약 무변경.
- 실제 WeeklyGoalSummary/GoalRings/대시보드 CSS 재사용, 기존 합성 API와 운영 폰트 사용.
- 이번 단계 목업 확인. 새 배치는 workflow의 목업 승인 후 운영 구현/배포. 기존 배포 ff067b2e 유지.
- 총괄 단독, 별도 위임 없음. PC와320/375/430 화면·주차 이동·과제 진입 확인 예정.

## 목업 검증
- http://127.0.0.1:4523/dashboard?week=9, PID75892. 실제 component 변경3파일 및 합성 fixture 과제문구만 변경.
- TypeScript PASS. PC1280 도넛58.2px, PC1600 77.4px 및 양 열 하단684.25/684.25. 320/375/430 가로 넘침 없음, 320 링44px. 주차9→8 날짜/과제라벨 변경 확인.
- 상세 버튼 목적지 /weekly-goals?date=2026-10-02&returnTo=%2Fdashboard 확인. 해당 상세페이지는 이 합성 서버에 없으므로 상세화면 내용은 NOT_RUN(기존 routing 변경 없음).
- 스크린샷 세일즈PT artifacts/weekly-goals-split. PR·build·배포 NOT_RUN(새 배치 승인 대기).

## 추가 요청 — 좌우 교체
- 왼쪽: 전체 진행건→오늘 챙길 일. 오른쪽: 생산성 지표→주간목표. 정성/정량 분리와 하단 정렬 유지. PC grid-column만 교체, 모바일 순서 유지.
- 목업 수정 중, 실화면 검증 예정.

- 좌우 교체 검증 완료: work left254.375, productivity/goals left916.0625, 양 열 bottom586.25 일치. STEP4 상세7건 팝업 화면 안 표시·닫기 PASS. 스크린샷 pc-swapped.jpg. PC media 범위만 수정하여 모바일 순서 변경 없음. 운영 미반영.

## 10/15 오른쪽 팝업 요청
- PC1024 이상 오른쪽 공간300px 이상이면 카드 우측10px, 선택한 행 높이에 팝업. 폭은 가용공간 내 최대740px. 모바일은 화면 내부 배치 유지.
- 팝업 컨테이너 폭에 맞춰 표 열 폭을 압축하고 매우 좁은 폭에서는 기준일/기관을 상세 펼침으로 확인.
- 실화면 PC1613 cardRight827.94/popupLeft837.94, PC1024 popupRight1012·표467/467, 모바일320 popup12~308·표294/294 확인. 관련 상호작용시험5PASS. 목업 반영, 운영 미변경.

## 최종 운영 승인 2026-10-15
- 사용자: ‘좋아 지금 목업대로 전부 운영배포해줘’. 정성/정량 분리·도넛확대·좌우열교체·오른쪽팝업 전체 승인.
- 최신 origin/master ff067b2e와 base 일치, 기존 전용 worktree에서 승인본 그대로 검증·배포. 타 PR1139/1136/798 제외.
- root 구현·검사·빌드·배포. compact_release_review 독립 읽기 검증. 데이터/API/DB 쓰기 변경 없음.
- check.sh 정상 hook→build→정확head 독립PASS→CI→직렬squash→Deploy·health·live 확인 진행.
