param(
    [string]$SourceRoot = "",
    [switch]$SkipSync
)

# YiKe Windows desktop build
# Usage: .\build.ps1
#        .\build.ps1 -SkipSync
#        .\build.ps1 -SourceRoot 'C:\path\to\yike-repo'

$ErrorActionPreference = "Stop"

$PkgDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $PkgDir

function Require-Command($Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Command not found: $Name. Install it and add to PATH."
    }
}

Write-Host "==> YiKe Windows desktop build"
Write-Host "==> Working directory: $PkgDir"

Require-Command python
Require-Command npm

$syncArgs = @{}
if ($SourceRoot) { $syncArgs.SourceRoot = $SourceRoot }
if ($SkipSync) { $syncArgs.SkipSync = $true }
& "$PkgDir\sync-source.ps1" @syncArgs

$frontendDir = Join-Path $PkgDir "workspace\frontend"
Write-Host "==> Building frontend..."
Push-Location $frontendDir
npm ci
npm run build
Pop-Location

$venv = Join-Path $PkgDir ".venv"
if (-not (Test-Path $venv)) {
    Write-Host "==> Creating Python virtual environment..."
    python -m venv $venv
}

$pip = Join-Path $venv "Scripts\pip.exe"
$pyinstaller = Join-Path $venv "Scripts\pyinstaller.exe"

Write-Host "==> Installing build dependencies..."
& $pip install -r (Join-Path $PkgDir "requirements-build.txt")

$stageDir = Join-Path $PkgDir "output\stage"
$buildDir = Join-Path $PkgDir "build"
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

Write-Host "==> PyInstaller onedir..."
& $pyinstaller (Join-Path $PkgDir "launcher\yike.spec") `
    --distpath $stageDir `
    --workpath $buildDir `
    --noconfirm

$appExe = Join-Path $stageDir "YiKe\YiKe.exe"
if (-not (Test-Path $appExe)) {
    throw "Build failed: $appExe not found"
}

Write-Host ("==> App folder: {0}" -f (Join-Path $stageDir "YiKe"))

$iscc = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($iscc) {
    Write-Host "==> Building installer YiKeSetup.exe ..."
    & $iscc (Join-Path $PkgDir "installer\yike.iss")
    $setup = Join-Path $PkgDir "output\YiKeSetup.exe"
    if (Test-Path $setup) {
        $sizeMb = [math]::Round((Get-Item $setup).Length / 1MB, 1)
        Write-Host ("==> Installer: {0} ({1} MB)" -f $setup, $sizeMb)
    }
} else {
    Write-Warning "Inno Setup 6 not found; skipped YiKeSetup.exe. Run output\stage\YiKe\YiKe.exe directly."
}

Write-Host ""
Write-Host "==> Done"
exit 0
