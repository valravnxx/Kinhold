@echo off
rem Kinhold: jugar en linea en casa (Windows). Doble clic en este archivo.
rem Enciende el servidor del juego y la web en este PC y dice la direccion que hay que abrir en los dos aparatos.
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Falta Node.js. Instalalo desde https://nodejs.org ^(boton LTS^) y vuelve a abrir este archivo.
  pause
  exit /b
)
if not exist node_modules\ws (
  echo Preparando por primera vez, espera un poco...
  call npm install
)
set IP=
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway } | Select-Object -First 1).IPv4Address.IPAddress"`) do set IP=%%i
if "%IP%"=="" set IP=localhost
start "Kinhold - servidor (no cerrar)" cmd /k node servidor/servidor.mjs 8080
start "Kinhold - web (no cerrar)" cmd /k npx -y http-server docs -p 8000 -c-1
echo.
echo  ============================================================
echo   Listo. Se han abierto dos ventanas: NO las cierres.
echo   Si Windows pregunta por el cortafuegos: Redes privadas y Permitir.
echo.
echo   En el PC y en el movil (misma wifi) abrid esta direccion:
echo.
echo   http://%IP%:8000/jugar/demo/index.html?servidor=ws://%IP%:8080
echo.
echo   Luego: Personaje para elegir el vuestro, Menu, y Jugar en linea.
echo  ============================================================
echo.
pause
