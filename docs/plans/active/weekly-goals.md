---
status: active
owner: SALES-WEEKLY-GOALS-947-WRITER
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: #946 v0.4 승인 설계를 #947 운영 앱으로 구현하는 계획.
> - **누가 읽나요**: OG, 구현 writer, 독립 검수자.
> - **관련 문서**: [설계](https://github.com/bbelieff/salespt-log/issues/946), [구현](https://github.com/bbelieff/salespt-log/issues/947).

## 계약

- Worker `01a08dd0-a805-71a1-86a4-e486b8693551`, branch `feat/weekly-goals`, base `579060960a9a97e10d007dc36945aa03af345490`.
- 현재 canonical checkout의 2026-09-09 AGENTS/CLAUDE 지침을 적용한다(OG 정정). 지침 파일 자체는 변경하지 않는다.
- 신규 weekly-goals 타입/저장/API/공통 UI와 해당 테스트, 기존 dashboard/db/contact/schedule/trainer 진입부, 관련 문서만 수정한다.
- 공용 목표/PT과제와 내부 특이사항/지난 PT성과를 분리한다. 학생 응답에 내부 필드는 포함하지 않는다.
- 서버 수강생 시트 ID×기수×수강시작일×주간 기간으로 격리하고 revision 기반 충돌을 검출한다. 로그인 별칭은 같은 목표를 사용하며, 실제 로그인·현재 담당 권한은 별도로 확인한다. 실데이터 테스트 쓰기 금지.
- 실적/주차는 기존 SSOT 재사용. 기존 KPI 값/수식/과거 통계는 변경하지 않는다.
- Notion은 미리보기/복사만. KPI 자동 쓰기와 Kakao 기능은 추가하지 않는다.

## 진행

- [x] 지침·승인 목업 hash·원격 master·열린 PR·최근 worklog 확인.
- [x] 저장 계약/마이그레이션/API/권한/집계.
- [x] 공통 편집/링/비교/복사와 학생·트레이너·탭 진입.
- [x] 회귀211건·전체 Vitest(41+1697)·next build·모바일390/PC 컴포넌트 브라우저28건 확인. 실제 인증 앱 화면은 별도 인수 조건.
- [ ] PR 및 CI 증거를 OG에 제출, 독립 검수 대기.
- [ ] OG RELEASE 후 직렬 머지·정확한 배포 SHA·migration 적용·health·실화면 증거.

## 남은 운영 검증

현재 continuation: canonical 2026-09-09 정본 재확인으로 legacy worktree 절대경로 재주입은 제외한다. 사용자11:23:41 KST Slack1789093421.892039의 승인 범위는 public.schema_migrations의 anon/authenticated ACL 회수뿐이다. 별도 default-false 옵션·고정 명령·transaction/lock/timeout·ledger digest/count/owner-service-server 권한 불변 검증으로 준비하며, 일반 preflight는 수리하지 않는다. 실제 PM2 listener 및 Next env 우선순위/소스 계약·파일 시각/DB metadata 비교는 read-only, 불명확/변경 시 fail-closed. 추가 agent 없음. 새 delta의 OG 검수/RELEASE 전 운영 실행·DB apply·머지·배포 HOLD.

OG 운영 read-only run34552514192는 artifact 검증 후 UNSAFE_HISTORY_SECURITY로 중단했다. 이번 범위는 해당 실패의 고정 schema_migrations 권한/카탈로그 진단만 추가한다. PUBLIC/browser privilege별 boolean, column grant 존재, 미확인 grantee 수, server 권한만 허용하며 임의 role명·이력 값·driver 메시지는 출력하지 않는다. 기존 gate/rollback/SQL0005 불변, 운영 재실행·ACL 수정·머지·배포 금지. ops 집중/타입/전체 게이트/CI 후 새 head를 OG 검수에 반환한다. 앱/브라우저 소스는 변경하지 않는다.

추가 bounded REWORK(5cc5e784 이후): archived 자기 수강 내부 권한 차단, 담당 필터 후 별칭 대표 선택, 내부 요청 generation/abort 및 비JSON401/403 보존, 신규 이력 ACL/기존 이력 fail-closed·timeout, feature-ref 보호 전달 workflow. 기존 제안/가져오기/모바일/dirty guard는 보존한다. 서버·migration·전달 helper는 각각 내부 한정이며 main이 UI·통합 검증을 소유한다. 운영 실행/dispatch는 RELEASE 전 금지.

OG 재검수 REWORK 구현/로컬 검증 완료: 명시 student 저장 계약, 시트 단위 별칭/트레이너 아레나 수강행 해석, 미저장 업무탭 가드, 이전 주 가져오기, 모바일5열, 승인 비율 역산 제안, exact0005 read-only preflight/적용 준비. 새 head에 회귀·화면·전체 게이트를 재제출한다. INTERNAL_SUBAGENT_ONLY helper는 서버 회귀 테스트와 migration 준비 파일만 분담하며 독립 검수가 아니다.

마이그레이션 파일만으로 적용 완료 아님. 실제 Notion 표 붙여넣기는 목업에서도 NOT_RUN. 미승인 KPI 쓰기 없음. 배포 전 실패/롤백 및 관찰 계약을 PR에 기록한다.
