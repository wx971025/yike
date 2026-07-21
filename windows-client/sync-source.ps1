# 从上级项目同步 backend 到 YiKe.Backend/workspace，并打入桌面版补丁。
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$PkgDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $PkgDir
$Ws = Join-Path $PkgDir "YiKe.Backend\workspace"

Write-Host "==> 源项目: $RootDir"
Write-Host "==> 工作区: $Ws"

if (Test-Path (Join-Path $Ws "backend")) {
    Remove-Item -Recurse -Force (Join-Path $Ws "backend")
}
New-Item -ItemType Directory -Force -Path $Ws | Out-Null

robocopy (Join-Path $RootDir "backend") (Join-Path $Ws "backend") /MIR /XD __pycache__ .pytest_cache .venv /XF *.pyc | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy backend 失败: $LASTEXITCODE" }

$patchDir = Join-Path $PkgDir "YiKe.Backend\patches\backend"
if (Test-Path $patchDir) {
    robocopy $patchDir (Join-Path $Ws "backend") /E | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "应用 backend patches 失败: $LASTEXITCODE" }
}

Write-Host "==> 同步完成"
exit 0
