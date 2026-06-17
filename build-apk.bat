@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================
echo ZM Meeting App - APK Build Script
echo ============================================
echo.

cd /d c:\Users\T.Bertin\Documents\z\zmm\frontend

echo [1/5] Installing dependencies...
call npm install
if errorlevel 1 (
    echo Error: npm install failed
    exit /b 1
)

echo.
echo [2/5] Installing jimp for icon generation...
call npm install jimp --save-dev
if errorlevel 1 (
    echo Warning: jimp installation had issues, but continuing...
)

echo.
echo [3/5] Generating ZM icons...
call node generate-icons.js
if errorlevel 1 (
    echo Warning: Icon generation had issues, but continuing...
)

echo.
echo [4/5] Building React app...
call npm run build
if errorlevel 1 (
    echo Error: React build failed
    exit /b 1
)

echo.
echo [5/5] Initializing Capacitor...
call npx cap init
if errorlevel 1 (
    echo Info: Capacitor init may have interactive prompts
)

echo.
echo ============================================
echo Build completed!
echo ============================================
echo.
echo Next steps:
echo 1. Run: npx cap add android
echo 2. Run: npx cap sync android
echo 3. Run: npx cap open android
echo    (This will open Android Studio)
echo 4. In Android Studio:
echo    - Go to Build menu
echo    - Select "Build Bundle(s) / APK(s)"
echo    - Select "Build APK(s)"
echo.
pause
