# 2026-11-16 · fix: 대시보드 영업이익 상세 폭·진행건 늘 펼침·「← 대시보드」 제거·오늘 챙길 일 글자

- 목표: belie 대시보드 5건. 계획 [dashboard-finance-detail-and-followups-font](../plans/completed/dashboard-finance-detail-and-followups-font.md).
- 확인: 매출 상세와 비용 상세는 코드에서 서로 다르다. 겹치던 것은 PC 칸 아래 「미리보기 두 줄」과 눌러 나오는 상세라, 「똑같은 내용」은 이 중복으로 해석해 고쳤다(해석 — belie 확인 필요). 역할 토글은 `RoleViewSwitch`(canStudent && canTrainer)라 수강생 전용 계정에는 원래 안 보인다(코드 확인, 운영 계정 확인은 안 함).
- 변경: 폰 영업이익 상세 전체 폭, 연 칸 미리보기 숨김, PC 진행건 늘 펼침, 「← 대시보드」 모든 화면에서 제거(2026-11-16 belie 추가 지시), 오늘 챙길 일 글자 키움. 담당 파일: `components/dashboard/*`(위 계획), `components/auth/nav-entitlements.ts`, `components/TopHeader.tsx`.
- 검증: 관련 시험 5파일, `bash scripts/check.sh`. 화면 확인 NOT_RUN(배포 뒤 확인).
- 위험·복구: 표시 전용. 되돌리면 이전 화면.
