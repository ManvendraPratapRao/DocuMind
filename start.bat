@echo off
echo ===================================================
echo   DocuMind AI - Starting Full Stack
echo ===================================================
echo.

echo [1/3] Checking Backend Dependencies...
cd /d "%~dp0"
call .\venv\Scripts\activate
pip install -r requirements.txt -q

echo.
echo [2/3] Starting Backend (FastAPI on :8000)...
start "DocuMind Backend" cmd /k "cd /d %~dp0 && .\venv\Scripts\activate && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

timeout /t 2 /nobreak >nul

echo [3/3] Checking Frontend Dependencies ^& Starting (Vite)...
start "DocuMind Frontend" cmd /k "cd /d %~dp0\frontend && npm install && npm run dev"

echo.
echo Both servers are starting in separate windows!
echo   Backend  : http://localhost:8000
echo   Frontend : http://localhost:5173  (or 5174 if 5173 is in use)
echo   API Docs : http://localhost:8000/docs
echo.
echo You can close this window.
