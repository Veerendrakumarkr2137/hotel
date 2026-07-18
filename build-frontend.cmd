@echo off
setlocal

REM Bundles the React UI using esbuild.exe directly (avoids Node spawning esbuild).
set ESBUILD_EXE=.\node_modules\@esbuild\win32-x64\esbuild.exe

if not exist "%ESBUILD_EXE%" (
  echo esbuild.exe not found at %ESBUILD_EXE%
  echo Run npm install first.
  exit /b 1
)

if not exist dist\assets (
  mkdir dist\assets
)

echo Building UI -> dist\assets\app.js
"%ESBUILD_EXE%" src\main.tsx ^
  --bundle ^
  --format=esm ^
  --platform=browser ^
  --target=es2022 ^
  --define:process.env.NODE_ENV=\"production\" ^
  --outfile=dist\assets\app.js

echo Done.
endlocal
