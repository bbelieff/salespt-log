# 주간 보드 미팅 창 — 업체정보 요약·입력칸, 결과 난 미팅의 업체명 고치기

- 목적: belie 2026-11-16 두 건. ① 미팅 창 업체정보 요약에 정보가 부족하고, 「고치기」를 누르면 320px 창에 [대표자]·[사업자]가 좌우로 끼어 좁고 요약과 내용이 위아래로 겹친다. ② 수강생이 업체명을 잘못 적은 미팅(결과가 난 뒤)을 고칠 곳도 안내도 없다.
- 관련: [components](../../design/components.md) WeekBoard 줄, `app/(app)/schedule/_components/board/`.

## 수용 조건
1. 업체정보 요약 = 업체정보 「기본 보기」와 같은 항목·순서([대표자] 이름·신용점수·기대출 개인 / [사업자] 개업일·사업자 구분·업종·아이템·연매출·사업자 대출·4대보험 직원·특허 및 인증·소재지·기타메모).
2. 「고치기」를 누르면 요약 목록은 사라지고 입력칸만 남는다. PC 창은 460px 로 넓어지고 묶음은 위아래 1열.
3. 결과가 난 미팅(계약·완료·변경·취소)에 「업체명·장소 고치기」. 계약 미팅은 실무/수납 장부(02)·업체정보(06) 이름도 같은 경로(`editContractLinkedFields`)로 함께 옮긴다. 날짜·시간은 바꾸지 않는다.

## 변경
- `BoardCompanyRoute` 요약 목록, `BoardPopover` `useBoardPopWide`, `CompanyInfoEditor` `stacked`, `MeetingNameFix` 신규, `useMeetingPatch` 계약 미팅 이름 고침 경로, `week-board.css`.

## 검증
- `tests/schedule/board-company-info.test.ts`, 합성 값으로 실제 화면(1400px) 확인, `bash scripts/check.sh`.
