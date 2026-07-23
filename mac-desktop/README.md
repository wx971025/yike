# 忆刻 macOS 桌面版（mac-desktop）

将 **前端 + 后端** 打包为本地 macOS 原生应用：双击图标打开原生窗口（WKWebView），免登录进入主界面；英文词典按需下载。

> 所有复制、构建、打包操作都在本目录完成，**不修改上级项目 `backend/`、`frontend/` 源码**（通过 `patches/` 套用到 `workspace/` 构建副本）。

## 打包产物

| 组件 | 说明 |
|------|------|
| 前端 | Vite 构建产物，由本地 FastAPI 静态托管 |
| 后端 | FastAPI + SQLite，数据在 `~/Library/Application Support/YiKe/data/` |
| 窗口 | PyWebview + 系统 WKWebView（cocoa，依赖 pyobjc） |
| 词典 | ECDICT（约 200MB）**不预装**，在应用内「下载管理」按需下载 |
| 安装包 | `hdiutil` 生成 `YiKe-mac-arm64.dmg`（拖拽到 Applications 即安装） |

## 前置条件（macOS 构建机）

- macOS 12+（Apple Silicon / arm64）
- Python 3.11
- Node.js 20+（推荐 24）
- Xcode Command Line Tools（提供 `hdiutil` / `codesign` / `iconutil`）

## 一键打包（macOS）

**重要：** `mac-desktop` 必须与上级目录的 `backend/`、`frontend/` 同级。

```text
your-repo/
  backend/
  frontend/
  mac-desktop/   <-- 在这里执行 build.sh
```

```bash
cd your-repo/mac-desktop
chmod +x build.sh
./build.sh
```

若源码在其它路径：

```bash
YIKE_SOURCE_ROOT=/path/to/yike-repo ./build.sh
```

指定版本号：

```bash
./build.sh --version 1.2.0
```

输出：

- `output/忆刻 YiKe.app` — 应用程序 bundle
- `output/YiKe-mac-arm64.dmg` — 安装镜像

## Linux 上准备工作

Linux **无法** 交叉编译 macOS 应用，但可完成源同步与前端构建：

```bash
cd mac-desktop
chmod +x build-linux-prep.sh
./build-linux-prep.sh
```

然后将整个 `mac-desktop/` 目录拷到 macOS，执行 `./build.sh`，或使用 GitHub Actions。

## GitHub Actions

推送 `mac-desktop/**`、`backend/**` 或 `frontend/**` 到 `main` 后，工作流 **Build macOS Desktop** 会在 `macos-latest`（arm64）上自动构建并上传 `.dmg` artifact。也可在 Actions 页手动 `workflow_dispatch`。

## 运行方式

1. 打开 `YiKe-mac-arm64.dmg`，把「忆刻 YiKe」拖入 Applications
2. 首次打开若被 Gatekeeper 拦截（未签名/未公证），右键图标 →「打开」，或执行：

   ```bash
   xattr -dr com.apple.quarantine "/Applications/忆刻 YiKe.app"
   ```

3. 自动打开原生窗口，免登录进入主界面
4. 设置 → **数据备份**：可导入/导出 JSON；导出时先选保存文件夹，再点「确定导出」
5. 使用词典功能时，若未下载会提示前往「下载管理」
6. 用户数据：`~/Library/Application Support/YiKe/data/`
7. 日志：`~/Library/Logs/YiKe/`

## 目录结构

```
mac-desktop/
├── build.sh
├── build-linux-prep.sh
├── sync-source.sh
├── requirements-build.txt
├── launcher/entry.py, version.json
├── packaging/yike-mac.spec, make_dmg.sh
├── scripts/generate_icns.py
├── patches/backend/app/...
├── assets/icon.icns   # 构建时生成
├── workspace/         # 同步副本（git 忽略）
└── output/            # 构建产物（git 忽略）
```
