# 忆刻 Windows 原生客户端 — 一键构建（后端 + WinUI + 安装包）
param(
    [switch]$SkipBackend,
    [switch]$SkipDesktop,
    [switch]$SkipInstaller
)

$ErrorActionPreference = "Stop"

$PkgDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $PkgDir

function Require-Command($Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "未找到命令: $Name，请先安装并加入 PATH"
    }
}

Write-Host "==> 忆刻 Windows 原生客户端构建"
Write-Host "==> 工作目录: $PkgDir"

& "$PkgDir\sync-source.ps1"
& "$PkgDir\scripts\download-ecdict.ps1"

$stageDir = Join-Path $PkgDir "output\stage"
if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir }
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

if (-not $SkipBackend) {
    & "$PkgDir\YiKe.Backend\build-backend.ps1"
    Copy-Item (Join-Path $PkgDir "YiKe.Backend\output\YiKeBackend.exe") $stageDir
}

if (-not $SkipDesktop) {
    Require-Command dotnet
    $desktopDir = Join-Path $PkgDir "YiKe.Desktop"
    $publishDir = Join-Path $desktopDir "publish"
    if (Test-Path $publishDir) { Remove-Item -Recurse -Force $publishDir }

    Write-Host "==> 编译 WinUI 桌面程序..."
    Push-Location $desktopDir
    dotnet publish -c Release -r win-x64 --self-contained true `
        -p:PublishSingleFile=true `
        -p:IncludeNativeLibrariesForSelfExtract=true `
        -o $publishDir
    Pop-Location

    $desktopExe = Join-Path $publishDir "YiKe.exe"
    if (-not (Test-Path $desktopExe)) {
        throw "编译失败，未找到 $desktopExe"
    }
    Copy-Item $desktopExe $stageDir
}

if (-not $SkipInstaller) {
    $iscc = @(
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $iscc) {
        Write-Warning "未找到 Inno Setup，跳过安装包。产物在 output\stage\"
    }
    else {
        Write-Host "==> 编译安装包 YiKeSetup.exe..."
        & $iscc (Join-Path $PkgDir "installer\yike.iss")
        $setup = Join-Path $PkgDir "output\YiKeSetup.exe"
        if (-not (Test-Path $setup)) {
            throw "安装包编译失败"
        }
        $sizeMb = [math]::Round((Get-Item $setup).Length / 1MB, 1)
        Write-Host "==> 安装包: $setup (${sizeMb} MB)"
    }
}

Write-Host ""
Write-Host "==> 构建完成。stage 目录: $stageDir"
