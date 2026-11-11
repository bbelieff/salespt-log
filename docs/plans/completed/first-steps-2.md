> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 첫걸음 2차 — 나머지 안내 4종, 계정별 저장, 관리 화면 진행, 측정.
> - **누가 읽나요**: 개발자
> - **관련 문서**: [1차](first-steps-spotlight.md) · [작업 기록](../../worklog/2026-11-11-0200-feat-first-steps-2.md) · [data-model 첫걸음](../../domains/data-model.md)

# feat: 첫걸음 2차

## 목표
belie 2026-11-11 「2차도 진행해줘」. 같은 날 시안 댓글 「잡다한 설명 생략」 → 안내·DB 추가 확인 화면 설명 줄 정리.

## 수용 조건
1. 안내 4종 추가: 구매(/db) · 컨택(/contact) · 결과(/schedule) · 수납(/payment). 카드 「해 보기」(`?tour=`) 모두 연결. 대상이 없으면 제안 줄을 띄우지 않는다(결과: 예약·변경 미팅, 수납: 계약, 미팅 예약: 컨택진행).
2. 계정별 저장: 마이그레이션 `0021_first_steps.sql`(additive, RLS·권한 회수) + repo/service + `/api/first-steps` GET·PUT. 표가 없으면 503 → 브라우저 기억으로 동작. 서버 줄이 없으면 브라우저 기억을 한 번 올린다.
3. 관리 화면: `/api/admin/first-steps`(관리 권한) + `TraineeCard` 「첫걸음 N/7」.
4. 측정: analytics `first_step_tour_started|finished|dismissed`(tour 이름만, 개인정보 없음).
5. 문구 정리: 안내 말풍선은 할 일 한 줄. DB 추가 확인 화면 「파일에 적힌 줄은…」·「다 채우면…」 줄 제거.
- 회귀 시험: tests/repo/first-steps.pglite.test.ts, tests/util/first-steps.test.ts(안내 6종 링크), 기존 spotlight 시험.

## 남은 일
- 운영 DB 에 0021 적용(db-migrate 워크플로, 승인 후). 적용 전까지 기억은 브라우저별.
