$ErrorActionPreference = 'Stop'

$register = Join-Path $PSScriptRoot 'register.ps1'
if (Test-Path $register) {
  try { & $register -Remove } catch { Write-Warning "could not remove the registrations — $_" }
}

$uninstall = Get-ChildItem "$env:LOCALAPPDATA\Programs\desmos-ide", "$env:ProgramFiles\desmos-ide" `
  -Filter 'Uninstall*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1

if ($uninstall) {
  Uninstall-ChocolateyPackage -PackageName 'dsmx-app' -FileType 'exe' -SilentArgs '/S' -File $uninstall.FullName
} else {
  Write-Warning 'no uninstaller found — remove the app folder by hand'
}
