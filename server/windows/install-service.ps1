<#
.SYNOPSIS
  Installs Flowlace Server as a Windows service (starts with Windows, no user session needed).

.DESCRIPTION
  1. Copies the program to the installation folder (default C:\Program Files\Flowlace Server).
  2. Creates the configuration in %ProgramData%\Flowlace Server\flowlace-server.json, the data folder
     (on a LOCAL disk of this machine) and the first administrator (asks for the password).
  3. Restricts the data folder to Administrators and SYSTEM.
  4. Registers and starts the "Flowlace Server" service and opens the TCP port in Windows Firewall
     (Domain and Private profiles only).
  Run it from an elevated PowerShell in the extracted folder. Running it again on an installed server only
  updates the program files (the configuration, users and data are kept).

.EXAMPLE
  .\install-service.ps1 -DataDir D:\FlowlaceData -CertificatePfx C:\certs\flowlace.pfx -WorkspaceName "Alphazeta"

.EXAMPLE
  # first test on a trusted network, without a certificate (NOT for production)
  .\install-service.ps1 -DataDir D:\FlowlaceData -AllowHttp
#>
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$DataDir,
  [int]$Port = 8443,
  [string]$CertificatePfx,
  [string]$CertificateFile,
  [string]$KeyFile,
  [string]$BackupDir,
  [string]$AdminUser = 'admin',
  [string]$WorkspaceName = 'Alphazeta',
  [string]$ServerName = 'Flowlace Server',
  [string]$InstallDir = (Join-Path $env:ProgramFiles 'Flowlace Server'),
  [switch]$AllowHttp,
  [switch]$NoFirewallRule
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$progData = Join-Path $env:ProgramData 'Flowlace Server'
$config = Join-Path $progData 'flowlace-server.json'

function Step($m) { Write-Host "`n== $m" -ForegroundColor Cyan }

# ---- the data folder must be on a local disk of this machine (never a share or a NAS) ----
if ($DataDir -match '^\\\\') { throw "DataDir must be a folder on a local disk of this server, not a network share ($DataDir). Backups may go to a network folder with -BackupDir." }
$DataDir = [System.IO.Path]::GetFullPath($DataDir)
$drive = New-Object System.IO.DriveInfo ([System.IO.Path]::GetPathRoot($DataDir))
if ($drive.DriveType -ne 'Fixed') { throw "DataDir is on a $($drive.DriveType) drive. Use a fixed local disk of this server." }

if (-not $AllowHttp -and -not $CertificatePfx -and -not ($CertificateFile -and $KeyFile)) {
  throw 'Give the HTTPS certificate with -CertificatePfx (or -CertificateFile and -KeyFile). For a first test only, use -AllowHttp. See docs\SERVIDOR.md.'
}

# ---- program files ----
Step "Copying the program to $InstallDir"
$svc = Get-Service -Name FlowlaceServer -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne 'Stopped') { Stop-Service FlowlaceServer; $svc.WaitForStatus('Stopped', '00:00:30') }
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
if ((Resolve-Path $here).Path.TrimEnd('\') -ne (Resolve-Path $InstallDir).Path.TrimEnd('\')) {
  foreach ($item in 'node', 'app', 'docs', 'FlowlaceServer.exe', 'FlowlaceServer.xml', 'flowlace-server.cmd', '*.ps1', 'LEEME.txt', 'THIRD-PARTY.txt') {
    Get-ChildItem -Path (Join-Path $here $item) -ErrorAction SilentlyContinue | ForEach-Object { Copy-Item $_.FullName -Destination $InstallDir -Recurse -Force }
  }
}
$cli = Join-Path $InstallDir 'flowlace-server.cmd'

# ---- configuration, data folder and first administrator ----
if (-not (Test-Path $config)) {
  Step 'Creating the configuration and the first administrator'
  New-Item -ItemType Directory -Force -Path $progData, $DataDir | Out-Null
  $initArgs = @('init', '--config', $config, '--data', $DataDir, '--port', $Port, '--admin', $AdminUser, '--workspace', $WorkspaceName, '--name', $ServerName)
  if ($BackupDir) { $initArgs += @('--backups', $BackupDir) }
  if ($CertificatePfx) {
    $pfxDir = Join-Path $progData 'certs'; New-Item -ItemType Directory -Force -Path $pfxDir | Out-Null
    $pfxCopy = Join-Path $pfxDir 'flowlace.pfx'; Copy-Item $CertificatePfx $pfxCopy -Force
    $sec = Read-Host -AsSecureString 'Password of the PFX certificate file (leave empty if it has none)'
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    $passFile = Join-Path $pfxDir 'pfx-pass.txt'
    Set-Content -Path $passFile -Value $plain -NoNewline -Encoding ascii
    $initArgs += @('--pfx', $pfxCopy, '--pfx-pass-file', $passFile)
    icacls $pfxDir /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'BUILTIN\Administrators:(OI)(CI)F' | Out-Null
  } elseif ($CertificateFile) {
    $initArgs += @('--cert', $CertificateFile, '--key', $KeyFile)
  } else { $initArgs += '--allow-http' }
  Write-Host "Choose the password of the administrator '$AdminUser' (at least 10 characters)."
  & $cli @initArgs
  if ($LASTEXITCODE -ne 0) { throw 'Initial configuration failed (see the message above).' }
  # only Administrators and the service (SYSTEM) may read the databases
  icacls $DataDir /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'BUILTIN\Administrators:(OI)(CI)F' | Out-Null
} else {
  Step "Existing configuration kept: $config (users and data are not touched)"
}
& $cli check --config $config
if ($LASTEXITCODE -ne 0) { throw 'The configuration check failed.' }

# ---- service ----
$exe = Join-Path $InstallDir 'FlowlaceServer.exe'
if (-not (Get-Service -Name FlowlaceServer -ErrorAction SilentlyContinue)) {
  Step 'Registering the Windows service "Flowlace Server"'
  & $exe install
  if ($LASTEXITCODE -ne 0) { throw 'The service could not be registered.' }
}
$cfgJson = Get-Content $config -Raw | ConvertFrom-Json
if (-not $NoFirewallRule) {
  Step "Opening TCP port $($cfgJson.port) in Windows Firewall (Domain, Private)"
  Get-NetFirewallRule -DisplayName 'Flowlace Server' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName 'Flowlace Server' -Direction Inbound -Protocol TCP -LocalPort $cfgJson.port -Action Allow -Profile Domain, Private | Out-Null
}
Step 'Starting the service'
Start-Service FlowlaceServer
Start-Sleep -Seconds 3
Get-Service FlowlaceServer | Format-Table -AutoSize Name, Status, StartType
$scheme = if ($cfgJson.tls) { 'https' } else { 'http' }
Write-Host "Flowlace Server is installed. Clients connect to: $scheme`://$env:COMPUTERNAME`:$($cfgJson.port)" -ForegroundColor Green
Write-Host "Log files: $progData\logs   Data: $($cfgJson.dataDir)"
