@echo off
rem ==========================================================================
rem  Kinhold: jugar en linea en casa (Windows). Doble clic en este archivo.
rem  Lo hace todo: descarga Node.js (portable, sin instalar nada en Windows) y
rem  el juego si faltan, enciende el servidor y la web, y abre el juego.
rem  Todo va a la carpeta Kinhold de tu usuario. El mundo construido se guarda
rem  aparte (Kinhold\mundo.jsonl) y no se pierde al actualizar el juego.
rem ==========================================================================
setlocal
chcp 65001 >nul
title Kinhold - jugar en casa
set "BASE=%USERPROFILE%\Kinhold"
set "NODEDIR=%BASE%\node"
if not exist "%BASE%" mkdir "%BASE%"
set "PS=powershell -NoProfile -ExecutionPolicy Bypass -Command"

rem --- el juego: si este archivo esta dentro de la carpeta del juego, se usa esa; si no, se descarga ---
if exist "%~dp0servidor\servidor.mjs" (
  set "JUEGO=%~dp0"
  goto node
)
set "JUEGO=%BASE%\Kinhold-main"
if not exist "%JUEGO%\servidor\servidor.mjs" goto descargar_juego
echo.
choice /c SN /t 10 /d N /m "Quieres descargar la ultima version del juego (S/N, en 10 s sigue con N)"
if errorlevel 2 goto node

:descargar_juego
echo.
echo Descargando el juego (unos cientos de MB, puede tardar varios minutos)...
%PS% "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/valravnxx/Kinhold/archive/refs/heads/main.zip' -OutFile '%BASE%\juego.zip'"
if not exist "%BASE%\juego.zip" goto fallo_juego
echo Descomprimiendo...
if exist "%JUEGO%" rmdir /s /q "%JUEGO%"
tar -xf "%BASE%\juego.zip" -C "%BASE%" 2>nul
if not exist "%JUEGO%\servidor\servidor.mjs" %PS% "Expand-Archive -Force -Path '%BASE%\juego.zip' -DestinationPath '%BASE%'"
del "%BASE%\juego.zip" >nul 2>nul
if not exist "%JUEGO%\servidor\servidor.mjs" goto fallo_juego

:node
rem --- Node.js: el que ya tengas instalado o uno portable en Kinhold\node ---
where node >nul 2>nul
if not errorlevel 1 goto preparar
if exist "%NODEDIR%\node.exe" goto poner_node
echo.
echo Descargando Node.js (portable, unos 30 MB)...
set "ARQ=x64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARQ=arm64"
%PS% "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $ErrorActionPreference='Stop'; $v='v22.12.0'; try { $l=Invoke-RestMethod 'https://nodejs.org/dist/index.json'; $u=@($l | ForEach-Object { $_ } | Where-Object { $_.lts }); if ($u.Count -gt 0 -and $u[0].version -match '^v\d+\.\d+\.\d+$') { $v=$u[0].version } } catch { }; Write-Host ('Node.js '+$v); $n='node-'+$v+'-win-%ARQ%'; Invoke-WebRequest -UseBasicParsing -Uri ('https://nodejs.org/dist/'+$v+'/'+$n+'.zip') -OutFile '%BASE%\node.zip'; Expand-Archive -Force -Path '%BASE%\node.zip' -DestinationPath '%BASE%\node_tmp'; if (Test-Path '%NODEDIR%') { Remove-Item -Recurse -Force '%NODEDIR%' }; Move-Item ('%BASE%\node_tmp\'+$n) '%NODEDIR%'; Remove-Item -Recurse -Force '%BASE%\node_tmp'; Remove-Item -Force '%BASE%\node.zip'"
if not exist "%NODEDIR%\node.exe" goto fallo_node
:poner_node
set "PATH=%NODEDIR%;%PATH%"

:preparar
cd /d "%JUEGO%"
if exist "node_modules\ws" goto encender
echo.
echo Preparando el servidor por primera vez...
call npm install --omit=dev --no-audit --no-fund
if not exist "node_modules\ws" goto fallo_npm

:encender
echo.
echo  Donde esta la otra persona?
echo    1 = en esta misma casa (misma wifi)
echo    2 = lejos, por internet (otra casa, otra ciudad, otro pais)
choice /c 12 /n /m "Pulsa 1 o 2: "
if errorlevel 2 goto internet

