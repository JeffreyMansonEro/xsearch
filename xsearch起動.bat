@echo off
setlocal
cd /d %~dp0

echo ======================================================
echo   xSearch ポータブル版を起動しています...
echo   (ブラウザのセキュリティ制限を回避して起動します)
echo ======================================================
echo.

set TARGET_FILE=%~dp0xsearch_portable.html
set TEMP_PROFILE=%TEMP%\xsearch_chrome_profile

if not exist "%TARGET_FILE%" (
    echo [エラー] %TARGET_FILE% が見つかりません。
    pause
    exit /b
)

echo 起動中: %TARGET_FILE%
echo プロファイル: %TEMP_PROFILE%
echo.

:: ChromeをCORS無効モードで起動
start chrome --user-data-dir="%TEMP_PROFILE%" --disable-web-security --allow-file-access-from-files "%TARGET_FILE%"

echo 起動しました。このウィンドウは閉じても構いません。
timeout /t 5
exit
