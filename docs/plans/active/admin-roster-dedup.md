---
slug: admin-roster-dedup
status: active
created: 2026-07-15
owner: belie
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 어드민 화면에서 동일인이 2계정으로 중복 표시되던 버그를 표시 dedup 으로 해소.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/repo/users.ts(listDistinctUsers)·user-priority.ts, admin/trainer 로스터 페이지
> - **읽고 나면 알 수 있는 것**: 왜 중복됐나 / 표시만 고치고 뮤테이션은 왜 raw 인가 / 행 삭제는 왜 belie 승인인가
> - **관련 문서**: docs/plans/completed/registry-write-preferred-row.md(같은 계열)

# admin-roster-dedup

## 버그 (belie 신고)
어드민에서 동일인이 **2계정으로 중복 표시**. 대상: 7기 함진숙·9기 박진우(조다영)·A1-3 김종근·A1-0 테스터
(각 1인인데 2행). 실측(read-only 진단) 확인 = **4군 전부 "같은 시트, 다른 이메일"**(별칭·직원공유 계정).

## 근인
`listAllUsers`(users.ts)가 registry 행을 **dedup 없이** 방출. `pickPreferredUser`(user-priority) 합치기를
import 만 하고 목록엔 미적용. 다행 원인 = 아레나 재참가(옛 숫자기수행+A{n}-{m}행) / 이메일 2개 같은 시트.

## Fix ① — 표시 dedup (배포)
- `user-priority.ts distinctByPreferred(users)`(순수): 그룹키=**spreadsheetId 우선**(같은 시트=같은 사람),
  없으면 email(소문자). 그룹 대표=pickPreferredUser. **입력 정렬 보존**(대표 행만 필터).
- `users.ts listDistinctUsers()` = distinctByPreferred(listAllUsers()).
- **표시(로스터) 경로만 전환**: admin/cohorts·trainers·users 페이지 · api/admin/users GET · trainer 페이지.
  → cohorts 페이지의 **trainee 카운트도 dedup 수혜**(과대계상 해소).
- **⚠️ 뮤테이션 경로는 raw `listAllUsers` 유지**: install-formulas-bulk·set-cohort-status·users-arena —
  dedup 하면 대표 아닌 타겟 행이 사라져 approve/assign/install 이 깨진다.
- 회귀 테스트 7(아레나재참가·시트공유별칭·다른사람·트레이너·정렬보존·빈배열).

## Fix ② — 중복군 정리 (dry-run만, belie 승인 대기)
- `scratchpad/diagnose-roster-dups.mjs`(read-only): 그룹핑 후 dedupKeepIndex 로 유지행/삭제후보 표시.
- 실측: 중복군 4 · 삭제후보 4행. **삭제 안 함** — 다른 이메일이 실제 로그인에 쓰일 수 있어(별칭)
  행 삭제는 **belie 승인 화이트리스트**(📥). 표시 dedup 으로 화면은 이미 정상이므로 정리는 위생 목적·비긴급.

## Acceptance
- [x] distinctByPreferred + listDistinctUsers, 표시 경로 5곳 전환
- [x] 뮤테이션 경로 raw 유지
- [x] 회귀 테스트(다행→1건)
- [x] check.sh 초록
- [ ] (belie) 중복군 행 삭제 승인 여부 → 승인 시 execute 스크립트
