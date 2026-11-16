# 2026-11-16 · fix: 미팅 창 업체정보 요약·입력칸, 결과 난 미팅 업체명 고치기

- 목표: belie 「업체정보 불러오는 정보가 부족 · 고치기를 누르면 너무 좁고 위 요약과 겹친다」, 「수강생이 업체명을 『법인』으로 잘못 적었는데 고칠 수도 없고 안내도 없다」. 계획 [board-company-info-and-name-fix](../plans/completed/board-company-info-and-name-fix.md).
- 원인: 요약은 5칸만 골라 보여 줬다. 입력칸은 320px 창 안에서 화면 너비 기준으로 2열이 됐고 요약 아래에 그대로 덧붙었다. 「일정·업체명 고치기」는 예약 상태에서만 보였다.
- 변경: 요약 = 기본 보기 13항목 목록 / 고치기 = 요약 접고 460px·1열 입력칸 / 결과 난 미팅에 「업체명·장소 고치기」(계약 미팅은 장부·업체정보 이름도 함께). 담당 파일: `app/(app)/schedule/_components/board/*`, `_lib/useMeetingPatch.ts`, `components/CompanyInfoEditor.tsx`(`stacked` 추가만).
- 검증: tests/schedule/board-company-info.test.ts 4건, 합성 값 화면 확인(PC 1400px: 요약 목록·넓은 입력칸), `bash scripts/check.sh`. 운영 데이터는 건드리지 않음 — 해당 수강생 미팅은 배포 뒤 본인(또는 belie 승인 후)이 화면에서 고친다.
- 위험·복구: 화면·저장 경로 추가. 계약 미팅 이름 고침은 실무/수납에서 쓰던 기존 API 재사용. 되돌리면 이전 화면으로 돌아갈 뿐 데이터 영향 없음.
