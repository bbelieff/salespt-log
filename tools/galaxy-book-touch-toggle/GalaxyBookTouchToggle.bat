@echo off
REM ============================================================
REM  Galaxy Book Touch Toggle (.bat 런처)
REM    더블클릭하면 관리자 권한으로 자동 상승 후
REM    Toggle-GalaxyBookTouch.ps1 을 실행해 터치 기능을 토글합니다.
REM
REM  사용법:
REM    GalaxyBookTouchToggle.bat              -> 터치스크린 토글 (기본)
REM    GalaxyBookTouchToggle.bat Pad          -> 터치패드 토글
REM    GalaxyBookTouchToggle.bat Both         -> 둘 다 토글
REM    GalaxyBookTouchToggle.bat Screen Disable -> 강제 끄기
REM    GalaxyBookTouchToggle.bat Screen Enable  -> 강제 켜기
REM ============================================================

setlocal enabledelayedexpansion

set "TARGET=%~1"
set "ACTION=%~2"
if "%TARGET%"=="" set "TARGET=Screen"
if "%ACTION%"=="" set "ACTION=Toggle"

set "SCRIPT_DIR=%~dp0"
set "PS1=%SCRIPT_DIR%Toggle-GalaxyBookTouch.ps1"

REM --- 관리자 권한 확인 ---
net session >nul 2>&1
if %errorlevel% NEQ 0 (
    echo [INFO] 관리자 권한으로 다시 실행합니다...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%TARGET% %ACTION%' -Verb RunAs"
    exit /b
)

REM --- 본 작업 실행 ---
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Target %TARGET% -Action %ACTION%
set "RC=%errorlevel%"

if %RC% NEQ 0 (
    echo.
    echo [ERROR] 실행 실패 ^(코드 %RC%^)
    pause
)

endlocal
exit /b %RC%
