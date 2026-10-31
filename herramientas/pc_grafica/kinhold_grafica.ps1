# Kinhold · tu gráfica para las pruebas (lo pidió valravnx el 31 oct 2026)
# Mientras esta ventana está abierta y en «Permitir», las pruebas de Kinhold que lanzan las sesiones de Claude se hacen en
# este PC, con su tarjeta gráfica (una máquina propia de GitHub Actions, «self-hosted runner», con la etiqueta
# kinhold-gpu). Con «Parar», o al cerrar la ventana, deja de estar disponible y las pruebas vuelven a la nube.
# La primera vez descarga el programa de GitHub para eso (en %LOCALAPPDATA%\KinholdGrafica) y pide el código para unirlo
# al repositorio. Se abre con «Abrir Kinhold grafica.bat».
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic
$ErrorActionPreference = 'Stop'

$REPO = 'valravnxx/Kinhold'
$ETIQUETA = 'kinhold-gpu'
$DATOS = Join-Path $env:LOCALAPPDATA 'KinholdGrafica'
$RUNNER = Join-Path $DATOS 'runner'
$REGISTRO = Join-Path $DATOS 'registro.txt'
$AJUSTES = Join-Path $DATOS 'ajustes.json'
New-Item -ItemType Directory -Force -Path $DATOS | Out-Null
$SALIDA_RUNNER = Join-Path $DATOS 'runner.txt'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# una sola ventana a la vez
$mutex = New-Object System.Threading.Mutex($false, 'Local\KinholdGrafica')
if (-not $mutex.WaitOne(0)) { [System.Windows.Forms.MessageBox]::Show('Kinhold gráfica ya está abierto (mira junto al reloj).', 'Kinhold'); exit }

# todo lo que arranca desde aquí (las pruebas, el navegador) va con prioridad baja: si juegas, el juego va primero
[System.Diagnostics.Process]::GetCurrentProcess().PriorityClass = 'BelowNormal'

function Leer-Ajustes { if (Test-Path $AJUSTES) { try { return Get-Content $AJUSTES -Raw | ConvertFrom-Json } catch {} }; return [pscustomobject]@{ pararA = $false; hora = '08:00' } }
function Guardar-Ajustes($a) { $a | ConvertTo-Json | Set-Content -Encoding UTF8 $AJUSTES }
function Anotar($t) { Add-Content -Encoding UTF8 -Path $REGISTRO -Value ("{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $t) }
function Configurado { Test-Path (Join-Path $RUNNER '.runner') }

# ---------- la primera vez: Git (para bash), Python, el programa de GitHub y unirlo al repositorio ----------
function Refrescar-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Hay-Python { try { $v = & python --version 2>&1; return "$v" -match '^Python 3\.(1[0-9])' } catch { return $false } }
function Winget($id, $extra) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { return }
  $ea = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $sal = & winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements @extra 2>&1; Anotar ("winget $id`: " + (($sal | Select-Object -Last 3) -join ' | ')) } finally { $ErrorActionPreference = $ea }
  Refrescar-Path
}
function Preparar($avisar) {
  $bash = Join-Path $env:ProgramFiles 'Git\bin\bash.exe'
  if (-not (Test-Path $bash)) {
    & $avisar 'Instalando Git (hace falta su bash para las pruebas)…'
    Winget 'Git.Git' @()
    if (-not (Test-Path $bash)) {
      [System.Windows.Forms.MessageBox]::Show("No he podido instalar Git solo. Instálalo desde https://git-scm.com/download/win (con lo que viene marcado) y vuelve a pulsar «Permitir».", 'Kinhold') | Out-Null
      Start-Process 'https://git-scm.com/download/win'; return $false
    }
  }
  Refrescar-Path
  if (-not (Hay-Python)) {
    & $avisar 'Instalando Python (para las pruebas del navegador)…'
    Winget 'Python.Python.3.13' @('--scope', 'user', '--override', '/quiet InstallAllUsers=0 PrependPath=1 Include_test=0')
    if (-not (Hay-Python)) {
      [System.Windows.Forms.MessageBox]::Show("No he podido instalar Python solo. Instálalo desde https://www.python.org/downloads/ marcando «Add python.exe to PATH» y vuelve a pulsar «Permitir».", 'Kinhold') | Out-Null
      Start-Process 'https://www.python.org/downloads/'; return $false
    }
  }
  if (-not (Test-Path (Join-Path $RUNNER 'config.cmd'))) {
    & $avisar 'Descargando el programa de GitHub para usar este PC…'
    $ult = Invoke-RestMethod 'https://api.github.com/repos/actions/runner/releases/latest' -Headers @{ 'User-Agent' = 'kinhold-grafica' }
    $zip = $ult.assets | Where-Object { $_.name -like 'actions-runner-win-x64-*.zip' } | Select-Object -First 1
    if (-not $zip) { throw 'No encuentro el programa de GitHub para Windows en su última versión.' }
    $dest = Join-Path $DATOS $zip.name
    Invoke-WebRequest $zip.browser_download_url -OutFile $dest -UseBasicParsing -Headers @{ 'User-Agent' = 'kinhold-grafica' }
    New-Item -ItemType Directory -Force -Path $RUNNER | Out-Null
    Expand-Archive -Path $dest -DestinationPath $RUNNER -Force
    Remove-Item $dest
  }
  if (-not (Configurado)) {
    Start-Process "https://github.com/$REPO/settings/actions/runners/new?arch=x64&os=win"
    $codigo = [Microsoft.VisualBasic.Interaction]::InputBox(
      "Se ha abierto GitHub («New self-hosted runner»). En el apartado «Configure», en la línea que empieza por`n`n    ./config.cmd --url https://github.com/$REPO --token XXXXX`n`ncopia lo que va detrás de --token (el código largo) y pégalo aquí.`n`n(Caduca en una hora; si caduca, recarga esa página.)",
      'Kinhold · unir este PC', '')
    $codigo = $codigo.Trim()
    if (-not $codigo) { return $false }
    & $avisar 'Uniendo este PC al repositorio…'
    # (guarda el PATH de ahora, con Git y Python: es el que usarán las pruebas)
    $ea = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try {
      $sal = & (Join-Path $RUNNER 'config.cmd') --unattended --url "https://github.com/$REPO" --token $codigo --name 'pc-valravnx-gpu' --labels $ETIQUETA --work '_work' --replace 2>&1
      Anotar ("config: " + (($sal | ForEach-Object { "$_" }) -join ' | '))
    } finally { $ErrorActionPreference = $ea }
    if (-not (Configurado)) {
      [System.Windows.Forms.MessageBox]::Show("GitHub no ha aceptado el código (¿caducado o mal copiado?). Vuelve a pulsar «Permitir» para probar otra vez.`n`nDetalle en $REGISTRO", 'Kinhold') | Out-Null
      return $false
    }
  }
  return $true
}

