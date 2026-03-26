@echo off
setlocal
cd /d %~dp0

echo xSearch を起動しています...
echo.

if not exist node_modules (
    echo 初回起動のため、必要なファイルを準備しています...
    echo (この処理には数分かかる場合があります)
    call npm install
)

echo.
echo ブラウザが起動します。しばらくお待ちください...
start http://localhost:3000

call npm run dev

pause
