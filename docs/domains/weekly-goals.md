---
status: draft
owner: SALES-WEEKLY-GOALS-947-WRITER
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: #946 v0.4 주간 목표의 운영 저장·기간·권한·복사 계약.
> - **누가 읽나요**: 구현·검수·배포 담당.
> - **관련 문서**: [#947](https://github.com/bbelieff/salespt-log/issues/947), [data-model](./data-model.md), [components](../design/components.md).

## 저장·권한

목표는 학생 email×cohort×courseStart×weekStart 한 행이다. 부부가 같은 시트를 공유해도 목표는 개별 계정 단위, 실적은 기존 계정→시트 매핑을 따른다. 새 기수 재등록은 별도 행. 수강 시작일 변경 시 과거 키를 자동 이관하지 않는다.

공용 테이블 weekly_goals는 nullable 정수 다섯 개와 task만 저장. 내부 weekly_goal_private는 special_notes/prior_outcome을 분리 보관한다. 공용 GET에는 내부 조회 자체가 없고 User 전체를 spread하지 않는다. unknown 입력은 거절한다.

실제 로그인 세션과 기존 관리자/담당 trainer 규칙으로 타깃을 검증한다. pending 접근 금지, 학생은 본인만, trainer는 active·담당만, 관리자는 기존 전원 권한. overview는 권한을 통과한 대상만 최대4동시 공용 목표 조회, 각 학생의 실제 실적은 선택 시만 조회한다. 재조회된 학생의 역할·상태·담당도 다시 검증한다.

저장은 명시 week 및 enrollment(cohort/courseStart) echo를 요구한다. INSERT 충돌 무시 + UPDATE WHERE revision 비교로 단일 승자만 성공하며 실패는409. 공용/내부 revision은 독립, 내부 저장이 공용 과제를 지우지 않는다. 읽기 오류는 503이며 빈 성공값으로 대체하지 않는다. 테이블이 없으면 목표 기능만 실패하며 migration을 요청 경로에서 실행하지 않는다.

## 주간/실적

`lib/util/week.ts` friWeekIndexOf/friOf를 사용하는 금~목 UI 주차. 시작일 포함 금~목 주가1주차, 현재 날짜는todayKST. 기존 시작일 기반 8주 누적 통계 자체는 변경하지 않는다. 시작 전 첫 주 표시, 완료 주차도 수정 가능(기존 CRM 정책 유지).

| 지표 | 기존 원천·집계 | 날짜/정정 |
| --- | --- | --- |
| 생산 | readSalesRowsFromDb production, 기존 CHANNEL_ORDER | sales.date, 정정/삭제 후 재조회 반영 |
| 유입 | 동일 inflow, 기존 발굴 파생값을 그대로 소비 | sales.date; 발굴/매칭일 규칙 재정의 없음 |
| 컨택완료 | 동일 contactProgress(기존 컨택 입력 건수) | sales.date |
| 미팅완료 | 기존 DONE(완료/계약), CARRYOVER 제외 | 미팅날짜; 예약/변경/취소 제외 |
| 계약 | 기존 weeklyContractsFromDb 및 terminatedByWeek 차감(0하한) | 미팅날짜 귀속, 해지는 기존 계약일 차감; 기존 주간 집계의 이월 포함 의미 유지 |

선택 금~목 날짜 범위를 먼저 적용하고 같은 raw 집계 함수를 호출한다. 신규 목표 화면의 기간 범위가 기존 8주 누적과 다름을 API의 start/end로 명확히 한다. 목표 숫자에서 실제 활동·관찰을 추론하지 않는다. DB 정본 기수 게이트는 daily-source 그대로. 미전환/날짜 미확정은 사용할 수 없음을 명시, 임의 시트 폴백 없음.

저장 후 공통 쿼리 무효화, 기존 앱 mutation 성공 시 동일 aggregate 갱신. 비교와 축약 링은 동일 endpoint. 내부 기록은 필요할 때만 별도 요청, 함께보기에는 렌더하지 않는다.

미저장 주차/화면 이동은 기존 DirtyGuard, 브라우저 뒤로/앞으로 이동은 목표 편집기의 native history 확인으로 보호한다. 재조회 실패 시 기존 입력을 유지하고 오래된 실적으로 복사하지 못하게 한다. 재인증 뒤 확인한 최신 actor 권한을 내부 조회 판단에 사용한다.

## 복사

공용은 목표/PT과제만 명시적으로 선택. 내부 회의록은 지역/기수/수강생/담당T/금주미팅/금주계약/특이사항/지난 PT성과/이번 PT과제/다섯 목표, 총14열. 지역은 기존 team, 담당 이름은 등록된 trainer 이름(없으면 기존 식별 이메일).

미리보기 수정은 복사용 편집이며 원본 기록을 바꾸지 않는다. 목표/내부 원본 초안은 먼저 저장해야 복사 가능. HTML은 텍스트 escape와 br로 줄바꿈 보존; TSV는 내부 tab을 공백, 줄바꿈을 / 로 바꿔14열1행 유지. clipboard 실패/미지원이면 선택 가능한 text. 성공 문구는 복사됨뿐. 실제 Notion 표 붙여넣기 호환은 별도 NOT_RUN.

## 외부 연동·운영

#946의 실제 KPI 읽기 결과: ①목표와 보고값/일지값은 별도 구조, 월 기준 주간 매핑도 다르다. 승인된 자동 쓰기 경로/학생 키 매핑/실행 증거 없음. 이 기능은 KPI·Notion 원본에 쓰지 않는다. Notion 자동 페이지·Kakao 생성/발송 없음.

RELEASE 전 migration 및 운영 쓰기 실행 금지. RELEASE 이후 기존 db:migrate 경로로 0005 적용 이력/checksum 및 앱 서버 DB role의 SELECT/INSERT/UPDATE 권한 확인이 필요하다. RLS 우회권한/소유자인 기존 서버 연결만 사용하며 새 브라우저 권한 정책을 만들지 않는다. migration 파일이 배포됐다는 사실만으로 적용 완료를 선언하지 않는다.

기능 롤백은 PR squash revert, 가산 테이블과 저장 기록은 보존. 기존 학생 자료/시트 수식에 변화 없음. 배포 후 운영 관찰 계약과 실제 인증 흐름·migration 적용·health는 OG RELEASE와 함께 확인한다.
