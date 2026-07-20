# 下载 ECDICT 词典到 assets/ecdict.db（打包时嵌入 exe，运行时完全离线）
$ErrorActionPreference = "Stop"

$PkgDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Assets = Join-Path $PkgDir "assets"
$Db = Join-Path $Assets "ecdict.db"
$Url = "https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip"
$MinBytes = 50000000

New-Item -ItemType Directory -Force -Path $Assets | Out-Null

if ((Test-Path $Db) -and ((Get-Item $Db).Length -ge $MinBytes)) {
    $sizeMb = [math]::Round((Get-Item $Db).Length / 1MB, 1)
    Write-Host "==> 内置词典已存在: $Db (${sizeMb} MB)"
    exit 0
}

Write-Host "==> 下载 ECDICT 词典（约 200MB），仅构建时需要联网一次…"
$Tmp = Join-Path $env:TEMP ("yike-ecdict-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $Tmp | Out-Null

try {
    $Zip = Join-Path $Tmp "ecdict.zip"
    Invoke-WebRequest -Uri $Url -OutFile $Zip -UseBasicParsing
    Expand-Archive -Path $Zip -DestinationPath $Tmp -Force
    $DbFile = Get-ChildItem -Path $Tmp -Filter "*.db" -Recurse | Select-Object -First 1
    if (-not $DbFile) { throw "压缩包内未找到 .db 文件" }
    Copy-Item $DbFile.FullName $Db -Force
    $sizeMb = [math]::Round((Get-Item $Db).Length / 1MB, 1)
    Write-Host "==> 已保存: $Db (${sizeMb} MB)"
}
finally {
    Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
