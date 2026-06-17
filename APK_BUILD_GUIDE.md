# ZM Meeting App - APK Build Guide

## Prerequisites
- Node.js and npm installed ✓
- Android SDK installed ✓
- Java Development Kit (JDK) installed ✓
- Android Studio (recommended for building APK)

## Setup & Build Instructions

### Step 1: Install Dependencies
```bash
cd frontend
npm install
npm install jimp --save-dev
```

### Step 2: Generate ZM Icons
```bash
node generate-icons.js
```
This generates ZM branded icons in all required sizes (192x192, 512x512, etc.)

### Step 3: Build React App
```bash
npm run build
```

### Step 4: Initialize Capacitor
```bash
npx cap init
# When prompted:
# App Name: ZM Meeting
# App Package: com.zm.meeting
# App URL: http://localhost
```

### Step 5: Add Android Platform
```bash
npx cap add android
```

### Step 6: Sync Capacitor
```bash
npx cap sync android
```

### Step 7: Build APK in Android Studio
```bash
npx cap open android
```
This opens Android Studio with your project configured.

In Android Studio:
1. Click **Build** menu
2. Select **Build Bundle(s) / APK(s)**
3. Select **Build APK(s)**
4. Wait for the build to complete
5. APK will be generated in: `android/app/build/outputs/apk/debug/app-debug.apk`

### OR Build APK from Command Line
```bash
cd android
./gradlew assembleDebug
```
APK location: `app/build/outputs/apk/debug/app-debug.apk`

## Icon Information
- Icons are automatically generated with "ZM" branding
- Color: Deep Purple (#4a148c)
- Supported sizes: 48x48, 72x72, 96x96, 192x192, 512x512
- Icons are placed in both `public/` (web) and `android/` (mobile) directories

## Quick Build Script
Run the batch file to automate the entire process:
```bash
c:\Users\T.Bertin\Documents\z\zmm\build-apk.bat
```

## Troubleshooting

### "npm install" fails with PowerShell error
- Use the batch files provided
- Or use Command Prompt instead of PowerShell

### Android SDK not found
- Install Android Studio
- Set ANDROID_SDK_ROOT environment variable to your SDK path
- Example: `C:\Users\YourUsername\AppData\Local\Android\Sdk`

### Gradle build fails
- Ensure you have Android SDK Build Tools 34+ installed
- Update ANDROID_HOME variable to SDK location
- Run `gradlew clean` before rebuilding

### APK size is too large
- Run in release mode instead of debug:
  ```bash
  cd android
  ./gradlew assembleRelease
  ```

## File Structure
```
zmm/
├── frontend/
│   ├── capacitor.config.json      # Capacitor configuration
│   ├── generate-icons.js           # Icon generation script
│   ├── public/
│   │   ├── logo192.png            # ZM icon 192x192
│   │   ├── logo512.png            # ZM icon 512x512
│   │   └── manifest.json          # Updated with ZM branding
│   ├── android/                   # Generated Android project
│   └── build/                     # React build output
├── build-apk.bat                  # Windows build script
└── README.md                       # This file
```

## Notes
- The app uses LiveKit for video conferencing
- All permissions (camera, microphone, internet) are configured in AndroidManifest.xml
- Debug APK size: ~80-120 MB (includes LiveKit SDK)
- Release APK size: ~40-60 MB (after ProGuard optimization)

For more information, visit:
- Capacitor Docs: https://capacitorjs.com/docs
- React Docs: https://react.dev
- Android Docs: https://developer.android.com
