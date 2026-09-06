---
slug: remote-control-sessions
status: active
created: 2026-09-06
owner: belie(운용) · 세션(준수)
related: worker-onboarding, thinking-protocol
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 폰·웹 「코드」 목록의 세션이 왜 **연결 해제됨**이 되는지, 어떻게 되살리는지, 애초에 안 끊기게 어떻게 여는지.
> - **누가 읽나요**: belie(세션을 여는 사람), 모든 신규 세션
> - **어떤 기능·작업과 연결?**: 세션 개설 전반 · CLAUDE.md §6.10 · scripts/ops/rc-doctor.mjs
> - **읽고 나면 알 수 있는 것**: 내 세션이 끊긴 진짜 이유는? / 폰만 들고 밖에서 살릴 수 있나? / 다음부터 안 끊기게 어떻게 열지?
> - **관련 문서**: docs/playbooks/worker-onboarding.md · [공식 문서](https://code.claude.com/docs/en/remote-control)

# 원격 세션이 끊기는 이유와 안 끊기게 여는 법

## 0. 먼저 — 내 세션은 셋 중 어느 것인가

폰 앱 **코드** 탭 목록에는 성격이 다른 세션이 **섞여서** 보인다. 아이콘으로 구분한다.

| 종류 | 실제로 코드가 도는 곳 | PC 꺼도 되나 | 폰에서 되살릴 수 있나 |
|---|---|---|---|
| **클라우드 세션** (claude.ai/code) | Anthropic 클라우드 컨테이너 | ✅ 된다 | ✅ 된다 |
| **원격 제어** (Remote Control) — 💻 아이콘 | **내 PC 의 `claude` 프로세스** | ❌ 안 된다 | ❌ **불가능** |
| **Dispatch** (데스크탑 앱) | 내 PC 의 Claude 데스크탑 앱 | ❌ 안 된다 | ❌ 불가능 |

> **핵심**: 목록에서 `연결됨 / 연결 해제됨` 이라고 뜨는 💻 세션은 **전부 원격 제어**다.
> 원격 제어는 클라우드가 아니라 **내 PC 를 폰이 리모컨으로 조종하는 것**이다.
> 그래서 **PC 에서 `claude` 가 살아있는 동안만** 「연결됨」이다. 이건 고장이 아니라 설계다.

## 1. 「연결 해제됨」이 되는 원인 (많은 순서대로)

| # | 원인 | 무슨 일이 벌어지나 | 자동 복구? |
|---|---|---|---|
| 1 | **`claude` 프로세스가 죽음** — 터미널 창 닫기 · `Ctrl+C` · VS Code 종료 · PC 재부팅·업데이트 | 프로세스 종료 **수 초 내**로 앱 목록이 오프라인으로 바뀐다 | ❌ |
| 2 | 절전/네트워크 순단 | Claude Code 가 알아서 재연결한다 | ✅ **자동** |
| 3 | VPN·프록시·방화벽이 403 으로 막음 | 3분간 재시도 후 끊고, 무엇이 막았는지 사유를 남긴다 | ❌ |
| 4 | 상태 신호(heartbeat) 30분 실패 | `about 30 minutes` 문구와 함께 끊긴다 | ❌ |
| 5 | 다른 기기·세션이 **가져감**, 또는 앱에서 종료·보관(archive) | 「다른 곳에서 넘어갔다」는 사유가 뜬다 | ❌ (의도된 동작) |
| 6 | 로그인·환경 문제 | 아래 §4 진단으로 잡는다 | ❌ |
| 7 | 서버 모드에서 **네트워크가 10분 이상** 끊김 | `claude remote-control` 프로세스 자체가 종료된다 | ❌ |

**절전(잠자기)은 원인이 아니다.** 노트북을 덮었다가 열면 알아서 다시 붙는다.
**터미널 창을 닫는 것이 1번 원인**이고, 실제로 대부분이 이것이다.

> 참고 — 목록에 `컴퓨터에서 로그인해 주세요` 라고 붙은 세션이 있다. 공식 문서에서 이 정확한
> 문구는 확인하지 못했다(2026-09-06 실측). 뜻은 **「그 PC 에서 로그인된 `claude` 를 찾을 수
> 없다」** 로 읽는 게 맞고, 조치는 그 PC 에서 `claude auth login` 후 §2 복구다. — *미검증*

## 2. 되살리기 — 밖에서 되는 것 / 안 되는 것

### ❌ 폰만으로는 못 살린다
원격 제어 세션은 **내 PC 에서 프로그램이 다시 떠야** 살아난다. 폰은 리모컨일 뿐,
꺼진 PC 를 켜거나 프로그램을 실행시킬 수단이 없다. 목록에 남은 옛 세션들은
**기록(대화 내용)** 이지 살아있는 세션이 아니다.

### ✅ PC 앞에 앉았을 때 — 끊긴 지 **4시간 안**
그 세션을 시작했던 **같은 폴더**에서:

```bash
claude remote-control --continue          # 그 폴더의 마지막 세션 하나 복구
claude remote-control                     # 그 서버가 돌리던 세션 전부 복구
claude remote-control --session-id <id>   # 특정 세션만 (id = claude.ai/code/ 뒤 문자열)
```

### ✅ 끊긴 지 **4시간 넘음**
서버 쪽 복구 창이 닫혔다 → **새 세션**을 여는 수밖에 없다. 다만 **대화 내용은 내 PC 에
그대로 있다**:

```bash
claude --resume        # 이전 대화 고르기 → 그 대화가 그대로 이어진다
/remote-control        # 그 상태에서 다시 원격 연결 (짧게 /rc)
```

> 8월 11·20·21일 자로 남은 세션들이 여기 해당한다. 이미 4시간을 한참 넘겼으므로
> **목록에서 지워도 무방하다** — 기록만 남은 껍데기다.

### ✅ 진짜로 「밖에서」 살리고 싶다면 → 애초에 **클라우드 세션**으로 열어라
PC 를 꺼도 계속 돌고, 폰에서 그대로 이어받는다. 지금 이 문서를 쓴 세션이 그 방식이다.
- 폰: **코드** 탭 → 우하단 **+ 새 세션** → 레포(`bbelieff/salespt-log`) 선택 → 지시 입력
- 웹: <https://claude.ai/code/new>

**대신 클라우드 세션은 내 PC 파일·MCP·VPS 키를 못 쓴다.** 그래서 둘을 나눠 쓴다 (§3 표).

## 3. 안 끊기게 여는 법 (예방)

### ① 자동 연결을 켜둔다 — **가장 효과 큼**
켜두면 PC 에서 `claude` 를 켜는 **모든 세션이 자동으로 폰에 뜬다**. `/remote-control` 을
매번 칠 필요도, 깜빡할 일도 없다.

- **터미널에서**: `claude` 실행 → `/config` 입력 → **Enable Remote Control for all sessions** → `true`
- **또는 파일로**: 내 PC 의 `~/.claude/settings.json`
  (윈도우 = `C:\Users\<사용자>\.claude\settings.json`) 에

  ```json
  { "remoteControlAtStartup": true }
  ```

> ⚠️ **이 설정은 레포에 넣을 수 없다.** 프로젝트 설정(`.claude/settings.json`)에 `true` 를
> 적으면 **무시된다**(레포를 받은 남의 PC 를 마음대로 연결시키지 못하게 하는 안전장치).
> 반드시 **내 PC 의 `~/.claude/settings.json`** 에 넣어야 한다.

### ② 창을 닫지 않는다
- **윈도우**: Windows Terminal **탭**으로 열고, 작업이 끝날 때까지 탭을 닫지 않는다. `Ctrl+C` 금지.
- **VPS·SSH**: 반드시 `tmux` 또는 `screen` 안에서 띄운다. SSH 를 끊어도 프로세스가 산다.
  ```bash
  tmux new -s rc            # 세션 만들기
  claude remote-control --name "경영일지 VPS"
  # Ctrl+B, D 로 빠져나오기 (프로세스는 계속 돔) / 돌아올 땐 tmux attach -t rc
  ```

### ③ PC 절전은 괜찮지만 **종료·재시작**은 안 된다
잠자기는 자동 복구된다. 하지만 윈도우 업데이트 자동 재시작은 프로세스를 죽인다 —
장기 작업 전에 **활성 시간(Active hours)** 을 걸어둔다.

### ④ 세션에 **이름**을 붙인다
```bash
claude remote-control --name "경영일지 DC 작업원D"
```
이름이 없으면 `myhost-graceful-unicorn` 같은 자동 이름이 붙어 목록에서 못 찾는다.

### ⑤ 용도별로 나눠 연다

| 하려는 일 | 어떻게 열까 |
|---|---|
| 로컬 파일·워크트리·`check.sh`·git 푸시 | **원격 제어** (PC 에서 `claude`, 창 유지) |
| 밖에 나가 있는 동안 돌려둘 일 · PR 감시 · 문서 작업 | **클라우드 세션** (claude.ai/code) |
| VPS 배포·운영 스크립트 | **원격 제어 + tmux** (VPS 안에서) |

## 4. 진단 한 방 — `rc-doctor`

원격 제어를 **아예 못 붙게 만드는** 환경 문제(로그인 키·프록시 주소·텔레메트리 차단 등)는
증상이 비슷해서 눈으로 못 가린다. 내 PC 에서 한 번 돌린다:

```bash
node scripts/ops/rc-doctor.mjs
```

읽기 전용이고, 문제마다 **무엇을 어떻게 고칠지**까지 같이 찍는다.

## 5. 세션 열 때 체크리스트 (CLAUDE.md §6.10 본체)

- [ ] 이 작업에 **내 PC 파일이 필요한가?** → 아니면 클라우드 세션으로 연다.
- [ ] 원격 제어라면 **자동 연결이 켜져 있나?** (`/config` → Enable Remote Control for all sessions)
- [ ] `--name "<알아볼 이름>"` 을 붙였나?
- [ ] 창을 안 닫을 수 있나? (VPS·장시간이면 **tmux**)
- [ ] 처음 여는 PC 라면 `node scripts/ops/rc-doctor.mjs` 를 한 번 돌렸나?

## 부록 — 자주 나오는 사유 메시지

| 화면에 뜨는 말 | 뜻 | 조치 |
|---|---|---|
| `Remote Control requires a claude.ai subscription` | API 키로 로그인돼 있다 | `ANTHROPIC_API_KEY` 해제 후 `claude auth login` |
| `could not reach the Remote Control server for about 30 minutes` | 상태 신호가 30분 실패 | `/remote-control` 재연결 |
| `Couldn't reconnect to your Remote Control session` | 일시적 실패 — 세션 생사 확인 불가 | `/remote-control` 재시도 |
| `Previous session is unavailable — run /remote-control to start a new one` | 옛 세션 복구 불가 | `/remote-control` 로 새로 시작 |
| 다른 기기가 가져감 / 앱에서 종료됨 | 의도된 동작 | 되찾고 싶을 때만 `/remote-control` |

출처: [Remote Control 공식 문서](https://code.claude.com/docs/en/remote-control) ·
[모바일 문서](https://code.claude.com/docs/en/mobile) (2026-09-06 실측)
