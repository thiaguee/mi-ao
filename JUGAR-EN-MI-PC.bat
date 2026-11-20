@echo off
title Norway AO - Servidor de prueba
cd /d "%~dp0"
set NODEVER=v20.18.0
set NODEDIR=%~dp0motor\node-%NODEVER%-win-x64

rem Si la PC ya tiene Node.js instalado, usamos ese. Si no, usamos (o bajamos) uno portable.
where node >nul 2>nul
if not errorlevel 1 goto :tengo_node
if exist "%NODEDIR%\node.exe" goto :usar_portable

echo.
echo  Primera vez: descargando el motor del servidor (unos 30 MB). Espera un momento...
echo.
if not exist motor mkdir motor
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/%NODEVER%/node-%NODEVER%-win-x64.zip' -OutFile 'motor\node.zip'; Expand-Archive -Force 'motor\node.zip' 'motor'; Remove-Item 'motor\node.zip'"
if not exist "%NODEDIR%\node.exe" (
  echo  No se pudo descargar. Revisa tu conexion a internet y volve a intentar.
  pause
  exit /b
)

:usar_portable
set "PATH=%NODEDIR%;%PATH%"

:tengo_node
cd server
if not exist node_modules (
  echo  Preparando el servidor por primera vez...
  call npm install --omit=dev
)
echo.
echo  ===========================================================
echo   Servidor de Norway AO ENCENDIDO.
echo   NO CIERRES ESTA VENTANA mientras juegues.
echo   El juego se abre solo en tu navegador: http://localhost:7666
echo  ===========================================================
echo.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:7666"
node src/main.js
pause
