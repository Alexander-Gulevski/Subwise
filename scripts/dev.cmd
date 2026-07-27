@echo off
rem Запуск dev-сервера на версии Node из .nvmrc.
rem
rem Нужен потому, что глобальный Node в системе может быть старее:
rem скрипт подставляет нужную версию только для этого процесса
rem и не трогает системный симлинк nvm.

cd /d "%~dp0.."

set "NODEVER="
for /f "usebackq tokens=* delims= " %%v in (".nvmrc") do set "NODEVER=%%v"

if "%NODEVER%"=="" (
  echo [dev.cmd] Не удалось прочитать .nvmrc
  exit /b 1
)

if "%NVM_HOME%"=="" (
  echo [dev.cmd] NVM_HOME не задан — nvm не установлен?
  exit /b 1
)

set "NODEDIR=%NVM_HOME%\v%NODEVER%"

if not exist "%NODEDIR%\node.exe" (
  echo [dev.cmd] Node %NODEVER% не найден в %NODEDIR%
  echo [dev.cmd] Установи: nvm install %NODEVER%
  exit /b 1
)

set "PATH=%NODEDIR%;%PATH%"

call npm run dev
