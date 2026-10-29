## 2026-10-29 · 할 일 날짜 칸 글자가 위에 붙던 것(iPhone)
- fix/todo-date-vertical-align. belie: 다음 투두 일정을 바꾸는 아래 창에서 날짜 칸 정렬이 위로 붙음(10-28 캡처에서도 날짜만 위, 시·분은 가운데). 원인 = iPhone 사파리가 모양을 지운(appearance-none) 날짜 칸의 글자를 위에 둠. → 날짜 칸 줄 높이를 칸 높이와 같게(창 h-10→leading-10, 한 줄 입력 h-9→leading-9). 실제 iPhone 확인은 배포 후 belie. 되돌리기 = squash revert.
