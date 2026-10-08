@echo off
title 3D Drone City Simulation Launcher
echo ===================================================
echo     Starting 3D Autonomous Drone City Simulation
echo ===================================================
echo.

:: 1. Check & Install Node dependencies
if not exist "node_modules\" (
    echo [1/4] Installing Node.js dependencies (npm install)...
    call npm install
) else (
    echo [1/4] Node.js dependencies ready.
)

:: 2. Check Python interpreter / venv
set PYTHON_EXE=python
if exist ".venv\Scripts\python.exe" (
    set PYTHON_EXE=.venv\Scripts\python.exe
) else if exist "GRU MODEL\.venv\Scripts\python.exe" (
    set PYTHON_EXE=GRU MODEL\.venv\Scripts\python.exe
) else (
    echo [2/4] Creating virtual environment (.venv)...
    python -m venv .venv
    call .venv\Scripts\pip install -r requirements.txt
    set PYTHON_EXE=.venv\Scripts\python.exe
)
echo [2/4] Python environment ready (%PYTHON_EXE%).

:: 3. Launch GRU Navigation Model Server (Port 8765)
echo [3/4] Starting GRU Learned Navigation Server on port 8765...
start "GRU Model Server (Port 8765)" cmd /k "title GRU-Server && "%PYTHON_EXE%" -m uvicorn server_fastapi:app --app-dir "GRU MODEL" --host 127.0.0.1 --port 8765"

:: 4. Launch PULP-DroNet Obstacle Avoidance Server (Port 8766)
echo [3/4] Starting PULP-DroNet Avoidance Server on port 8766...
start "PULP-DroNet Server (Port 8766)" cmd /k "title DroNet-Server && "%PYTHON_EXE%" -m uvicorn server:app --app-dir "dronet_service" --host 127.0.0.1 --port 8766"

:: 5. Launch Vite Three.js Dev Server (Port 3000)
echo [4/4] Starting Three.js Web Simulation on port 3000...
timeout /t 2 /nobreak >nul
start http://localhost:3000
call npx vite --host --port 3000