# ---------- encender y apagar ----------
$script:proc = $null
function Procesos-Runner { Get-Process -Name 'Runner.Listener', 'Runner.Worker' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($RUNNER, 'OrdinalIgnoreCase') } }
function Encendido { ($script:proc -and -not $script:proc.HasExited) -or (Procesos-Runner) }
function Haciendo-Pruebas { [bool](Get-Process -Name 'Runner.Worker' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($RUNNER, 'OrdinalIgnoreCase') }) }

function Encender {
  if (Encendido) { return }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $env:ComSpec
  $psi.Arguments = "/c `"`"$RUNNER\run.cmd`" >> `"$SALIDA_RUNNER`" 2>&1`""
  $psi.WorkingDirectory = $RUNNER
  $psi.CreateNoWindow = $true
  $psi.UseShellExecute = $false
  $script:proc = [System.Diagnostics.Process]::Start($psi)
  Anotar 'Permitido: este PC hace las pruebas'
}
function Apagar {
  if ($script:proc -and -not $script:proc.HasExited) { & taskkill /PID $script:proc.Id /T /F 2>&1 | Out-Null }
  Procesos-Runner | Stop-Process -Force -ErrorAction SilentlyContinue
  # el navegador de las pruebas, si quedó alguno de esta carpeta
  Get-Process -Name 'chrome', 'headless_shell' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path -like '*ms-playwright*' } | Stop-Process -Force -ErrorAction SilentlyContinue
  $script:proc = $null
  Anotar 'Parado: las pruebas vuelven a la nube'
}

# ---------- la ventana ----------
$aj = Leer-Ajustes
$f = New-Object System.Windows.Forms.Form
$f.Text = 'Kinhold · tu gráfica para las pruebas'
$f.Size = New-Object System.Drawing.Size(460, 300)
$f.FormBorderStyle = 'FixedSingle'; $f.MaximizeBox = $false
$f.StartPosition = 'CenterScreen'
$f.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$f.BackColor = [System.Drawing.Color]::FromArgb(36, 33, 30); $f.ForeColor = [System.Drawing.Color]::FromArgb(232, 226, 214)

$estado = New-Object System.Windows.Forms.Label
$estado.Location = '20,18'; $estado.Size = '410,56'
$estado.Font = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Bold)
$f.Controls.Add($estado)

$boton = New-Object System.Windows.Forms.Button
$boton.Location = '20,80'; $boton.Size = '410,44'
$boton.FlatStyle = 'Flat'; $boton.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$f.Controls.Add($boton)

$parar = New-Object System.Windows.Forms.CheckBox
$parar.Location = '20,138'; $parar.Size = '230,26'; $parar.Text = 'Parar solo a las'
$parar.Checked = [bool]$aj.pararA
$f.Controls.Add($parar)
$hora = New-Object System.Windows.Forms.DateTimePicker
$hora.Location = '250,136'; $hora.Size = '90,26'; $hora.Format = 'Custom'; $hora.CustomFormat = 'HH:mm'; $hora.ShowUpDown = $true
try { $hora.Value = [datetime]::ParseExact($aj.hora, 'HH:mm', $null) } catch {}
$f.Controls.Add($hora)

