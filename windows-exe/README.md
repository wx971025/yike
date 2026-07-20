# 忆刻 Windows 离线桌面版打包

将 **前端 + 后端 + ECDICT 词典** 全部打进单个 `YiKe.exe`，用户双击后**无需网络**即可使用（复习、卡片、单词、事项、分组等核心功能）。

> 所有复制、构建、打包操作都在本目录完成，**不修改上级项目源码**。

## 打包产物里有什么

| 组件 | 说明 |
|------|------|
| 前端 | Vite 构建的 HTML/JS/CSS，由本地服务静态托管，不访问 CDN |
| 后端 | FastAPI + SQLite，API 走 `127.0.0.1`，不依赖 Docker |
| 词典 | ECDICT（约 200MB）嵌入 exe，首次运行释放到 `%LOCALAPPDATA%\YiKe\data\` |
| 读音 | 与 Web 版相同，使用有道外链；无网络时点击播放会失败（不播放） |

**仍需联网的功能（可选）：** AI 助手（需自行配置 API Key）。

## 前置条件（Windows 构建机）

- Windows 10/11 64 位
- Python 3.11 x64
- Node.js 20 LTS
- 构建时联网一次（下载 npm 依赖 + ECDICT 词典）

## 一键打包

```powershell
cd windows-exe
.\build.ps1
```

输出：`output/YiKe.exe`（体积约 **250MB+**，含词典）

## 运行方式

1. 双击 `YiKe.exe`
2. 自动打开浏览器访问 `http://127.0.0.1:17890`
3. 用户数据保存在 `%LOCALAPPDATA%\YiKe\data\`
4. 关闭控制台窗口即退出

## 分步说明

```powershell
# 1. 同步上级项目到 workspace/，并应用 patches/（离线补丁）
.\sync-source.ps1

# 2. 下载 ECDICT 到 assets/ecdict.db（构建机联网一次）
.\scripts\download-ecdict.ps1

# 3. 构建前端
cd workspace\frontend
npm ci
npm run build
cd ..\..

# 4. PyInstaller 打包
.\build.ps1   # 或手动 pyinstaller launcher\yike.spec ...
```

Linux/WSL 可执行 `./build-linux-prep.sh` 完成同步、词典、前端构建；**最终 exe 必须在 Windows 上生成**（见下节）。

## 在 Linux 服务器上打包

**结论：Linux 不能直接产出 `.exe`。** PyInstaller 无法交叉编译，在 Linux 上只能打 Linux 程序。

### 第一步：在 Linux 上做准备工作

```bash
cd /home/wangxu/ebbinghaus/windows-exe   # 换成你的路径
chmod +x build-linux-prep.sh sync-source.sh scripts/download-ecdict.sh
./build-linux-prep.sh
```

需要已安装 **Node.js 20+** 和 **curl**。脚本会同步源码、下载 ECDICT（约 200MB）、构建前端。

### 第二步：生成 exe（二选一）

**方式 A — 拷到 Windows 电脑（推荐）**

1. 把整个 `windows-exe/` 目录传到 Windows（含 `workspace/`、`assets/ecdict.db`）
2. 安装 Python 3.11，PowerShell 执行：

```powershell
cd windows-exe
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-build.txt
pyinstaller launcher\yike.spec --distpath output --workpath build -y
```

得到 `output\YiKe.exe`。若未在 Linux 构建前端，直接跑 `.\build.ps1` 即可全自动。

**方式 B — GitHub Actions（没有 Windows 电脑时）**

1. 项目 push 到 GitHub
2. 打开 **Actions** → **Build Windows EXE** → **Run workflow**
3. 完成后下载 Artifacts 里的 `YiKe.exe`

工作流文件：`.github/workflows/build-windows-exe.yml`

## 目录结构

```
windows-exe/
├── build.ps1                 # Windows 一键打包
├── build-linux-prep.sh       # Linux 上同步+词典+前端（不含 exe）
├── sync-source.ps1 / .sh     # 复制项目 + 打补丁
├── scripts/
│   └── download-ecdict.*     # 下载词典（仅构建时）
├── assets/
│   └── ecdict.db             # 构建后生成，嵌入 exe（不提交 git）
├── launcher/
│   ├── entry.py              # exe 入口
│   └── yike.spec             # PyInstaller 配置
├── patches/
│   └── backend/              # 离线词典、静态页托管
├── workspace/                # 同步副本（git 忽略）
└── output/
    └── YiKe.exe              # 最终产物
```

## 离线原理

1. **前端**：`npm run build` 后所有 JS/CSS 在 `frontend_dist` 内；`desktop_server.py` 由 FastAPI 托管，`/api` 与页面同源。
2. **后端**：Python 与依赖由 PyInstaller 打入 exe，SQLite 数据库在用户目录。
3. **词典**：`assets/ecdict.db` 打入 exe，启动时复制到用户目录；`dict_setup.py` 补丁禁止运行时联网下载。
4. **读音**：与 Web 版一致，调用有道 `dictvoice` 外链；离线时播放失败，不影响其他功能。

## 常见问题

| 问题 | 处理 |
|------|------|
| 缺少 `assets/ecdict.db` | 运行 `scripts/download-ecdict.ps1` |
| exe 很大 | 正常，内含约 200MB 词典 |
| 查词不可用 | 确认构建时词典已下载并被打包 |
| exe 启动报 `Asia/Shanghai` 时区错误 | 需重新打包（已内置 tzdata）；旧版 exe 请重新下载 Actions 产物 |
| AI 不可用 | 离线设计如此；配置 API 后可联网使用 |
