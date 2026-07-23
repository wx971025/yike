# 忆刻 Windows 桌面版（windows-desktop）

将 **前端 + 后端** 打包为本地 Windows 原生应用：双击图标打开原生窗口，免登录进入主界面；英文词典按需下载。

> 所有复制、构建、打包操作都在本目录完成，**不修改上级项目 `backend/`、`frontend/` 源码**（通过 `patches/` 套用到 `workspace/` 构建副本）。

## 打包产物

| 组件 | 说明 |
|------|------|
| 前端 | Vite 构建产物，由本地 FastAPI 静态托管 |
| 后端 | FastAPI + SQLite，数据在 `%LOCALAPPDATA%\YiKe\data\` |
| 窗口 | PyWebview + 系统 WebView2 原生窗口 |
| 词典 | ECDICT（约 200MB）**不预装**，在应用内「下载管理」按需下载 |
| 安装包 | Inno Setup 生成 `YiKeSetup.exe`（onedir 多文件，避免 onefile 首次解压超时） |

## 前置条件（Windows 构建机）

- Windows 10/11 64 位
- Python 3.11 x64
- Node.js 20 LTS
- Inno Setup 6（可选，用于生成安装包）
- 目标机需 Edge WebView2 Runtime（Win10/11 一般已自带）

## 一键打包（Windows）

**重要：** `windows-desktop` 必须与上级目录的 `backend/`、`frontend/` 同级，不能只单独拷贝本文件夹到 `Downloads`。

```text
your-repo/
  backend/
  frontend/
  windows-desktop/   <-- 在这里执行 build.ps1
```

```powershell
cd your-repo\windows-desktop
.\build.ps1
```

> PowerShell 5.1 注意：`build.ps1` / `sync-source.ps1` 必须以 **UTF-8 无 BOM** 保存，且 `param(...)` 在文件第一行。若出现 `PyWebview 无法识别` 或 `param 无法识别`，说明文件编码或首行注释有问题，请重新拉取最新脚本。

若源码在其它路径：

```powershell
$env:YIKE_SOURCE_ROOT = 'C:\path\to\yike-repo'
.\build.ps1
```

若已在 Linux 上跑过 `build-linux-prep.sh` 并连同 `workspace/` 一起拷到 Windows：

```powershell
.\build.ps1 -SkipSync
```

输出：

- `output/stage/YiKe/` — onedir 应用目录（含 `YiKe.exe`）
- `output/YiKeSetup.exe` — 安装包（若已安装 Inno Setup）

## Linux 上准备工作

Linux **无法** 交叉编译 Windows exe，但可完成同步与前端构建：

```bash
cd windows-desktop
chmod +x sync-source.sh build-linux-prep.sh
./build-linux-prep.sh
```

然后将整个 `windows-desktop/` 目录拷到 Windows，执行 `.\build.ps1`，或使用 GitHub Actions。

## GitHub Actions

推送 `windows-desktop/**` 或 `backend/**` 到 `main` 后，工作流 **Build Windows Desktop** 自动构建并上传 artifact。

## 运行方式

1. 安装 `YiKeSetup.exe` 或运行 `output/stage/YiKe/YiKe.exe`
2. 自动打开原生窗口，免登录进入主界面
3. 点击窗口关闭按钮会**隐藏到系统托盘**，程序继续在后台运行；托盘菜单可「打开忆刻」或「退出」
4. 设置 → **数据备份**：可导入/导出 JSON；导出时先选保存文件夹，再点「确定导出」
5. 使用词典功能时，若未下载会提示前往「下载管理」
6. 用户数据：`%LOCALAPPDATA%\YiKe\data\`
7. 日志：`%LOCALAPPDATA%\YiKe\logs\`

## 目录结构

```
windows-desktop/
├── build.ps1
├── build-linux-prep.sh
├── sync-source.ps1 / .sh
├── launcher/entry.py, yike.spec
├── patches/backend/app/...
├── installer/yike.iss
├── assets/icon.ico
├── workspace/   # 同步副本（git 忽略）
└── output/      # 构建产物（git 忽略）
```
