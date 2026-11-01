@echo off
setlocal
cd /d "%~dp0.."
if not exist "index.html" goto missing
if not exist "scripts\serve.py" goto missing
set "demoPython=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%demoPython%" goto bundled
where py >nul 2>nul
if not errorlevel 1 goto launcher
python --version >nul 2>nul
if errorlevel 1 goto noPython
if "%~1"=="--check" goto checkPython
echo Open http://127.0.0.1:8001/ and keep this window open. Ctrl+C stops the server.
python scripts\serve.py 8001
goto result
:checkPython
python --version
goto result
:launcher
if "%~1"=="--check" goto checkLauncher
echo Open http://127.0.0.1:8001/ and keep this window open. Ctrl+C stops the server.
py -3 scripts\serve.py 8001
goto result
:checkLauncher
py -3 --version
goto result
:bundled
if "%~1"=="--check" goto checkBundled
echo Open http://127.0.0.1:8001/ and keep this window open. Ctrl+C stops the server.
"%demoPython%" scripts\serve.py 8001
goto result
:checkBundled
"%demoPython%" --version
:result
if errorlevel 1 goto failed
exit /b 0
:failed
echo Server failed. If port 8001 is busy, see the guide for port 8002.
pause
exit /b 1
:missing
echo Required game files are missing. Keep the complete project directory.
pause
exit /b 1
:noPython
echo Python 3 was not found. Install Python 3 or use https://ting335.github.io/sudoku-game/
pause
exit /b 1
