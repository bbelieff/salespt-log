---
slug: merge-kimjongkeun-jkk-email
status: active
created: 2026-06-15
owner: belie
related: arena-season1-setup, role-system
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 김종근의 트레이너/아레나 레지스트리 계정을 jkk.masterbiz@gmail.com 하나로 통합(1회 마이그레이션).
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: registry users 탭, 담당트레이너 배정
> - **읽고 나면 알 수 있는 것**: 무엇을 바꾸나, 백업/드라이런/멱등
> - **관련 문서**: arena-season1-setup.md

# 김종근 계정 통합 (jjamjjamipd → jkk.masterbiz)

## 현재 (users 탭 김종근 3행)
1. jkk.masterbiz@gmail.com · T · 김종근 · (시트X) · trainer · archived
2. jjamjjamipd@gmail.com · T · 김종근 · (시트X) · trainer · active  ← 담당배정 사용
3. (이메일 빈칸) · A1-3 · 김종근 · 1t9RuABB… · trainee · active (아레나 prep)
+ 수강생 ~11명 G열(담당트레이너)에 jjamjjamipd 포함.

## 목표
- 활성 트레이너 1행(email=jkk.masterbiz), 보관 jkk 행 제거.
- A1-3 아레나 행 email = jkk.masterbiz.
- 모든 G열 토큰 jjamjjamipd → jkk.masterbiz (정확 일치 토큰만).

## 방법
- `scripts/merge-kimjongkeun-jkk-email.mjs` (SA, backfill 패턴). 기본 **드라이런**(--apply 로 실제).
- 항상 백업(현재 A2:R 타임스탬프 파일 dump) → 드라이런 plan → belie 확인 → --apply.
- 멱등(이미 jkk면 skip), 변경 셀만 타격(§2.5).

## 검증
- 적용 후 재조회: 활성 트레이너 1행(jkk) + A1-3 행 email=jkk, jjamjjamipd 잔존 0.
- 라이브: jkk 로그인 → 트레이너 페이지 + 담당 11명 + 아레나(A1-3) 토글.

## 상태
- 2026-06-15 진행(chore/merge-kimjongkeun-jkk-email).
