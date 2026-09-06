@echo off
setlocal
cd /d "%~dp0"

echo Starting FraudCopilot dev server...
start "FraudCopilot Dev Server" cmd /k npm run dev

echo Waiting for http://localhost:3000 ...
set /a ATTEMPTS=0

:waitloop
set /a ATTEMPTS+=1
curl -s -o nul -w "%%{http_code}" http://localhost:3000 > "%TEMP%\fraudcopilot_status.txt" 2>nul
set /p STATUS=<"%TEMP%\fraudcopilot_status.txt"
del "%TEMP%\fraudcopilot_status.txt" >nul 2>&1

if "%STATUS%"=="200" goto ready
if %ATTEMPTS% GEQ 60 goto timeout

timeout /t 1 /nobreak >nul
goto waitloop

:ready
start "" http://localhost:3000
goto end

:timeout
echo Server did not respond after 60s - opening anyway, refresh if it is blank.
start "" http://localhost:3000

:end
endlocal
