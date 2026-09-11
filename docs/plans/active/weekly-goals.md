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
- 계정×기수×수강시작일×주간 기간으로 격리하고 revision 기반 충돌을 검출한다. 실데이터 테스트 쓰기 금지.
- 실적/주차는 기존 SSOT 재사용. 기존 KPI 값/수식/과거 통계는 변경하지 않는다.
- Notion은 미리보기/복사만. KPI 자동 쓰기와 Kakao 기능은 추가하지 않는다.

## 진행

- [x] 지침·승인 목업 hash·원격 master·열린 PR·최근 worklog 확인.
- [x] 저장 계약/마이그레이션/API/권한/집계.
- [x] 공통 편집/링/비교/복사와 학생·트레이너·탭 진입.
- [ ] 회귀 테스트·check.sh·next build·모바일390/PC 실화면 확인.
- [ ] PR 및 CI 증거를 OG에 제출, 독립 검수 대기.
- [ ] OG RELEASE 후 직렬 머지·정확한 배포 SHA·migration 적용·health·실화면 증거.

## 남은 운영 검증

마이그레이션 파일만으로 적용 완료 아님. 실제 Notion 표 붙여넣기는 목업에서도 NOT_RUN. 미승인 KPI 쓰기 없음. 배포 전 실패/롤백 및 관찰 계약을 PR에 기록한다.
