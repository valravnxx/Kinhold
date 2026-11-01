# Prueba de kinhold_grafica.ps1 en Windows (PowerShell 5.1), sin ventana: comprueba que el programa se lee sin errores
# y que pasar a otra carpeta lleva el programa de GitHub ya unido y borra de C solo lo de las pruebas (31 oct: le llenaba
# el SSD a valravnx). Todo en carpetas de prueba. Solo funciona en Windows (en la nube: una máquina windows-latest).
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File herramientas/pc_grafica/probar_programa.ps1 <carpeta de prueba>
# MUTAR=1 rompe a propósito el paso del programa de GitHub: tiene que fallar.
param([string]$base = (Join-Path $env:RUNNER_TEMP 'kg_prueba'))
$ErrorActionPreference = 'Stop'
$fallos = 0
function Comprobar($nombre, $cond) { if ($cond) { Write-Output "  OK   $nombre" } else { Write-Output "  FALLA $nombre"; $script:fallos++ } }

$programa = Join-Path $PSScriptRoot 'kinhold_grafica.ps1'
$errores = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($programa, [ref]$null, [ref]$errores)
Comprobar 'el programa se lee sin errores en PowerShell 5.1' (-not $errores -or $errores.Count -eq 0)
if ($errores) { $errores | ForEach-Object { Write-Output "    $($_.Extent.StartLineNumber): $($_.Message)" } }

# las funciones del programa, sin abrir la ventana
Add-Type -AssemblyName System.Windows.Forms
foreach ($fn in $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)) { Invoke-Expression $fn.Extent.Text }
# lo que haría el programa de verdad con los procesos, aquí no
function Encendido { $false }; function Apagar {}; function Encender {}; function Anotar($t) { Write-Output "    registro: $t" }

# un «C» de prueba: la carpeta de la versión anterior con el programa de GitHub unido y su trabajo (con rutas de más de
# 260 letras, como node_modules), el navegador de las pruebas, y en TEMP dos restos de las pruebas y una carpeta ajena
if (Test-Path $base) { & cmd /c rd /s /q "\\?\$base" }
$C = Join-Path $base 'C'; $env:LOCALAPPDATA = Join-Path $C 'Local'
$VIEJA = Join-Path $env:LOCALAPPDATA 'KinholdGrafica'
$TEMP_WINDOWS = Join-Path $C 'Temp'
New-Item -ItemType Directory -Force -Path "$VIEJA\runner\bin", "$VIEJA\runner\externals", $TEMP_WINDOWS | Out-Null
Set-Content "$VIEJA\runner\.runner" '{"agentName":"pc-valravnx-gpu","workFolder":"_work"}'
Set-Content "$VIEJA\runner\.credentials" 'x'; Set-Content "$VIEJA\runner\bin\Runner.Listener.exe" 'x'; Set-Content "$VIEJA\registro.txt" 'antes'
$hondo = "\\?\$VIEJA\runner\_work\Kinhold\Kinhold\node_modules\" + ((1..30 | ForEach-Object { 'carpeta_larga' }) -join '\')
[IO.Directory]::CreateDirectory($hondo) | Out-Null; [IO.File]::WriteAllText("$hondo\a.js", 'x')
New-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\ms-playwright\chromium-1", "$TEMP_WINDOWS\tmpabc123\jugar", "$TEMP_WINDOWS\tmpdef456\recursos", "$TEMP_WINDOWS\tmpajena", "$TEMP_WINDOWS\otra_cosa" | Out-Null
Set-Content "$TEMP_WINDOWS\tmpajena\de_otro_programa.txt" 'x'
Comprobar 'en TEMP se reconocen los 2 restos de las pruebas (y no lo ajeno)' (@(Restos-En-Temp).Count -eq 2)

$AJUSTES = Join-Path $base 'ajustes.json'
$aj = Leer-Ajustes
Comprobar "sin ajustes, la carpeta por defecto es D:\KinholdGrafica si hay D (aquí: $($aj.carpeta))" ($aj.carpeta -eq $(if (Test-Path 'D:\') { 'D:\KinholdGrafica' } else { $VIEJA }))

# como al abrir la versión nueva: la carpeta elegida es otra (D) y en C está lo de antes
$D = Join-Path $base 'D\KinholdGrafica'
Poner-Carpeta $D
if ($env:MUTAR) { function Configurado { $true } }
Mover-Y-Limpiar $D { param($t) Write-Output "    aviso: $t" }
Comprobar 'el programa de GitHub unido está en la carpeta nueva (sin pedir el código otra vez)' ((Test-Path "$D\runner\.runner") -and (Test-Path "$D\runner\.credentials") -and (Test-Path "$D\runner\bin\Runner.Listener.exe"))
Comprobar 'sin su carpeta de trabajo (se rehace sola)' (-not (Test-Path "$D\runner\_work"))
Comprobar 'el registro de antes sigue, en la carpeta nueva' ((Get-Content "$D\registro.txt") -contains 'antes')
Comprobar 'de C se ha borrado la carpeta de antes, también lo de rutas largas' (-not (Test-Path $VIEJA))
Comprobar 'y el navegador de las pruebas' (-not (Test-Path "$env:LOCALAPPDATA\ms-playwright"))
Comprobar 'y los restos de las pruebas en TEMP' (-not (Test-Path "$TEMP_WINDOWS\tmpabc123") -and -not (Test-Path "$TEMP_WINDOWS\tmpdef456"))
Comprobar 'lo ajeno de TEMP sigue' ((Test-Path "$TEMP_WINDOWS\tmpajena\de_otro_programa.txt") -and (Test-Path "$TEMP_WINDOWS\otra_cosa"))

# después, lo que heredan las pruebas va a la carpeta nueva
Entorno-En-Carpeta
Comprobar 'TEMP, el navegador y las cachés de las pruebas, en la carpeta nueva' ($env:TEMP -eq "$D\temp" -and $env:PLAYWRIGHT_BROWSERS_PATH.StartsWith($D) -and $env:PIP_CACHE_DIR.StartsWith($D) -and $env:npm_config_cache.StartsWith($D))

# cambiar otra vez de carpeta (de D a E): se lleva el programa y no deja nada en la de antes
$E = Join-Path $base 'E\KinholdGrafica'
Mover-Y-Limpiar $E { param($t) }
Comprobar 'al cambiar de carpeta otra vez, el programa de GitHub va con ella y la de antes desaparece' ((Test-Path "$E\runner\.runner") -and -not (Test-Path $D))

& cmd /c rd /s /q "\\?\$base"
if ($fallos) { Write-Output "Resultado: $fallos fallos"; exit 1 } else { Write-Output 'Resultado: todo bien'; exit 0 }
