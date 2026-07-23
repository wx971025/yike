param(
    [string]$SourceRoot = "",
    [string]$AppVersion = "",
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

function Get-DefaultAppVersion {
    $versionJsonPath = Join-Path $PkgDir "launcher\version.json"
    if (Test-Path $versionJsonPath) {
        try {
            $data = Get-Content $versionJsonPath -Raw | ConvertFrom-Json
            if ($data.version) {
                return [string]$data.version
            }
        } catch {
            Write-Warning "读取 launcher\version.json 失败，回退到 yike.iss"
        }
    }
    $issPath = Join-Path $PkgDir "installer\yike.iss"
    if (-not (Test-Path $issPath)) {
        return "1.0.0"
    }
    $content = Get-Content $issPath -Raw
    if ($content -match '#define\s+MyAppVersion\s+"([^"]+)"') {
        return $Matches[1]
    }
    return "1.0.0"
}

if (-not $AppVersion) {
    $AppVersion = Get-DefaultAppVersion
}
$AppVersion = $AppVersion.Trim().TrimStart("v", "V")
if (-not $AppVersion) {
    throw "AppVersion 不能为空"
}
Write-Host "==> App version: $AppVersion"

$versionJsonPath = Join-Path $PkgDir "launcher\version.json"
@{ version = $AppVersion } | ConvertTo-Json -Compress | Set-Content -Path $versionJsonPath -Encoding UTF8
Write-Host "==> Wrote $versionJsonPath"

Require-Command python
Require-Command npm

$syncArgs = @{}
if ($SourceRoot) { $syncArgs.SourceRoot = $SourceRoot }
if ($SkipSync) { $syncArgs.SkipSync = $true }
& "$PkgDir\sync-source.ps1" @syncArgs

$logoPng = Join-Path $PkgDir "workspace\frontend\public\logo.png"
$iconIco = Join-Path $PkgDir "assets\icon.ico"
if (-not (Test-Path $logoPng)) {
    throw "未找到 $logoPng，无法生成桌面图标"
}

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

Write-Host "==> 从 logo.png 生成 icon.ico ..."
$python = Join-Path $venv "Scripts\python.exe"
& $python (Join-Path $PkgDir "scripts\generate_icon.py") $logoPng $iconIco

$stageDir = Join-Path $PkgDir "output\stage"
$buildDir = Join-Path $PkgDir "build"
if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir }
if (Test-Path $buildDir) { Remove-Item -Recurse -Force $buildDir }
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

Write-Host "==> PyInstaller onedir..."
& $pyinstaller (Join-Path $PkgDir "launcher\yike.spec") `
    --distpath $stageDir `
    --workpath $buildDir `
    --clean `
    --noconfirm

$appDir = Join-Path $stageDir "YiKe"
Copy-Item $iconIco (Join-Path $appDir "icon.ico") -Force
Copy-Item $versionJsonPath (Join-Path $appDir "version.json") -Force
$appExe = Join-Path $appDir "YiKe.exe"
if (-not (Test-Path $appExe)) {
    throw "Build failed: $appExe not found"
}

Write-Host ("==> App folder: {0}" -f $appDir)

$iscc = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($iscc) {
    Write-Host "==> Building installer YiKeSetup.exe ..."
    & $iscc "/DMyAppVersion=$AppVersion" (Join-Path $PkgDir "installer\yike.iss")
    if ($LASTEXITCODE -ne 0) {
        throw "Inno Setup compile failed with exit code $LASTEXITCODE"
    }
    $setup = Join-Path $PkgDir "output\YiKeSetup.exe"
    if (-not (Test-Path $setup)) {
        throw "Inno Setup finished but installer not found: $setup"
    }
    $sizeMb = [math]::Round((Get-Item $setup).Length / 1MB, 1)
    Write-Host ("==> Installer: {0} ({1} MB)" -f $setup, $sizeMb)
} else {
    Write-Warning "Inno Setup 6 not found; skipped YiKeSetup.exe. Run output\stage\YiKe\YiKe.exe directly."
}

Write-Host ""
Write-Host "==> Done"
exit 0