rem --- 1. misma wifi: la IP de este PC en la wifi o el cable (la que tiene salida a internet) ---
set "IP="
for /f "usebackq delims=" %%i in (`%PS% "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway } | Select-Object -First 1).IPv4Address | Select-Object -First 1 -ExpandProperty IPAddress"`) do set "IP=%%i"
if "%IP%"=="" set "IP=localhost"
start "Kinhold - servidor (NO CERRAR)" /d "%JUEGO%" cmd /k node servidor\servidor.mjs 8080 "%BASE%\mundo.jsonl"
start "Kinhold - web (NO CERRAR)" /d "%JUEGO%" cmd /k node herramientas\servir_web.mjs 8000
timeout /t 3 /nobreak >nul
set "URL=http://%IP%:8000/jugar/demo/index.html?servidor=ws://%IP%:8080"
start "" "%URL%"
echo.
echo  ======================================================================
echo   LISTO. Se han abierto dos ventanas negras: NO las cierres mientras
echo   jugais. Si Windows pregunta por el cortafuegos, marca "Redes
echo   privadas" y pulsa "Permitir".
echo.
echo   El juego ya se ha abierto en este PC. En el movil (misma wifi),
echo   escribe en el navegador esta direccion:
echo.
echo   %URL%
echo.
echo   Luego cada uno: Personaje, Menu y "Jugar en linea".
echo  ======================================================================
echo.
pause
exit /b

:internet
rem --- 2. por internet: la web es la publica (GitHub Pages) y el servidor del juego de este PC sale a internet por
rem     un tunel gratuito de Cloudflare (sin cuenta ni abrir puertos del router). Solo sale el puerto del juego (8080),
rem     no el resto del PC. La direccion es aleatoria y cambia cada vez. El servidor aun no tiene contrasenas.
echo.
echo  AVISO: quien tenga el enlace podra entrar a tu servidor del juego y
echo  construir en el (solo el juego, no el resto del PC). Mandalo solo a
echo  quien quieras que juegue y no lo publiques.
choice /c SN /n /m "Seguir? (S/N): "
if errorlevel 2 exit /b
if exist "%BASE%\cloudflared.exe" goto tunel
echo.
echo Descargando el tunel de Cloudflare (unos 60 MB, solo la primera vez)...
%PS% "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%BASE%\cloudflared.exe'"
if not exist "%BASE%\cloudflared.exe" goto fallo_tunel
:tunel
start "Kinhold - servidor (NO CERRAR)" /d "%JUEGO%" cmd /k node servidor\servidor.mjs 8080 "%BASE%\mundo.jsonl"
if exist "%BASE%\tunel.log" del "%BASE%\tunel.log"
start "Kinhold - tunel a internet (NO CERRAR)" /min cmd /k ""%BASE%\cloudflared.exe" tunnel --no-autoupdate --url http://localhost:8080 2> "%BASE%\tunel.log""
echo.
echo Abriendo el tunel a internet (hasta 1 minuto)...
set "TUNEL="
for /f "usebackq delims=" %%i in (`%PS% "for ($i=0; $i -lt 60; $i++) { Start-Sleep 1; if (Test-Path '%BASE%\tunel.log') { $m=Select-String -Path '%BASE%\tunel.log' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1; if ($m) { $m.Matches[0].Value; break } } }"`) do set "TUNEL=%%i"
if "%TUNEL%"=="" goto fallo_tunel
set "SRV=%TUNEL:https://=wss://%"
set "URL=https://valravnxx.github.io/Kinhold/jugar/demo/index.html?servidor=%SRV%"
timeout /t 5 /nobreak >nul
start "" "%URL%"
echo %URL%| clip
echo.
echo  ======================================================================
echo   LISTO. Se han abierto dos ventanas (servidor y tunel): NO las
echo   cierres mientras jugais.
echo.
echo   El juego ya se ha abierto en este PC. Mandale a la otra persona
echo   esta direccion (ya esta copiada: pegala en WhatsApp o Telegram):
echo.
echo   %URL%
echo.
echo   Luego cada uno: Personaje, Menu y "Jugar en linea".
echo   La direccion cambia cada vez que abres este archivo.
echo  ======================================================================
echo.
pause
exit /b

:fallo_tunel
echo.
echo No se ha podido abrir el tunel a internet. Mandale una foto de esta
echo ventana y de la ventana "Kinhold - tunel" al dev.
pause
exit /b

:fallo_juego
echo.
echo No se ha podido descargar el juego. Mira que tienes internet y vuelve a probar.
pause
exit /b
:fallo_node
echo.
echo No se ha podido descargar Node.js. Mira que tienes internet y vuelve a probar.
pause
exit /b
:fallo_npm
echo.
echo No se ha podido preparar el servidor (npm install). Mandale una foto de esta ventana al dev.
pause
exit /b
