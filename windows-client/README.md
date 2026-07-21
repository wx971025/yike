# 忆刻 YiKe — Windows 原生客户端

WinUI 3 原生界面 + 本地 FastAPI 后端子进程，安装包为 `YiKeSetup.exe`。

## 架构

- **YiKe.exe** — WinUI 3 桌面程序（C# / .NET 8）
- **YiKeBackend.exe** — PyInstaller 打包的 FastAPI，监听 `127.0.0.1:17890`
- **数据** — `%LOCALAPPDATA%\YiKe\data\`（SQLite + ECDICT）

## 目录

```
windows-client/
├── YiKe.Desktop/       WinUI 3 主程序
├── YiKe.Backend/       后端打包（PyInstaller）
├── assets/             构建时下载 ecdict.db
├── installer/          Inno Setup 脚本
├── scripts/            词典下载等
├── sync-source.ps1     从上级项目同步 backend/
└── build.ps1           一键构建（需 Windows）
```

## 构建要求

- Windows 10/11
- Visual Studio 2022（含 .NET 桌面开发、Windows App SDK）
- Python 3.11+
- Inno Setup 6（可选，用于生成安装包）

## 构建步骤

```powershell
cd windows-client
.\build.ps1              # 后端 + 桌面 + 安装包
.\build.ps1 -SkipInstaller # 跳过 Inno Setup
```

Linux 开发机可执行 `./sync-source.sh` 同步后端源码并检查目录结构；最终 exe/安装包须在 Windows 或 CI `windows-latest` 上构建。

## 开发调试

1. 同步后端：`.\sync-source.ps1`
2. 在 `YiKe.Backend` 目录运行 `python launcher/entry.py`（需已安装 workspace/backend 依赖）
3. 在 Visual Studio 中打开 `YiKe.Desktop/YiKe.Desktop.csproj` 并启动

桌面程序启动时会自动拉起同目录下的 `YiKeBackend.exe`。
