## 2026-11-13 · 주간 보드 길찾기 주소 고르기·직접 적기 (시안 v45)
- 브랜치 `feat/schedule-board-route-address`(origin/master f035880c 기준). 요청: belie 시안 댓글 → v45 → 「v45 운영 반영」.
- 앞 작업 기록: #1427(블록 글자) 병합 8a501369, 배포 run 43188357725 성공, `/api/health` 200.
- 변경: `lib/util/map-links.ts` `routeCandidates`·`isVagueAddress`, `board/BoardCompanyRoute.tsx`(후보 고르기·직접 적기·소재지 저장), `BoardMeetingPop.tsx` `saveAddress`, `week-board.css` `.wb-qsrcs`·`.wb-qaddrin` 등, 시험 `tests/util/map-links.test.ts` 3건, 시안 파일 v45.
- 검증: tsc, map-links 시험 8건, 합성 화면 — 번호 없는 소재지에서 안내·입력칸, 주소 적은 뒤 후보 두 줄·「업체정보 소재지로 저장」. 운영 화면·폰 NOT_RUN.
- [plan](../plans/completed/schedule-board-route-address.md)
