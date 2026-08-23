# registers .dsmx file type and dsmx:// scheme (HKCU)
#
#   powershell -ExecutionPolicy Bypass -File register.ps1 [-Launcher <path to desmos-ide.exe>]
#   powershell -ExecutionPolicy Bypass -File register.ps1 -Remove

[CmdletBinding()]
param(
  [string]$Launcher,
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'

$progId = 'dsmx.file'
$classes = 'HKCU:\Software\Classes'

if ($Remove) {
  foreach ($key in @("$classes\.dsmx", "$classes\$progId", "$classes\dsmx")) {
    if (Test-Path $key) { Remove-Item -Recurse -Force $key }
  }
  Write-Host 'removed the .dsmx and dsmx:// registrations'
  exit 0
}

if (-not $Launcher) {
  $guesses = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\desmos-ide\desmos-ide.exe'),
    (Join-Path $env:LOCALAPPDATA 'desmos-ide\desmos-ide.exe'),
    (Join-Path $env:ProgramFiles 'desmos-ide\desmos-ide.exe')
  )
  $Launcher = $guesses | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $Launcher -or -not (Test-Path $Launcher)) {
  Write-Error 'pass -Launcher with the path to desmos-ide.exe — it was not where the installer usually puts it'
}

$Launcher = (Resolve-Path $Launcher).Path
$command = "`"$Launcher`" `"%1`""

function Set-Key([string]$path, [string]$value, [string]$name = '(default)') {
  if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
  New-ItemProperty -Path $path -Name $name -Value $value -PropertyType String -Force | Out-Null
}

Set-Key "$classes\.dsmx" $progId
Set-Key "$classes\.dsmx" 'text/x-dsmx' 'Content Type'
Set-Key "$classes\$progId" 'Desmos IDE source'
Set-Key "$classes\$progId\DefaultIcon" "$Launcher,0"
Set-Key "$classes\$progId\shell\open\command" $command

Set-Key "$classes\dsmx" 'URL:dsmx'
Set-Key "$classes\dsmx" '' 'URL Protocol'
Set-Key "$classes\dsmx\DefaultIcon" "$Launcher,0"
Set-Key "$classes\dsmx\shell\open\command" $command

Write-Host "registered .dsmx and dsmx:// for $Launcher"
