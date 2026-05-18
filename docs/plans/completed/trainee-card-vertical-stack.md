> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: TraineeCard 의 팀·담당 가로 → 세로 stack 재편 + email 숨김 + 담당: 콜론.
> - **누가 읽나요**: 개발자 (UI 레이아웃 의도)
> - **어떤 기능·작업과 연결?**: `components/auth/TraineeCard.tsx`
> - **읽고 나면 알 수 있는 것**: 왜 가로→세로? 어떻게 3 액션 버튼 가리지 않게?
> - **관련 문서**: `docs/design/components.md`

# Trainee card vertical stack

## 배경 (사용자 피드백 2026-05-14)

PR #184 가 팀·담당 가로 swap + flex-1 로 풀폭 확장했는데 사용자가 추가 요청:

> [1] 팀이 윗줄이고 담당이 아랫줄이 되게끔. 취지가 아래로 긴 게 들어가게.
>     세 버튼을 가리게 되면 안되니까  
> [2] 담당에 콜론(:) 붙여줘  
> [4] 수강생 아래줄 메일이 걸리적거리니까 메일은 수강생관리에서 보이지 않게

## 변경

### 정보 블록 구조 (세로 stack)
```
[이름 + 🔗+N 배지]      ← email 제거
[팀 [input 70px]]      ← 윗줄, compact
[담당: 김종근, 황의진 ▼] ← 아랫줄, w-full + break-words (multi-line 허용)
```

- email: 화면에서 숨김. 시트 공유 정보는 `+N` 배지 hover 로 확인 가능.
- 팀 / 담당: 가로 한 줄 공유 → 세로 stack (각자 own row).
- 담당 button: `w-full break-words` — 트레이너 많아지면 줄바꿈으로 아래로 늘어남.
- 라벨에 콜론 추가: `담당` → `담당:`.

### 왜 3 버튼 안 가리는가?

전체 카드 구조 (mobile, flex-col content-wrapper):
```
[handle] [content-wrapper:
            info-block: name → 팀 → 담당 (다중 줄 가능)
            buttons-block: 유보 / 시트 / 웹앱
         ]
```

담당이 아래로 늘어나면 info-block 의 높이만 커지고, 그 아래의 buttons-block 은 자동으로 더 아래로 밀려남. 같은 row 의 같은 컬럼에 있어서 절대 가려지지 않음.

## 검증

- [x] `bash scripts/check.sh` 통과
- [ ] 사용자 라이브: 팀 → 담당 세로 stack
- [ ] 사용자 라이브: email 안 보임
- [ ] 사용자 라이브: 담당 멀티 트레이너 시 아래로 늘어남 + 버튼 안 가림
