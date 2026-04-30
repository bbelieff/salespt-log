<#
.SYNOPSIS
    Galaxy Book 터치 기능(터치스크린/터치패드) 자동 토글 스크립트.

.DESCRIPTION
    현재 상태를 감지해서 켜져 있으면 끄고, 꺼져 있으면 켭니다.
    관리자 권한이 필요하며, .bat 런처가 자동으로 권한을 상승시킵니다.

    탐지 대상:
      - HID-compliant touch screen (터치스크린)
      - HID-compliant touch pad / I2C HID Device 중 터치패드 (옵션)

.PARAMETER Target
    'Screen' (기본): 터치스크린만 토글
    'Pad'         : 터치패드만 토글
    'Both'        : 둘 다 토글

.PARAMETER Action
    'Toggle' (기본): 현재 상태의 반대로
    'Disable'      : 강제 끄기
    'Enable'       : 강제 켜기

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Toggle-GalaxyBookTouch.ps1
    powershell -ExecutionPolicy Bypass -File .\Toggle-GalaxyBookTouch.ps1 -Target Both
    powershell -ExecutionPolicy Bypass -File .\Toggle-GalaxyBookTouch.ps1 -Action Disable
#>

[CmdletBinding()]
param(
    [ValidateSet('Screen', 'Pad', 'Both')]
    [string]$Target = 'Screen',

    [ValidateSet('Toggle', 'Disable', 'Enable')]
    [string]$Action = 'Toggle',

    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Show-Toast {
    param([string]$Message, [string]$Title = 'Galaxy Book Touch Toggle')
    if ($Quiet) { return }
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        $n = New-Object System.Windows.Forms.NotifyIcon
        $n.Icon = [System.Drawing.SystemIcons]::Information
        $n.Visible = $true
        $n.ShowBalloonTip(3000, $Title, $Message, [System.Windows.Forms.ToolTipIcon]::Info)
        Start-Sleep -Milliseconds 3500
        $n.Dispose()
    } catch {
        Write-Host "[$Title] $Message"
    }
}

function Get-TouchDevices {
    param([string]$Kind)

    switch ($Kind) {
        'Screen' {
            Get-PnpDevice -Class HIDClass -ErrorAction SilentlyContinue |
                Where-Object { $_.FriendlyName -match 'touch screen|touchscreen' }
        }
        'Pad' {
            $hid = Get-PnpDevice -Class HIDClass -ErrorAction SilentlyContinue |
                Where-Object { $_.FriendlyName -match 'touch pad|touchpad|precision touchpad' }
            $mouse = Get-PnpDevice -Class Mouse -ErrorAction SilentlyContinue |
                Where-Object { $_.FriendlyName -match 'touch pad|touchpad|precision' }
            @($hid) + @($mouse) | Where-Object { $_ }
        }
    }
}

function Set-DeviceState {
    param(
        [Parameter(Mandatory)] $Devices,
        [Parameter(Mandatory)][ValidateSet('Enable','Disable')] [string]$DesiredState
    )

    if (-not $Devices -or @($Devices).Count -eq 0) {
        return @{ Count = 0; State = $DesiredState }
    }

    foreach ($d in $Devices) {
        try {
            if ($DesiredState -eq 'Disable') {
                Disable-PnpDevice -InstanceId $d.InstanceId -Confirm:$false -ErrorAction Stop
            } else {
                Enable-PnpDevice  -InstanceId $d.InstanceId -Confirm:$false -ErrorAction Stop
            }
        } catch {
            Write-Warning "장치 '$($d.FriendlyName)' $DesiredState 실패: $($_.Exception.Message)"
        }
    }
    return @{ Count = @($Devices).Count; State = $DesiredState }
}

function Invoke-ToggleForKind {
    param([string]$Kind)

    $devices = Get-TouchDevices -Kind $Kind
    if (-not $devices -or @($devices).Count -eq 0) {
        Show-Toast "[$Kind] 해당 장치를 찾을 수 없습니다."
        return
    }

    switch ($Action) {
        'Disable' { $desired = 'Disable' }
        'Enable'  { $desired = 'Enable'  }
        default {
            # Toggle: 하나라도 'OK'(켜짐)면 끔, 전부 꺼져 있으면 켬.
            $anyEnabled = $devices | Where-Object { $_.Status -eq 'OK' }
            $desired = if ($anyEnabled) { 'Disable' } else { 'Enable' }
        }
    }

    $result = Set-DeviceState -Devices $devices -DesiredState $desired
    $kindKr = if ($Kind -eq 'Screen') { '터치스크린' } else { '터치패드' }
    $stateKr = if ($desired -eq 'Disable') { '끔' } else { '켬' }
    Show-Toast "$kindKr $($result.Count)개 $stateKr 완료"
    Write-Host ("[{0}] {1} -> {2} ({3} devices)" -f (Get-Date -Format 'HH:mm:ss'), $Kind, $desired, $result.Count)
}

if (-not (Test-IsAdmin)) {
    Write-Error "관리자 권한이 필요합니다. .bat 런처를 사용하거나 PowerShell을 관리자 권한으로 실행하세요."
    exit 2
}

switch ($Target) {
    'Screen' { Invoke-ToggleForKind -Kind 'Screen' }
    'Pad'    { Invoke-ToggleForKind -Kind 'Pad' }
    'Both'   {
        Invoke-ToggleForKind -Kind 'Screen'
        Invoke-ToggleForKind -Kind 'Pad'
    }
}
