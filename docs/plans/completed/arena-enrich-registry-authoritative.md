---
status: completed
slug: arena-enrich-registry-authoritative
created: 2026-06-15
owner: belie
related: arena-season1-setup, role-system
completed: 2026-06-15
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 아레나 참가자의 표시 기수·이름을 레지스트리(SSOT)로 고정해 옛 기수·부부명 잘림을 막는다.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: lib/service/me.ts enrich
> - **읽고 나면 알 수 있는 것**: 왜 꼬였나, 어떻게 가드하나
> - **관련 문서**: arena-season1-setup.md

# 아레나 enrich — 레지스트리 우선(표시 기수·이름 보호)

## 원인
- 개인시트 머리글 B3(기수)/C3(이름)로 enrich 가 표시값을 덮음 → 아레나 레지스트리
  A1-N·"정유영(조성도)" 가 시트 "3"·"정유영" 으로 바뀌어 3기(보관) 오분류 + 부부명 잘림.
  시트 read 성공/실패에 따라 양쪽 출현(비결정).

## 수정 (lib/service/me.ts)
- cohort 가드는 기존(isArenaReg) 유지. **name 가드 신규**: `isCoupleName`(괄호 부부명) 추가.
- enrichUsersWithSheetCohort·enrichUsersWithDates(cached/시트 두 경로) 의 name 결정을
  `isArenaReg(cohort) || isCoupleName(name) ? 레지스트리 name : 시트/라벨` 로 가드.
- 날짜(O1/O2)는 그대로 시트에서.

## 검증
- 단위테스트(me.test): A1-3·B3=3·C3=정유영 → A1-3·정유영(조성도) 유지 / 일반(7) 은 시트값 덮임.

## 상태
- 2026-06-15 완료(fix/arena-enrich-registry-authoritative).
