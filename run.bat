@echo off
title YTDLnis Web
echo ===================================================
echo             Iniciando YTDLnis Web
echo ===================================================
echo.
cd /d "%~dp0backend"
if not exist "venv\Scripts\python.exe" (
    echo [ERROR] Entorno virtual no encontrado en backend\venv.
    pause
    exit /b 1
)

echo [INFO] Servidor disponible en: http://127.0.0.1:8000
echo [INFO] Presiona Ctrl+C para detener el servidor.
echo.
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
