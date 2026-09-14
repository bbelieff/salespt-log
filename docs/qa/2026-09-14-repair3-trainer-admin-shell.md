# 2026-09-14 수리3 · 트레이너/관리자 화면 레이아웃 QA

대상 브랜치 `fix/trainer-page-0914-3` (base `origin/master` e0fbf72).

## 실행

```sh
QA_TOOLS_DIR=<playwright 를 담은 외부 도구 디렉터리> node tests/browser/trainer-admin-shell-browser.mjs
```

실제 제품 컴포넌트 + 실제 Tailwind CSS + 운영 빌드의 루트 폰트를 쓰고, 서버 경계(`/api/me`,
`/api/announcements`, `/api/trainer/recruitment`, `/api/admin/trainer-access`)만 합성한다. 운영 인증·DB·
개인정보는 쓰지 않는다. 합성 이메일은 `*@example.com`.

## 결과 — 34/34 PASS (1440x900 · 390x844)

| 단정 | 확인 내용 | 실측 (pc / mobile) |
| --- | --- | --- |
| A1·A2 | `/admin/trainers` 초대 카드와 권한 편집기의 left·width 일치 | left 308.3/24.0, width 823.5/342.0 (diff 0) |
| A3 | 초대 카드가 full-bleed 아님 + 1440 가운데 정렬 | left>0, centerDev 0.0 |
| A4·B7 | 두 화면 모두 가로 넘침 없음 | scrollWidth == innerWidth |
| A5 | 권한 편집기 하위 전 요소가 뷰포트 안 | maxRight 1131.8/366.0 ≤ innerWidth |
| A6 | `TrainerMgmtPanel` sticky 헤더는 의도적 full-bleed 유지 | left 0.0, width == innerWidth |
| B1·B2 | `/trainer` 주간목표 카드와 초대 카드 폭·좌우 정렬 일치, full-bleed 아님 | left 416.3/24.0, width 607.5/342.0 |
| B3 | 초대 카드 기본 접힘 = 한 줄, 펼치면 이메일 입력 노출 | 42.5→267.3 / 50.0→336.0 |
| B4 | 접힘 `펼치기 ▾` / 펼침 `접기 ▴` 전환 | 보이는 span 확인 |
| B5 | 접힘 상태에서도 `수락 대기 1` 뱃지 노출 | 있음 |
| B6 | `← 마스터 메뉴`가 배너 행(본문 첫 카드보다 위) | pill.top 55.9 < goal.top 108.0 |
| X | 페이지 런타임 에러 | 0건 |

증거 스크린샷: `docs/qa/trainer-admin-shell-evidence/`.

## 한계 (거짓 PASS 가능 조건)

- 픽스처는 `/admin/trainers`·`/trainer` 의 상단 셸 블록만 재현한다. `TrainerCohortView` 본문,
  `middleware.ts` 리다이렉트, 실제 세션 분기는 이 스크립트의 검증 대상이 아니다.
- 합성 초대 데이터는 pending 1건 고정 — 0건·다건·만료·취소 표시는 미검증.
- B3 의 60px 임계는 summary 한 줄 가정이다. summary 가 두 줄이 되면 판정이 왜곡된다.
- 합성 `/api/admin/trainer-access` 가 빈 목록을 주므로 권한 편집기는 오류 안내 상태로 렌더된다.
  폭·정렬 단정에는 영향이 없지만 편집기 내부 상태 회귀는 이 스크립트가 잡지 않는다.
- 운영 배포 후 실사용 확인은 별건 — 이 문서는 로컬 브라우저 검증 증거일 뿐이다.
