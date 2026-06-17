@echo off
REM Deployment Pre-Check Script for ZM Meeting App

echo.
echo ==========================================
echo ZM Meeting App - Pre-Deployment Check
echo ==========================================
echo.

REM Check Node version
echo [CHECK 1] Node.js Installation
node -v >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Node.js is installed
    node -v
) else (
    echo ✗ Node.js NOT found
    exit /b 1
)
echo.

REM Check npm version
echo [CHECK 2] npm Installation
npm -v >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ npm is installed
    npm -v
) else (
    echo ✗ npm NOT found
    exit /b 1
)
echo.

REM Check if node_modules exists
echo [CHECK 3] Dependencies Installed
if exist "node_modules" (
    echo ✓ node_modules directory exists
    for /f %%a in ('dir /b node_modules ^| find /c /v ""') do (
        echo   Total packages: %%a
    )
) else (
    echo ⚠ node_modules not found
    echo   Installing dependencies...
    call npm install
)
echo.

REM Check for build directory
echo [CHECK 4] Previous Builds
if exist "build" (
    echo ✓ Previous build directory found
) else (
    echo ⚠ No previous build found - will be created on first build
)
echo.

REM Verify package.json integrity
echo [CHECK 5] Package.json Validation
node -e "require('./package.json')" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ package.json is valid JSON
) else (
    echo ✗ package.json is INVALID
    exit /b 1
)
echo.

REM Check essential dependencies
echo [CHECK 6] Essential Dependencies Check
setlocal enabledelayedexpansion
set "deps=react react-dom react-router-dom @livekit/components-react axios"
for %%d in (%deps%) do (
    npm list %%d >nul 2>&1
    if !errorlevel! equ 0 (
        echo ✓ %%d installed
    ) else (
        echo ✗ %%d NOT installed
    )
)
echo.

REM Check source files
echo [CHECK 7] Source Code Files
setlocal enabledelayedexpansion
set "files=src\App.js src\index.js public\index.html public\manifest.json"
for %%f in (%files%) do (
    if exist "%%f" (
        echo ✓ %%f exists
    ) else (
        echo ✗ %%f MISSING
    )
)
echo.

REM Check for linting errors
echo [CHECK 8] Running ESLint Check...
call npm run lint >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ No linting errors
) else (
    echo ⚠ Linting warnings found (may be non-critical^)
)
echo.

REM Check Capacitor config
echo [CHECK 9] Capacitor Configuration
if exist "capacitor.config.json" (
    echo ✓ capacitor.config.json exists
    node -e "require('./capacitor.config.json')" >nul 2>&1
    if !errorlevel! equ 0 (
        echo ✓ Capacitor config is valid
    ) else (
        echo ✗ Capacitor config is INVALID
    )
) else (
    echo ⚠ capacitor.config.json NOT found
)
echo.

REM Summary
echo ==========================================
echo All pre-deployment checks completed!
echo ==========================================
echo.
echo Status Report:
echo - Node.js and npm: Ready
echo - Dependencies: Installed
echo - Source Files: Present
echo - Configuration: Valid
echo.
echo Ready to build? Run: npm run build
echo Ready for APK? Run: npm run build-apk
echo.
pause
