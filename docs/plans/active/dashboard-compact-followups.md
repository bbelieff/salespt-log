# 오늘 챙길 일 표·대시보드 하단 정렬

목표: 승인된 STEP별 표 목업을 운영 연결하고 주간목표 날짜를 제목 줄로 이동, 좌우 하단 정렬.
관련: ../../development/workflow.md, ../../design/components.md.

## 승인 및 범위
- 2026-10-14 사용자: “주간목표 아래 날짜를 한칸 올려줘. 그리고 좌측열과 우측열의 아래정렬을 맞추자. 운영배포까지 해줘”. 직전 STEP별 긴급순 표 목업 승인 문맥.
- 목업 http://127.0.0.1:4523/dashboard?week=9, followups-table-mockup 작업본 및 증거 followups-table-pc.jpg.
- base origin/master 9fab4c5c, 전용 feat/dashboard-compact-followups.
- 총괄: WeeklyGoalSummary·레이아웃 CSS·fixture·문서·검증/배포. 제작 followups_table_release: 표 view/새 CSS·관련 UI 테스트. 독립 검증 별도.
- 데이터 집계·저장·API·기관/계약/채널 정책은 변경하지 않는다. 운영 DB 쓰기 없음.

## 수용조건
- STEP1.5/2/3/4 항상 표시, 정상 0건은 0, 불완전 조회를 정상 0으로 오인하지 않음.
- STEP 호버/클릭으로 긴급순 표. 오른쪽 바로가기, 상세 펼치기, 7건 PC 내부 스크롤 없음.
- 키보드/터치 조작, 호버 anchor→panel 유지·외부 이동 닫기·Escape 및 포커스 반환.
- 빈 상세 “지금 처리할 일이 없어요”. 기존 notice/unknown/7일안 보존.
- 주간목표 날짜 제목 영역으로 상향. 원 크기·주차 이동·PT과제·목표/실적 유지.
- PC 양 열 하단 일치, 모바일 320/375/430 가로 넘침 없음·기존 주차별 순서 유지.

## 검증 및 배포
- Git Bash 경로 check.sh, production build, 정확한 head 합성 PC/모바일 화면, 독립 검토, CI.
- 직렬 squash 후 Deploy to VPS success·health200·안전한 운영 화면 확인.
- 구현 완료. PC 양 열 하단 672.6875px 일치, STEP4 7행 높이 410/410px 무스크롤. 모바일 320/375/430 가로 넘침 없음, 320 주차 이동 및 430 빈 목록 확인. 증거: artifacts/dashboard-compact-release (세일즈PT 산출물 폴더).
- 관련 UI 17개 통과. 전체 단위검사 3610 통과·45 skip. 초기 타입 오류는 테스트 row helper에서 수정, 최종 재검 중. 배포 NOT_RUN.
