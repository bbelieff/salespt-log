> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납 PC 상세에서 한쪽 칸을 끝까지 넓히면 그 칸이 떠 보이고 좁힌 칸은 연회색으로 가라앉게 한다(belie 2026-11-01).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/_components/ContractRow.tsx`, `DetailSplitToggle.tsx`, `app/globals.css`
> - **읽고 나면 알 수 있는 것**: 왜 반투명이 아니라 바탕색인가 · 언제 강조되나 · 확인 방법
> - **관련 문서**: [넓히기 전환](../completed/payment-detail-split-toggle.md) · [components.md](../../design/components.md)

# 상세 두 칸 넓힌 칸 강조

- 언제: `detailLeftPct` 가 62(업체정보 최대) 또는 38(진행 최대)일 때만 — `detailSplitFocus()`. 중간 너비는 강조 없음.
- 무엇: 강조 신호는 바탕 하나. 넓힌 칸 = 흰 바탕 + 옅은 그림자, 좁힌 칸 = `#f1f5f9` 바탕. 글자·입력 칸은 건드리지 않는다
  (반투명은 「못 누르는 칸」처럼 보이고 글자 대비가 떨어져 기각). 좁힌 칸에 마우스·포커스가 들어가면 흰 바탕으로 돌아온다.
- 너비 전환은 0.2초(`grid-template-columns` transition). 드래그 중엔 `data-split-dragging` 으로 끈다. 움직임 줄이기 설정이면 전부 끈다.
- 확인: 단위시험(`detailSplitFocus`) + 합성 화면 1440px 에서 버튼 전환 전/후 캡처.
