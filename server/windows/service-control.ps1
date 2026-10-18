<#
.SYNOPSIS
  Start, stop, restart or check Flowlace Server; update the program; or remove the service.

.EXAMPLE
  .\service-control.ps1 status
  .\service-control.ps1 stop
  .\service-control.ps1 start
  .\service-control.ps1 restart
  .\service-control.ps1 update -From C:\Downloads\FlowlaceServer-1.1.0-win-x64   # new version, data kept
  .\service-control.ps1 uninstall                                              # data and configuration kept
#>
#Requires -RunAsAdministrator
param(
  [Parameter(Mandatory = $true, Position = 0)][ValidateSet('status', 'start', 'stop', 'restart', 'update', 'uninstall')][string]$Action,
  [string]$From,
  [string]$InstallDir = (Join-Path $env:ProgramFiles 'Flowlace Server')
)
$ErrorActionPreference = 'Stop'
$exe = Join-Path $InstallDir 'FlowlaceServer.exe'
$config = Join-Path $env:ProgramData 'Flowlace Server\flowlace-server.json'

function Wait-Status($s) { (Get-Service FlowlaceServer).WaitForStatus($s, '00:00:40') }

switch ($Action) {
  'status' {
    Get-Service FlowlaceServer | Format-Table -AutoSize Name, Status, StartType
    & (Join-Path $InstallDir 'flowlace-server.cmd') check --config $config
    Get-ChildItem (Join-Path $env:ProgramData 'Flowlace Server\logs') -Filter *.out.log -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1 | ForEach-Object { Get-Content $_.FullName -Tail 15 }
  }
  'start' { Start-Service FlowlaceServer; Wait-Status 'Running'; 'Running.' }
  'stop' { Stop-Service FlowlaceServer; Wait-Status 'Stopped'; 'Stopped. Clients show "Disconnected" and keep their pending changes until it starts again.' }
  'restart' { Restart-Service FlowlaceServer; Wait-Status 'Running'; 'Restarted.' }
  'update' {
    if (-not $From -or -not (Test-Path (Join-Path $From 'app\server\src\index.js'))) { throw 'Use -From <extracted folder of the new Flowlace Server version>.' }
    Stop-Service FlowlaceServer; Wait-Status 'Stopped'
    # only program files are replaced; configuration (ProgramData) and data folder are untouched
    foreach ($d in 'app', 'node', 'docs') { $t = Join-Path $InstallDir $d; if (Test-Path $t) { Remove-Item $t -Recurse -Force } ; Copy-Item (Join-Path $From $d) $InstallDir -Recurse -Force }
    foreach ($f in 'FlowlaceServer.exe', 'flowlace-server.cmd', 'install-service.ps1', 'service-control.ps1', 'LEEME.txt', 'THIRD-PARTY.txt') { Copy-Item (Join-Path $From $f) $InstallDir -Force -ErrorAction SilentlyContinue }
    Start-Service FlowlaceServer; Wait-Status 'Running'
    'Updated and running. Databases are migrated automatically on first open (a copy is kept in the backups folder).'
  }
  'uninstall' {
    $s = Get-Service FlowlaceServer -ErrorAction SilentlyContinue
    if ($s) { if ($s.Status -ne 'Stopped') { Stop-Service FlowlaceServer; Wait-Status 'Stopped' }; & $exe uninstall }
    Get-NetFirewallRule -DisplayName 'Flowlace Server' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    "Service removed. The data folder and $config were NOT deleted."
  }
}