$nota = New-Object System.Windows.Forms.Label
$nota.Location = '20,172'; $nota.Size = '410,46'
$nota.Text = 'Mientras está permitido, las pruebas de Kinhold usan tu tarjeta gráfica (con prioridad baja). Para jugar: «Parar» o cierra la ventana.'
$nota.ForeColor = [System.Drawing.Color]::FromArgb(176, 168, 152)
$f.Controls.Add($nota)

$ver = New-Object System.Windows.Forms.LinkLabel
$ver.Location = '20,226'; $ver.Size = '200,22'; $ver.Text = 'Ver el registro'
$ver.LinkColor = [System.Drawing.Color]::FromArgb(214, 168, 72)
$ver.Add_LinkClicked({ if (Test-Path $REGISTRO) { Start-Process notepad $REGISTRO } })
$f.Controls.Add($ver)

$icono = New-Object System.Windows.Forms.NotifyIcon
$icono.Icon = [System.Drawing.SystemIcons]::Application
$icono.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$mAbrir = $menu.Items.Add('Abrir'); $mAbrir.Add_Click({ $f.Show(); $f.WindowState = 'Normal'; $f.Activate() })
$mCambiar = $menu.Items.Add('Permitir')
$mSalir = $menu.Items.Add('Cerrar (y parar)'); $mSalir.Add_Click({ $f.Close() })
$icono.ContextMenuStrip = $menu
$icono.Add_DoubleClick({ $f.Show(); $f.WindowState = 'Normal'; $f.Activate() })
$f.Add_Resize({ if ($f.WindowState -eq 'Minimized') { $f.Hide(); $icono.ShowBalloonTip(2500, 'Kinhold', 'Sigo aquí, junto al reloj.', 'Info') } })

function Pintar($texto) {
  if ($texto) { $estado.Text = $texto; $estado.ForeColor = [System.Drawing.Color]::FromArgb(214, 168, 72); [System.Windows.Forms.Application]::DoEvents(); return }
  if (Encendido) {
    if (Haciendo-Pruebas) { $estado.Text = "Permitido: haciendo pruebas ahora"; $estado.ForeColor = [System.Drawing.Color]::FromArgb(214, 168, 72) }
    else { $estado.Text = "Permitido: esperando pruebas"; $estado.ForeColor = [System.Drawing.Color]::FromArgb(140, 190, 120) }
    $boton.Text = 'Parar'; $mCambiar.Text = 'Parar'
    $boton.BackColor = [System.Drawing.Color]::FromArgb(92, 52, 44)
  } else {
    $estado.Text = 'Parado: Claude no usa este PC'; $estado.ForeColor = [System.Drawing.Color]::FromArgb(232, 226, 214)
    $boton.Text = 'Permitir'; $mCambiar.Text = 'Permitir'
    $boton.BackColor = [System.Drawing.Color]::FromArgb(58, 78, 52)
  }
  $icono.Text = ($estado.Text.Substring(0, [Math]::Min(60, $estado.Text.Length)))
}

function Cambiar {
  if (Encendido) {
    if (Haciendo-Pruebas) {
      $r = [System.Windows.Forms.MessageBox]::Show('Hay pruebas en marcha. Si paras ahora, se repiten en la nube. ¿Parar?', 'Kinhold', 'YesNo')
      if ($r -ne 'Yes') { return }
    }
    Apagar
  } else {
    $boton.Enabled = $false
    try {
      if (Preparar { param($t) Pintar $t }) { Encender }
    } catch {
      Anotar ("error: " + $_.Exception.Message)
      [System.Windows.Forms.MessageBox]::Show("No ha ido bien: $($_.Exception.Message)`n`nDetalle en $REGISTRO", 'Kinhold') | Out-Null
    } finally { $boton.Enabled = $true }
  }
  Pintar
}
$boton.Add_Click({ Cambiar })
$mCambiar.Add_Click({ Cambiar })

$guardar = { Guardar-Ajustes ([pscustomobject]@{ pararA = $parar.Checked; hora = $hora.Value.ToString('HH:mm') }) }
$parar.Add_CheckedChanged($guardar); $hora.Add_ValueChanged($guardar)

# cada 2 s: el estado y la hora de parar
$reloj = New-Object System.Windows.Forms.Timer
$reloj.Interval = 2000
$reloj.Add_Tick({
  if ($parar.Checked -and (Encendido) -and (Get-Date).ToString('HH:mm') -eq $hora.Value.ToString('HH:mm')) {
    Apagar; $icono.ShowBalloonTip(4000, 'Kinhold', "Son las $($hora.Value.ToString('HH:mm')): paro y las pruebas vuelven a la nube.", 'Info')
  }
  Pintar
})
$reloj.Start()

$f.Add_FormClosing({ $reloj.Stop(); if (Encendido) { Apagar }; $icono.Visible = $false; $icono.Dispose() })
# si quedó algo encendido de otra vez (el programa se cerró mal), se apaga: solo vale lo que se permite ahora
if (Procesos-Runner) { Apagar }
Pintar
[System.Windows.Forms.Application]::Run($f)
$mutex.ReleaseMutex()
