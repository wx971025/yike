param(
    [string]$SourceRoot = "",
    [switch]$SkipSync
)

# Sync backend/frontend into workspace and apply patches.

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

function Invoke-RobocopyMirror {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [string[]]$ExcludeDirs = @(),
        [string[]]$ExcludeFiles = @()
    )

    if (-not (Test-Path $Source)) {
        throw "Source path not found: $Source"
    }

    $robocopyArgs = @($Source, $Destination, "/MIR")
    foreach ($dir in $ExcludeDirs) { $robocopyArgs += "/XD"; $robocopyArgs += $dir }
    foreach ($file in $ExcludeFiles) { $robocopyArgs += "/XF"; $robocopyArgs += $file }

    & robocopy @robocopyArgs | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy failed (exit $LASTEXITCODE): $Source -> $Destination"
    }
}

function Test-WorkspaceReady {
    param([string]$Workspace)
    (Test-Path (Join-Path $Workspace "backend\app\main.py")) -and
    (Test-Path (Join-Path $Workspace "frontend\package.json"))
}

$PkgDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Ws = Join-Path $PkgDir "workspace"

if ($SourceRoot) {
    $RootDir = (Resolve-Path $SourceRoot).Path
} elseif ($env:YIKE_SOURCE_ROOT) {
    $RootDir = (Resolve-Path $env:YIKE_SOURCE_ROOT).Path
} else {
    $RootDir = Split-Path -Parent $PkgDir
}

$backendSrc = Join-Path $RootDir "backend"
$frontendSrc = Join-Path $RootDir "frontend"

Write-Host "==> Source project: $RootDir"
Write-Host "==> Workspace: $Ws"

$workspaceReady = Test-WorkspaceReady -Workspace $Ws

if ($SkipSync) {
    if (-not $workspaceReady) {
        throw @"
SkipSync was requested but workspace is incomplete.
Expected:
  $Ws\backend\app\main.py
  $Ws\frontend\package.json
Run sync-source without -SkipSync after placing the full repo, or set YIKE_SOURCE_ROOT.
"@
    }
    Write-Host "==> SkipSync: reusing existing workspace (patches will still be applied)"
} else {
    $backendMissing = -not (Test-Path $backendSrc)
    $frontendMissing = -not (Test-Path $frontendSrc)

    if ($backendMissing -or $frontendMissing) {
        if ($workspaceReady) {
            Write-Warning "Source repo not found under: $RootDir"
            Write-Warning "Using existing workspace instead. To refresh sources, clone the full repo or set YIKE_SOURCE_ROOT."
        } else {
            throw @"
Cannot find backend/frontend source under: $RootDir

Expected full project layout:
  your-repo/
    backend/
    frontend/
    windows-desktop/    <-- run build.ps1 here

Fix options:
  1. Clone the full repository, then:
       cd your-repo\windows-desktop
       .\build.ps1
  2. Point to an existing repo root:
       `$env:YIKE_SOURCE_ROOT = 'C:\path\to\yike-repo'
       .\build.ps1
  3. If workspace/ was prepared on Linux, copy it too and run:
       .\build.ps1 -SkipSync
"@
        }
    } else {
        if (Test-Path (Join-Path $Ws "backend")) {
            Remove-Item -Recurse -Force (Join-Path $Ws "backend")
        }
        if (Test-Path (Join-Path $Ws "frontend")) {
            Remove-Item -Recurse -Force (Join-Path $Ws "frontend")
        }
        New-Item -ItemType Directory -Force -Path $Ws | Out-Null

        Write-Host "==> Syncing backend..."
        Invoke-RobocopyMirror -Source $backendSrc -Destination (Join-Path $Ws "backend") `
            -ExcludeDirs @("__pycache__", ".pytest_cache") -ExcludeFiles @("*.pyc")

        Write-Host "==> Syncing frontend..."
        Invoke-RobocopyMirror -Source $frontendSrc -Destination (Join-Path $Ws "frontend") `
            -ExcludeDirs @("node_modules", "dist", ".vite") -ExcludeFiles @("*.tsbuildinfo")
    }
}

$patchDir = Join-Path $PkgDir "patches\backend"
if (Test-Path $patchDir) {
    if (-not (Test-Path (Join-Path $Ws "backend"))) {
        New-Item -ItemType Directory -Force -Path (Join-Path $Ws "backend") | Out-Null
    }
    Write-Host "==> Applying backend patches..."
    & robocopy $patchDir (Join-Path $Ws "backend") /E | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "Applying backend patches failed: $LASTEXITCODE"
    }
}

if (-not (Test-WorkspaceReady -Workspace $Ws)) {
    throw "Workspace is still incomplete after sync. Check paths above."
}

Write-Host "==> Sync complete"
exit 0
