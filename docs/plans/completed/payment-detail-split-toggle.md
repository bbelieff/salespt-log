> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납 PC 상세의 「기본 너비」 버튼을 업체정보 최대 ↔ 진행 최대 전환 그림 버튼으로 바꾼다(belie 2026-11-01).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/_components/DetailSplitToggle.tsx`, `app/(app)/payment/page.tsx`
> - **읽고 나면 알 수 있는 것**: 버튼이 무엇을 바꾸나 · 확인 방법
> - **관련 문서**: [components.md](../../design/components.md)

# 상세 두 칸 넓히기 전환

- 누를 때마다 `detailLeftPct` 를 62(업체정보 최대) ↔ 38(진행 최대)로 번갈아 바꾼다. 기준 = 지금 값이 50 이상이면 업체정보가 넓은 것. 목록 칸은 예전처럼 가장 좁게 돌린다.
- 버튼은 글자 대신 두 칸 그림(넓은 칸이 진하게). 테두리·높이는 예전 「기본 너비」와 같다. 설명은 aria-label·title.
- 끌어서 너비를 바꾸는 손잡이(38~62)는 그대로.

## 확인
- 단위 시험 `tests/components/payment-detail-split-toggle.test.ts`, 기존 배너 시험 갱신.

되돌리기: squash revert 1회(화면만).
