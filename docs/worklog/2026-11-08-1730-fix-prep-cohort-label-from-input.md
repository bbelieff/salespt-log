> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 사전등록 때 양식 잔재 기수(B3 = 8)가 기수 표시값으로 들어가 0기가 8기로 보이던 것의 재발 방지 기록.
> - **누가 읽나요**: 개발자
> - **관련 문서**: [계획](../plans/completed/prep-cohort-label-from-input.md)

# 2026-11-08 fix: 사전등록 기수 표시값 = 입력 기수

- 담당 파일: lib/repo/users-prep.ts(resolvePrepCohortLabel·addTraineePrepRow) · lib/repo/sales-profile.ts(writeProfileCohort) · tests/repo/users-prep-cohort-label.test.ts.
- 원인: 양식 시트 01 영업관리 B3 = "8". 이 사본을 사전등록하면 readProfileBundle 의 B3 가 I(cohort_label) 캐시로 들어가고, enrichUsersWithDates 가 표시값으로 기수를 덮어 목록이 8기 상자에 넣었다. 운영 자료는 2026-11-07 00:35~37 KST 에 이미 0 으로 고쳐져 있다(확인).
- 변경: 숫자 기수면 입력 기수가 정본 — 다르면 I = 입력 기수, 시트 B3 도 입력 기수로 씀. 아레나·빈 B3 는 그대로.
- 검증: 새 시험 4 + users-prep-columns 시험 통과, tsc 통과, check.sh(커밋 훅).
- 위험/복구: 사전등록 경로에서 시트 B3 한 칸을 쓴다(입력 기수와 다를 때만). 되돌리기 = revert.
