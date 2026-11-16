# 2026-11-17 · feat: 업체정보 여러 줄 칸 — 정한 높이 기억

- 목표: belie 「칸마다 정한 높이 기억하게 해줘」. 계획 [company-info-field-height-memory](../plans/completed/company-info-field-height-memory.md).
- 변경: 손잡이로 정한 높이를 칸 종류마다 브라우저 localStorage 에 기억(`ci-field-height:<칸>`), 다시 그릴 때 적용. 최대로 되돌리면 지움. 담당 파일: `components/company-info/CompanyInfoField.tsx`.
- 판단: 「칸마다」= 칸 종류별(업체별 아님) — 업체별로 두면 업체마다 다시 맞춰야 한다. 기기별 화면 편의 값이라 DB·시트는 건드리지 않음.
- 검증: company-info-autogrow 시험(3건), 실제 브라우저 확인(합성 값), `bash scripts/check.sh`.
- 위험·복구: 표시 전용. 되돌리면 높이를 기억하지 않는 이전 동작. 다른 기기·브라우저와는 공유되지 않는다.
