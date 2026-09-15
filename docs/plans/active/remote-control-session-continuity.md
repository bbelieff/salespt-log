---
slug: remote-control-session-continuity
status: active
created: 2026-09-06
owner: 세션(구현) · belie(적용)
related: CLAUDE.md §6.10, docs/playbooks/remote-control-sessions.md
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 폰 「코드」 목록 세션이 자꾸 `연결 해제됨` 이 되는 문제 — 원인 규명, 복구 절차 문서화, 재발 방지 지침·진단 도구.
> - **누가 읽나요**: belie, 후속 세션
> - **어떤 기능·작업과 연결?**: 세션 개설 전반 (코드 기능 아님 — 하네스 개선)
> - **읽고 나면 알 수 있는 것**: 왜 끊겼나 / 무엇을 넣었나 / 남은 것은 무엇인가
> - **관련 문서**: docs/playbooks/remote-control-sessions.md

# 원격 세션 연결 유지 (Remote Control continuity)

## 의도
belie: 「이렇게 세션 연결해제가 되는 이유와 외부에서 연결 되살리는 방법 알려줘.
가능하면 세션 열 때 지침으로 잡고 연결 끊어지지 않게 보완.」

## 실측 결론 (2026-09-06, 공식 문서 대조)
- 폰 목록의 💻 세션은 **클라우드가 아니라 내 PC 의 `claude` 프로세스**(Remote Control).
  프로세스가 죽으면 **수 초 내** 오프라인 — 고장이 아니라 설계.
- **잠자기·네트워크 순단은 자동 복구된다.** 끊기는 실질 원인 1위는 **터미널 창을 닫는 것.**
- **폰만으로는 되살릴 수 없다.** PC 에서 `claude` 가 다시 떠야 한다.
  - 4시간 이내: 같은 폴더에서 `claude remote-control --continue|--session-id <id>`
  - 이후: `claude --resume` 으로 대화를 되살린 뒤 `/remote-control`
- 「밖에서도 살아있어야 한다」의 정답은 복구가 아니라 **클라우드 세션으로 여는 것**.

## 한 것
- `docs/playbooks/remote-control-sessions.md` — 세션 3종 구분표, 원인 7가지, 복구 절차,
  예방 5가지, 사유 메시지별 조치표.
- `CLAUDE.md §6.10` — 세션 열 때 지침 5줄(로컬/클라우드 선택 → 자동 연결 → 이름 → 창 유지 → 진단).
- `scripts/ops/rc-doctor.mjs` — 읽기 전용 진단. 연결을 **아예 막는** 설정(API 키·커스텀
  `ANTHROPIC_BASE_URL`·피처플래그 차단 env·`disableRemoteControl`·프로젝트 설정의 `false`)을
  잡고 고치는 법을 출력. FAIL 있으면 exit 1.
- `docs/README.md` playbooks 표에 등재.

## 수용 기준
- [x] 원인이 추측이 아니라 공식 문서 근거로 서술됨 (code.claude.com/docs/en/remote-control · /mobile)
- [x] 복구 절차가 4시간 경계 기준으로 나뉘어 있음
- [x] 「세션 열 때」 지침이 CLAUDE.md 본문에 있음 (컨텍스트 창에만 존재하는 규칙 금지 — §6)
- [x] 진단이 사람 기억이 아니라 **명령 한 줄**로 검증됨 (OK/WARN/FAIL 양쪽 경로 실행 확인)
- [ ] **belie 가 내 PC 에서 자동 연결을 켠다** — 레포에서 강제 불가(프로젝트 설정의 `true` 는
      무시됨). 이것만 사람 손이 필요하다.

## 남은 것 / 되돌리는 법
- 남은 것: belie 의 `~/.claude/settings.json` 적용 + 목록에 남은 옛 세션 정리(기록만 남은 껍데기).
- 되돌리기: 문서·스크립트 추가뿐 — 런타임 코드 무변경. PR revert 로 완전 복구된다.
