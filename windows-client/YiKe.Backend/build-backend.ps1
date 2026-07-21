# 打包 YiKeBackend.exe（PyInstaller，仅 FastAPI API）
$ErrorActionPreference = "Stop"

$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $BackendDir

function Require-Command($Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "未找到命令: $Name，请先安装并加入 PATH"
    }
}

Require-Command python

$venv = Join-Path $BackendDir ".venv"
if (-not (Test-Path $venv)) {
    Write-Host "==> 创建 Python 虚拟环境..."
    python -m venv $venv
}

$pip = Join-Path $venv "Scripts\pip.exe"
$pyinstaller = Join-Path $venv "Scripts\pyinstaller.exe"

Write-Host "==> 安装打包依赖..."
& $pip install -r (Join-Path $BackendDir "requirements-build.txt")

$outputDir = Join-Path $BackendDir "output"
$buildDir = Join-Path $BackendDir "build"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Write-Host "==> PyInstaller 打包 YiKeBackend.exe..."
& $pyinstaller (Join-Path $BackendDir "launcher\backend.spec") `
    --distpath $outputDir `
    --workpath $buildDir `
    --noconfirm

$exe = Join-Path $outputDir "YiKeBackend.exe"
if (-not (Test-Path $exe)) {
    throw "打包失败，未找到 $exe"
}

$sizeMb = [math]::Round((Get-Item $exe).Length / 1MB, 1)
Write-Host "==> 完成: $exe (${sizeMb} MB)"
