# 2026-11-10 22:00 feat/db-step1-add-first — 스탭1 구매목록 추가를 위로

- 목표: belie 「채널선택>구매목록추가>구매목록>합계>전체종합」.
- 담당 파일: app/(app)/db/_components/DbChannelWorkspace.tsx, tests/components/db-mobile-order.test.ts, tests/components/desktop-fluid.test.ts, docs/design/components.md, plan.
- 변경: 추가 폼/버튼 블록을 목록 앞(왼쪽 칸 맨 위)으로 이동, 합계는 오른쪽 칸(좁은 화면은 목록 아래). 여백 mt→mb 정리.
- 검증: 관련 시험 4파일 53건 통과, check.sh(커밋 훅).
- 미완료: 실제 화면 확인 NOT_RUN — 로컬에 운영 비밀값이 없어 /db 데이터 화면을 못 띄움. 배포 뒤 폰·PC 확인 필요.
- 위험/복구: 화면 배치만 변경, 데이터 경로 무변경. 문제 시 revert.
