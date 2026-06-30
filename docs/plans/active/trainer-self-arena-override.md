---
slug: trainer-self-arena-override
status: active
created: 2026-06-27
owner: belie
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수강생출신 트레이너의 '내 아레나 일지'가 본인 아레나 시트에 연결되도록, 대시보드 override 와 me.ts 토글이 동일한 단일 resolver 를 쓰게 한다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/service/dashboard.ts(resolveArenaOverride), lib/service/me.ts, lib/repo/users-arena.ts
> - **읽고 나면 알 수 있는 것**: 왜 dashboard 만 undefined 였나, 단일 resolver 가 무엇인가
> - **관련 문서**: arena-consistency, user-priority

# fix — 수강생출신 트레이너 내 아레나 일지 override

## 증상
류서하(ondream0501)·최정한(onjung0401)처럼 같은 이메일이 trainer(T, 빈 시트) + arena(A1-x, 본인
시트) 두 행을 가진 트레이너가 '내 아레나 일지' 진입 시 대시보드가 undefined/NaN/₩0 (빈 sheetId 읽음).

## 원인 (divergence)
- `me.ts` 토글: `findActiveArenaRowByEmail(email)` 우선 → 본인 아레나 행 잡음 → **토글 보임**.
- `dashboard.ts resolveArenaOverride`: `findArenaSheetIdByName(u.name)` 만 사용 → 이름이 여러 아레나
  행과 매칭되면 `hit.length===1` 가드에 걸려 null → **override 미적용 → undefined**.
- 두 호출처가 같은 "본인 아레나 시트" 해석을 **따로** 구현해 어긋남(Hashimoto: 단일 정의점 필요).

## 수정
- `users-arena.ts` 에 **단일 resolver** `resolveOwnArenaSheetId(email, name)`:
  ① `findActiveArenaRowByEmail`(이메일+활성 아레나 행, 중복/동명이인 안전) → ② 이름 매칭 폴백.
- `resolveArenaOverride`(dashboard) + me.ts 토글 **둘 다** 이 resolver 사용 → 다시 어긋날 수 없음.

## 검증
- ondream0501 / onjung0401 → 내 아레나 일지 → 대시보드 "시작일·주차" 정상, 본인 아레나 시트 연결(데이터 0 정상).
- 단위 테스트 pickActiveArenaRow(dual-row). typecheck/lint/test/structural 그린.

## Log
- 2026-06-27 resolveOwnArenaSheetId 추출 + dashboard/me 공용. pickActiveArenaRow 테스트.
