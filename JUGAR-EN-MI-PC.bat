@echo off
title Servidor Norway AO
cd /d "%~dp0server"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Falta instalar Node.js. Se va a abrir la pagina: descarga la version LTS, instalala y volve a abrir este archivo.
  echo.
  start https://nodejs.org
  pause
  exit /b
)
if not exist node_modules (
  echo Instalando por primera vez, espera un momento...
  call npm install
)
echo.
echo  Servidor de Norway AO encendido. NO CIERRES ESTA VENTANA mientras juegues.
echo  El juego se abre en el navegador: http://localhost:7666
echo.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:7666"
node src/main.js
pause
