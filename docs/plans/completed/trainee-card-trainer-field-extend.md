---
status: completed
completed: 2026-05-14
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: TraineeCard 의 "담당"·"팀" 순서 swap + 담당 필드 flex-1 로 카드 우측 끝까지 확장.
> - **누가 읽나요**: 개발자 (UI 레이아웃 의도)
> - **어떤 기능·작업과 연결?**: `components/auth/TraineeCard.tsx`
> - **읽고 나면 알 수 있는 것**: 왜 담당이 flex-1 인가? 트레이너 multi-assign UX 보호?
> - **관련 문서**: `docs/design/components.md`

# Trainee card: trainer field extend

## 배경 (2026-05-14 사용자 제안)

PR #182 가 "담당 미배정" 한글 wrap 은 잡았지만, 사용자 제안:
"팀을 담당과 자리를 바꾸고 필드너비를 웹앱이 끝나는 자리까지 확장가능하게 하면
담당이 여러명이 되어도 안깨질거같은데"

## 변경

`components/auth/TraineeCard.tsx` 의 메타데이터 row (담당·팀):

### Before
```
[담당 button (inline, content-sized)] · [팀 input 70px]
```

### After
```
[팀 input 70px shrink-0] · [담당 button flex-1 (카드 우측 끝까지)]
```

- **순서 swap**: 팀 first (compact), 담당 second.
- **담당 button**: `flex-1 min-w-0` 으로 남은 공간 전체 차지.
- **내부 구조**: 담당 라벨 (shrink-0) · trainerNames (flex-1 truncate) · chevron (shrink-0).
- **truncate**: 긴 trainerNames 는 ellipsis. 토글 펼침에서 전체 확인.

## 효과

- 트레이너 1명: 기존과 시각 거의 동일.
- 트레이너 2~3명: 카드 우측 끝까지 펴져 모든 이름 표시 가능.
- 트레이너 N명 (overflow): truncate 로 "..." 표시. 토글로 풀 리스트.
- 모바일 narrow 카드: 팀+담당 한 줄 안에 들어가지 않으면 flex-wrap 으로 줄바꿈 (담당이 두 번째 row 로 떨어지면서 자동 풀폭).

## 검증

- [x] `bash scripts/check.sh` 통과
- [ ] 사용자 라이브: 트레이너 2명 이상 배정 시 안 깨짐
- [ ] 사용자 라이브: 모바일에서 팀+담당 정상 표시
