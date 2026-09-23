---
slug: db-field-alignment-20260924
status: active
created: 2026-09-24
---

# DB생산 필드 정렬

## Intent
4개 채널 추가/편집 폼에서 설명 문구 유무 및 컨트롤 종류 때문에 어긋난 입력칸 정렬을 통일한다. 데이터·계산·자동저장 계약을 보존한다.

## Acceptance Criteria
- [ ] 라벨/컨트롤 높이와 기준선 통일, 예시 문구는 입력 placeholder로 표시.
- [ ] 자동계산 두 필드를 함께 배치, 메모 전체 너비 유지.
- [ ] 320/390/1024/1440px에서 4채널 추가·편집 폼 넘침/잘림 없음.
- [ ] 기존 자동저장 회귀 및 scripts/check.sh 통과.
- [ ] PR 병합·배포 성공·운영 읽기 전용 화면 확인.

## Context
RowForm.tsx, channels.ts, docs/design/tokens.md, docs/design/components.md. Muse 구현, Codex 통합·실측·배포. 실데이터 시험 입력 없음.
