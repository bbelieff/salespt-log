# Galaxy Book Touch Toggle

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 갤럭시북의 터치스크린/터치패드를 더블클릭 한 번 또는 핫키 한 번으로 켜고 끄는 Windows 응용 스크립트.
> - **누가 읽나요**: 갤럭시북 사용자 (개발자/일반 사용자 모두)
> - **어떤 기능·작업과 연결?**: `tools/galaxy-book-touch-toggle/` (salespt-log 본 프로젝트와 무관한 단독 유틸)
> - **읽고 나면 알 수 있는 것**: 어떻게 설치/실행/핫키 등록하는지, 내부적으로 무엇을 호출하는지
> - **관련 문서**: [Microsoft - Enable/Disable Touchscreen](https://support.microsoft.com/en-us/windows/enable-and-disable-a-touchscreen-in-windows-b774e29d-be94-990f-c20f-e02892e572fc)

---

## 동작 방식

Windows의 표준 명령 `Get-PnpDevice` / `Disable-PnpDevice` / `Enable-PnpDevice` 를 이용해
HID 클래스의 터치스크린(`HID-compliant touch screen`) 또는 터치패드를
**현재 상태의 반대로 토글**합니다. 별도 드라이버나 외부 프로그램은 필요 없습니다.

핵심 한 줄(터치스크린 끄기):
```powershell
Get-PnpDevice | Where-Object { $_.FriendlyName -like '*touch screen*' } |
  Disable-PnpDevice -Confirm:$false
```

본 도구는 위 명령에 다음을 더한 것입니다.
- 현재 상태 자동 감지 → **토글**
- 터치패드 옵션
- 관리자 권한 자동 상승 (UAC 한 번)
- 풍선 알림(Toast)

## 파일 구성

| 파일 | 설명 |
|---|---|
| `GalaxyBookTouchToggle.bat` | **더블클릭 진입점**. UAC 자동 상승 후 PS1 실행 |
| `Toggle-GalaxyBookTouch.ps1` | 실제 토글 로직 |
| `Install-Shortcut.ps1` | 바탕화면 바로가기 + 핫키 자동 등록 |

## 설치

이 폴더를 PC의 원하는 위치(예: `C:\Tools\GalaxyBookTouchToggle\`)에 복사합니다.
별도의 빌드/설치 과정은 없습니다.

## 사용법

### 1) 더블클릭 (가장 단순)
`GalaxyBookTouchToggle.bat` 더블클릭 → UAC 동의 → 터치스크린 토글.

### 2) 인자로 대상/동작 지정
```cmd
GalaxyBookTouchToggle.bat              :: 터치스크린 토글 (기본)
GalaxyBookTouchToggle.bat Pad          :: 터치패드 토글
GalaxyBookTouchToggle.bat Both         :: 둘 다 토글
GalaxyBookTouchToggle.bat Screen Disable  :: 강제 끄기
GalaxyBookTouchToggle.bat Screen Enable   :: 강제 켜기
```

### 3) 핫키(Ctrl+Alt+T) 등록 — 권장
PowerShell을 열고 이 폴더에서:
```powershell
powershell -ExecutionPolicy Bypass -File .\Install-Shortcut.ps1
```
바탕화면에 `Galaxy Book Touch Toggle.lnk` 가 생기고 `Ctrl+Alt+T` 핫키가 등록됩니다.
다른 키 조합을 원하면:
```powershell
powershell -ExecutionPolicy Bypass -File .\Install-Shortcut.ps1 -Hotkey 'Ctrl+Alt+F12' -Target Both
```

핫키가 안 먹는 경우(드물게) 만들어진 바로가기를
`%AppData%\Microsoft\Windows\Start Menu\Programs` 로 복사하세요.

## 직접 PowerShell로 실행

```powershell
# 토글
powershell -ExecutionPolicy Bypass -File .\Toggle-GalaxyBookTouch.ps1

# 터치패드까지
powershell -ExecutionPolicy Bypass -File .\Toggle-GalaxyBookTouch.ps1 -Target Both

# 강제 끄기 / 켜기
powershell -ExecutionPolicy Bypass -File .\Toggle-GalaxyBookTouch.ps1 -Action Disable
powershell -ExecutionPolicy Bypass -File .\Toggle-GalaxyBookTouch.ps1 -Action Enable
```

## 동작 확인

```powershell
Get-PnpDevice -Class HIDClass |
  Where-Object FriendlyName -match 'touch' |
  Select-Object Status, FriendlyName
```
- `Status` 가 `OK` → 켜짐
- `Error` / `Unknown` → 꺼짐

## 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| UAC 창이 두 번 뜸 | 정상. .bat → .ps1 전환에서 1회만 떠야 함. 두 번 뜨면 PowerShell 정책 점검 |
| "장치를 찾을 수 없습니다" | 장치이름이 영문이 아닐 수 있음 → `Get-PnpDevice` 결과에서 키워드 확인 후 PS1 의 `-match` 패턴 수정 |
| 터치패드만 따로 안 꺼짐 | 모델별로 PnP 클래스가 달라 `HIDClass` + `Mouse` 둘 다 시도. 그래도 미검출이면 장치이름을 알려주세요 |
| 핫키 안 먹음 | 바로가기를 시작 메뉴 폴더로 옮기거나 `Win+R` → `shell:Programs` 후 그 폴더에 복사 |

## PC 클로드(Claude Code)에서 확인하기

이 폴더는 `bbelieff/salespt-log` 의 `claude/galaxy-book-touchpad-toggle-k6lu1` 브랜치에 커밋됩니다.
PC에서 다음 중 하나로 받을 수 있습니다.

```bash
# 처음 받을 때
git fetch origin claude/galaxy-book-touchpad-toggle-k6lu1
git checkout claude/galaxy-book-touchpad-toggle-k6lu1

# 그 후
cd tools/galaxy-book-touch-toggle
explorer .   # Windows 탐색기로 열기
```

PC 버전 Claude Code에서 이 디렉터리를 열면 `.bat` / `.ps1` 파일이 보이고
바로 실행/편집할 수 있습니다.
