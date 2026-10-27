> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 선택한 업체의 파란 틀 아래 모서리가 안쪽 흰 바탕에 덮여 끊겨 보이던 문제를 고친다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: app/(app)/payment/_components/ContractRow.tsx 펼침(inline) 바탕
> - **읽고 나면 알 수 있는 것**: 진짜 원인, 앞선 날짜 칸 수정과의 관계
> - **관련 문서**: docs/worklog.md 2026-10-27
# 계획
1. belie 아이폰 캡처: 선택 업체 파란 틀(ContractListTable 펼침, rounded-b-xl border-blue-400 bg-white)의 아래 두 모서리가 비어 보임.
2. 원인: 안쪽 ContractRow(inline) 뿌리가 네모난 bg-white → 틀의 둥근 모서리 선 위에 칠해짐(자식은 부모 테두리 위에 그려진다).
3. 수정: inline 뿌리 바탕 제거(감싼 틀 2곳 모두 bg-white). 앞선 #날짜 칸 min-width 수정은 다른 넘침 예방으로 유지.
