> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납 상세 「🗺️ 로드맵 메모」 칸이 적힌 내용만큼 자동으로 늘어나게 한다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/_components/ContractRow.tsx`, `lib/hooks/useAutoGrow.ts`, `components/company-info/CompanyInfoField.tsx`
> - **읽고 나면 알 수 있는 것**: 무엇을 바꿨는지, 어떤 공용 장치를 쓰는지, 되돌리는 법
> - **관련 문서**: 없음

# 로드맵 메모 자동 높이

belie(2026-11-22): 「로드맵메모는 현재 적혀있는 내용만큼 다 보이게 필드를 확장」.

- 전: `rows={1}` + 손잡이로 늘리기 → 긴 메모가 한 줄만 보임.
- 후: 업체정보 칸의 `useAutoGrow`(2026-11-17)를 `lib/hooks/useAutoGrow.ts` 로 꺼내 공용화하고 로드맵 메모에 붙임. 쓰는 동안·칸 너비가 바뀔 때 다시 맞춤. 손잡이는 없앰(자동이라 불필요).
- 저장 값·서버 무변경. 되돌리기 = squash revert.
