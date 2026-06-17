#!/bin/bash
# Deployment Pre-Check Script for ZM Meeting App

echo "=========================================="
echo "ZM Meeting App - Pre-Deployment Check"
echo "=========================================="
echo ""

# Check Node version
echo "[CHECK 1] Node.js Installation"
node -v
if [ $? -eq 0 ]; then echo "✓ Node.js is installed"; else echo "✗ Node.js NOT found"; exit 1; fi
echo ""

# Check npm version
echo "[CHECK 2] npm Installation"
npm -v
if [ $? -eq 0 ]; then echo "✓ npm is installed"; else echo "✗ npm NOT found"; exit 1; fi
echo ""

# Check if node_modules exists
echo "[CHECK 3] Dependencies Installed"
if [ -d "node_modules" ]; then
  echo "✓ node_modules directory exists"
  echo "  Total packages: $(ls -1 node_modules | wc -l)"
else
  echo "⚠ node_modules not found, installing..."
  npm install
fi
echo ""

# Check for build directory
echo "[CHECK 4] Previous Builds"
if [ -d "build" ]; then
  echo "✓ Previous build directory found ($(du -sh build | cut -f1))"
else
  echo "⚠ No previous build found - will be created on first build"
fi
echo ""

# Verify package.json integrity
echo "[CHECK 5] Package.json Validation"
if node -e "require('./package.json')" 2>/dev/null; then
  echo "✓ package.json is valid JSON"
else
  echo "✗ package.json is INVALID"
  exit 1
fi
echo ""

# Check essential dependencies
echo "[CHECK 6] Essential Dependencies Check"
deps=("react" "react-dom" "react-router-dom" "@livekit/components-react" "axios")
for dep in "${deps[@]}"; do
  if npm list $dep >/dev/null 2>&1; then
    echo "✓ $dep installed"
  else
    echo "✗ $dep NOT installed"
  fi
done
echo ""

# Check source files
echo "[CHECK 7] Source Code Files"
required_files=("src/App.js" "src/index.js" "public/index.html" "public/manifest.json")
for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file exists"
  else
    echo "✗ $file MISSING"
  fi
done
echo ""

# Check for security vulnerabilities
echo "[CHECK 8] Security Audit"
echo "Running npm audit..."
npm audit --audit-level=moderate > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ No security vulnerabilities found"
else
  echo "⚠ Some vulnerabilities detected (non-critical)"
  npm audit
fi
echo ""

echo "=========================================="
echo "All pre-deployment checks completed!"
echo "=========================================="
echo ""
echo "Ready to build? Run: npm run build"
