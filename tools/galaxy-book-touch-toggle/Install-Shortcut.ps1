<#
.SYNOPSIS
    바탕화면에 GalaxyBookTouchToggle.bat 바로가기를 만들고
    핫키(Ctrl+Alt+T)를 등록합니다.

.NOTES
    바로가기 핫키는 Windows 표준 기능이라 별도 백그라운드 프로그램이 필요 없습니다.
    바로가기에 핫키를 지정하면 시작 메뉴/바탕화면/시작프로그램 폴더에 있을 때 작동합니다.
#>

param(
    [string]$Hotkey = 'Ctrl+Alt+T',
    [ValidateSet('Screen','Pad','Both')] [string]$Target = 'Screen'
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$batPath   = Join-Path $scriptDir 'GalaxyBookTouchToggle.bat'

if (-not (Test-Path $batPath)) {
    throw "런처를 찾을 수 없습니다: $batPath"
}

$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'Galaxy Book Touch Toggle.lnk'

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($lnkPath)
$Shortcut.TargetPath       = $batPath
$Shortcut.Arguments        = $Target
$Shortcut.WorkingDirectory = $scriptDir
$Shortcut.WindowStyle      = 7   # 최소화로 실행
$Shortcut.IconLocation     = "$env:SystemRoot\System32\imageres.dll, 109"
$Shortcut.Description      = 'Galaxy Book 터치 기능 토글'
$Shortcut.Hotkey           = $Hotkey
$Shortcut.Save()

Write-Host "바로가기 생성 완료: $lnkPath"
Write-Host "핫키: $Hotkey  (Target=$Target)"
Write-Host ""
Write-Host "TIP) 핫키가 안 먹으면 바로가기를 시작 메뉴(Start Menu) 폴더에 복사하세요:"
Write-Host "     %AppData%\Microsoft\Windows\Start Menu\Programs"
