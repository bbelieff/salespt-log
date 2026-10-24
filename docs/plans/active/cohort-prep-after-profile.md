> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 새 기수 시트를 만들 때 사전등록(기수·날짜 캐시)을 시트에 기수·이름·날짜를 찍은 뒤로 옮겨, 템플릿의 8기 값이 굳지 않게 한 수정.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/api/admin/create-cohort-members`·`create-arena-members`, `lib/service/cohort-create.ts`(재시도), registry I~L 캐시
> - **읽고 나면 알 수 있는 것**: 12기 수강생이 「20주차」로 보인 원인 · 고친 순서 · 운영 데이터 교정 내역
> - **관련 문서**: `tests/service/cohort-sheet-profile.test.ts`(2026-09-04 B3 사고)

# 사전등록은 시트를 찍은 뒤에 (2026-10-24)

## 사고
12기 수강생 1명의 주간 목표가 「20주차(10/23~10/29)」로 보임(정답 4주차). 개인 시트는 정상(B3=12, O1=10/2, O2=12/19)인데
레지스트리 캐시 I~L 이 `8 / (빈 이름) / 2026-06-12 / 2026-08-01`.

## 원인
`create-cohort-members` 가 템플릿 복제 직후 `addTraineePrepRow` 를 먼저 불렀다. 이 함수는 그 순간 시트를 읽어 I~L 캐시를 박는데,
갓 복제한 시트에는 템플릿(0605=8기 사본)의 B3=8·빈 C3·O1=6/12 가 남아 있다. 그 뒤 writeProfile·writeCourseDates 가 시트를 고쳐도
캐시는 다시 읽지 않아 굳는다. 주간 목표는 캐시 `courseStartISO` 로 주차를 센다. 재시도 경로(`completeOnePending`)는 B3 도장·템플릿 덮기도 없었고,
아레나도 writeProfile 이 사전등록 뒤였다.

## 수정
- 세 경로 모두 B3:C3·O1/O2 를 찍은 **뒤에** `addTraineePrepRow`.
- 재시도 경로: 갓 복제한 시트만 writeProfile + `allowTemplateOverwrite`(재사용 시트는 그대로).
- 시험: 호출 순서 회귀(`create-cohort-members-dates`, 새 `cohort-create-prep-order`).

## 운영 데이터 교정 (belie 요청 「확인해서 해결」)
- 해당 수강생 registry 시트 I~L + DB users 4칸을 개인 시트 값(12 / 이름 / 2026-10-02 / 2026-12-19)으로. 이전값 `8 / "" / 2026-06-12 / 2026-08-01`.
- 옛 시작일로 저장된 주간 목표 2건·비공개 메모 2건의 `course_start` 를 2026-06-12 → 2026-10-02(주 시작일 동일, 충돌 0).
- 전수 점검(활성·대기 137시트): 다른 불일치는 유보 1명(캐시 8기, 시트 B3 「0」·10/2~11/21) — 유보라 손대지 않음.

## 되돌리기
코드: squash revert. 데이터: 위 이전값으로 되돌림.
