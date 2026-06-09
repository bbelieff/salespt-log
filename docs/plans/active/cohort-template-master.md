---
slug: cohort-template-master
status: active
created: 2026-06-08
owner: belie
related: arena-create, contract-formula-channel-agnostic, admin-cohort-create(completed)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 경영일지 복제 마스터 템플릿 ID(0605ver)를 확정하고 SSOT 상수 한 곳에서 관리 — 코드/문서 하드코딩 제거.
> - **누가 읽나요**: 개발자, 운영자
> - **어떤 기능·작업과 연결?**: `lib/config/cohort-template.ts`, create-arena/cohort-members, Arena/CohortCreateModal
> - **읽고 나면 알 수 있는 것**: 마스터 ID, 변경 방법(한 줄), 선행 설치
> - **관련 문서**: `docs/plans/active/arena-create.md`, `docs/plans/active/contract-formula-channel-agnostic.md`

# 경영일지 마스터 템플릿 확정·SSOT 등재

## 확정
- 마스터(아레나/신규 기수 복제 원본) = **`1OcZedEkncMDD5mcseQmQkJJMEQQ_zuimyUsIBaNnmIE`** ("★★★세일즈PT_ 수강생 경영일지 양식(0605ver)"). "당분간 고정."
- 구 `1nx1EufkFFGaf5dp-8Dp2GvX0jU_P4EUe8QEMKTPM_rY`(앱테스트) = **deprecated**, 복제 원본 금지.

## 반영 (이 PR)
1. **SSOT 상수** — `lib/config/cohort-template.ts:DEFAULT_COHORT_TEMPLATE_ID`. 변경 시 **이 한 줄만**. client-safe(secret 무, 모달도 import).
2. **라우트 기본값** — create-arena/cohort-members 가 cohorts E(templateSheetId) 비면 이 상수로 폴백 → 폴더 ID 만 등록하면 동작. 검증에서 templateSheetId 필수 제거(항상 default).
3. **UI prefill** — Arena/CohortCreateModal 템플릿 입력 기본값 = 상수. install-by-id placeholder 도 0605.
4. **문서** — contract-formula plan·이 plan 의 템플릿 참조를 0605/SSOT 로. (구 1nx1 deprecated 표기.)

## 선행 필수 (운영)
- 이 마스터(1OcZed…)에 #319 콜지기소 수식 fix 를 **[ID로 수식 설치] 1회** → 표준화된 깨끗한 원본 확보(이후 모든 복제본 정상 상속).
- 전제: masterbot 이 이 시트 writer(편집자/공유 드라이브 멤버).

## 수용 기준
- [ ] cohorts E 비어도 아레나/기수 생성이 0605 마스터로 복제.
- [ ] 모달 템플릿 입력에 0605 prefill, 관리자가 필요시 override.
- [ ] 템플릿 ID 가 코드/문서에 분산 하드코딩되지 않음(SSOT 1곳).
- [ ] 마스터에 #319 fix 설치 완료(선행, 운영).
- [ ] `npm run check` 통과.
