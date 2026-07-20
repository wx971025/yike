# 忆刻 Windows 桌面版 — 一键打包（前后端 + 词典全部打进 exe，运行时离线可用）
# 用法: 在 windows-exe 目录执行  .\build.ps1
$ErrorActionPreference = "Stop"

$PkgDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $PkgDir

function Require-Command($Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "未找到命令: $Name，请先安装并加入 PATH"
    }
}

Write-Host "==> 忆刻 Windows 离线 exe 打包"
Write-Host "==> 工作目录: $PkgDir"
Write-Host "    前端静态资源 + Python 后端 + ECDICT 词典 -> 单个 YiKe.exe"

Require-Command python
Require-Command npm

& "$PkgDir\sync-source.ps1"

& "$PkgDir\scripts\download-ecdict.ps1"

$frontendDir = Join-Path $PkgDir "workspace\frontend"
Write-Host "==> 构建前端（与 Web 版相同，读音使用有道外链）..."
Push-Location $frontendDir
npm ci
npm run build
Pop-Location

$venv = Join-Path $PkgDir ".venv"
if (-not (Test-Path $venv)) {
    Write-Host "==> 创建 Python 虚拟环境..."
    python -m venv $venv
}

$pip = Join-Path $venv "Scripts\pip.exe"
$pyinstaller = Join-Path $venv "Scripts\pyinstaller.exe"

Write-Host "==> 安装打包依赖..."
& $pip install -r (Join-Path $PkgDir "requirements-build.txt")

$outputDir = Join-Path $PkgDir "output"
$buildDir = Join-Path $PkgDir "build"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Write-Host "==> PyInstaller 打包（体积约 250MB+，含词典）..."
& $pyinstaller (Join-Path $PkgDir "launcher\yike.spec") `
    --distpath $outputDir `
    --workpath $buildDir `
    --noconfirm

$exe = Join-Path $outputDir "YiKe.exe"
if (-not (Test-Path $exe)) {
    throw "打包失败，未找到 $exe"
}

$sizeMb = [math]::Round((Get-Item $exe).Length / 1MB, 1)
Write-Host ""
Write-Host "==> 完成: $exe (${sizeMb} MB)"
Write-Host "    双击即可离线使用核心功能（单词读音需联网；AI 需配置 API）"
