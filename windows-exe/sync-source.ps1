# 从上级项目同步源码到 windows-exe/workspace，并打入桌面版补丁。
$ErrorActionPreference = "Stop"
# robocopy 成功时 exit code 常为 1~7，不应触发 native command 失败
$PSNativeCommandUseErrorActionPreference = $false

$PkgDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $PkgDir
$Ws = Join-Path $PkgDir "workspace"

Write-Host "==> 源项目: $RootDir"
Write-Host "==> 工作区: $Ws"

if (Test-Path (Join-Path $Ws "backend")) { Remove-Item -Recurse -Force (Join-Path $Ws "backend") }
if (Test-Path (Join-Path $Ws "frontend")) { Remove-Item -Recurse -Force (Join-Path $Ws "frontend") }
New-Item -ItemType Directory -Force -Path $Ws | Out-Null

$backendExclude = @("__pycache__", ".pytest_cache", "*.pyc")
robocopy (Join-Path $RootDir "backend") (Join-Path $Ws "backend") /MIR /XD __pycache__ .pytest_cache /XF *.pyc | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy backend 失败: $LASTEXITCODE" }

$frontendExcludeDirs = @("node_modules", "dist", ".vite")
robocopy (Join-Path $RootDir "frontend") (Join-Path $Ws "frontend") /MIR /XD node_modules dist .vite /XF *.tsbuildinfo | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy frontend 失败: $LASTEXITCODE" }

$patchDir = Join-Path $PkgDir "patches\backend"
if (Test-Path $patchDir) {
    robocopy $patchDir (Join-Path $Ws "backend") /E | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "应用 backend patches 失败: $LASTEXITCODE" }
}

$frontendPatchDir = Join-Path $PkgDir "patches\frontend"
if (Test-Path $frontendPatchDir) {
    robocopy $frontendPatchDir (Join-Path $Ws "frontend") /E | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "应用 frontend patches 失败: $LASTEXITCODE" }
}

Write-Host "==> 同步完成"
exit 0
