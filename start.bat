@echo off
echo ================================
echo SpeakX Evaluator - Quick Start
echo ================================
echo.

REM Check if .env file exists and has API key
findstr /C:"GEMINI_API_KEY=" .env > nul 2>&1
if %errorlevel% equ 0 (
    findstr /C:"GEMINI_API_KEY=your_gemini_api_key_here" .env > nul 2>&1
    if %errorlevel% equ 0 (
        echo [WARNING] Please add your Gemini API key to the .env file
        echo.
        echo 1. Get your API key from: https://makersuite.google.com/app/apikey
        echo 2. Open .env file
        echo 3. Replace 'your_gemini_api_key_here' with your actual API key
        echo.
        pause
    ) else (
        echo [OK] Gemini API key configured
    )
) else (
    echo [WARNING] .env file not found or missing API key
    echo Please create a .env file with your GEMINI_API_KEY
    echo.
    pause
)

echo.
echo Starting backend server on port 3000...
echo.

start "SpeakX Backend" cmd /k "npm start"

timeout /t 3 /nobreak > nul

echo.
echo Starting frontend server on port 8000...
echo.

start "SpeakX Frontend" cmd /k "python -m http.server 8000"

timeout /t 2 /nobreak > nul

echo.
echo ================================
echo Servers Started!
echo ================================
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:8000
echo.
echo Opening application in browser...
echo.

timeout /t 2 /nobreak > nul

start http://localhost:8000

echo.
echo Press any key to stop all servers...
pause > nul

taskkill /FI "WindowTitle eq SpeakX Backend*" /T /F > nul 2>&1
taskkill /FI "WindowTitle eq SpeakX Frontend*" /T /F > nul 2>&1

echo.
echo Servers stopped.
echo.
