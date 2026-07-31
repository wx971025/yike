# 忆刻发版全流程（main → tag → GitHub Release）

本文档记录从代码推送到 `main`，到打 tag、自动构建 Windows 安装包并发布 GitHub Release 的**完整操作细节**。
以 **v1.0.0** 的实际发版过程为例，后续版本（v1.0.1、v1.1.0…）按同样步骤替换版本号即可。

---

## 一、流程总览

```text
开发完成
  ↓
./deploy.sh（Web 版，如有前后端变更）
  ↓
git push origin main（功能代码已在 main）
  ↓
编写 .github/release-notes/vX.Y.Z.md
  ↓
（可选）补充/修复 CI 工作流 → 再 push main
  ↓
git tag -a vX.Y.Z → git push origin vX.Y.Z
  ↓
等待 GitHub Actions「Release Windows Desktop」跑完（约 5–10 分钟）
  ↓
Release 页面出现 YiKeSetup.exe
```

**自动化原理：** 推送 `v*` 格式的 tag 会触发 [`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)，在 `windows-latest` 上执行 `build.ps1 -AppVersion X.Y.Z`（从 tag 去掉 `v` 前缀），生成带正确版本号的 `YiKeSetup.exe`，并用 [softprops/action-gh-release](https://github.com/softprops/action-gh-release) 创建 Release 并上传安装包。

**桌面客户端更新：** 已安装的应用会通过 GitHub Releases API 检测新版本；用户可在设置中「检查更新」，或在启动后每天最多提示一次。确认更新后应用内下载 `YiKeSetup.exe` 并启动 Inno 安装向导（数据仍在 `%LOCALAPPDATA%\YiKe\`）。

---

## 二、前置条件

| 项目             | 要求                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| 本地分支         | 功能已合并到`main`，且 `git status` 干净（或仅剩可提交的 release notes）                             |
| Release 说明文件 | `.github/release-notes/vX.Y.Z.md` 必须存在，否则 CI 创建 Release 时会因 `body_path` 找不到文件而失败 |
| CI 工作流        | 仓库内已有`release-desktop.yml`（v1.0.0 发版时已加入）                                                 |
| 远程权限         | 能对`origin` 执行 `git push` 和 `git push origin vX.Y.Z`                                           |
| Web 部署         | 若本次发版包含前后端改动，需先`./deploy.sh`                                                            |

---

## 三、分阶段操作（含实际执行过的命令）

以下按**推荐顺序**排列。阶段编号与 v1.0.0 发版时的实际操作对应。

---

### 阶段 0：确认 main 已包含待发布代码

**目的：** tag 指向的 commit 必须是你要发布的代码快照。

**检查：**

```bash
cd /path/to/yike   # 进入本仓库根目录（把路径换成你机器上的实际路径）
git checkout main  # 切换到 main 分支，发版 tag 应打在 main 上
git pull origin main  # 从远程拉取最新 main，避免基于过时的本地代码打 tag
git log -3 --oneline  # 查看最近 3 条提交，确认待发布功能已在历史中
git status -sb  # 简短查看工作区状态：是否有未提交改动、是否与 origin/main 同步
```

**期望结果：**

```text
## main...origin/main
（无未提交的功能代码，或仅剩即将提交的 release 相关文件）
```

**v1.0.0 时状态：** 功能代码已在 `d954a04`（数据备份弹窗 + FileDialog 修复），随后才补充 Release 工作流。

---

### 阶段 1：部署 Web 版（有前后端变更时）

**目的：** 线上 Web 与即将发布的版本一致。

**命令：**

```bash
./deploy.sh  # 执行项目部署脚本：Docker 构建镜像、重启容器，更新线上 Web 版
```

**等待：** Docker 构建并重启容器完成（通常 1–3 分钟）。

**期望输出片段：**

```text
==> 部署完成，容器状态:
...
==> 访问地址: http://0.0.0.0:80 (公网) / http://0.0.0.0:10001
```

**说明：** 若本次发版只改 CI/文档、不涉及应用代码，可跳过。

---

### 阶段 2：编写 Release 说明

**目的：** CI 会从该文件读取 GitHub Release 正文（`body_path`）。

**操作：**

1. 复制 [`.github/release-notes/v1.0.0.md`](../.github/release-notes/v1.0.0.md) 为模板
2. 新建 `.github/release-notes/vX.Y.Z.md`
3. 填写：版本亮点、Windows 安装说明、Web 部署说明

**v1.0.0 实际新建的文件：**

- `.github/release-notes/v1.0.0.md`

---

### 阶段 3：提交 Release 基础设施并推送 main

**目的：** 确保 tag 指向的 commit 上**同时存在** release notes 与 CI 工作流（首次发版或工作流有更新时需要）。

**v1.0.0 第一次 push main（加入 Release 工作流）：**

```bash
# 把 Release CI 工作流和 v1.0.0 发布说明加入暂存区
git add .github/workflows/release-desktop.yml .github/release-notes/v1.0.0.md

# 提交：说明本次变更是「打 tag 时自动构建并发布 Windows 安装包」
git commit -m "$(cat <<'EOF'
ci: 打 tag 时自动构建并发布 Windows 安装包到 GitHub Release

新增 release-desktop 工作流，上传 YiKeSetup.exe 与 v1.0.0 发布说明。
EOF
)"

git push origin main  # 推送到 GitHub 的 main 分支，使远程 main 包含工作流与 release notes
```

**结果：** `main` 指向 `a6720bf`。

**v1.0.0 第二次 push main（修复 CI 缺 Inno Setup）：**

第一次推 tag 后 CI **失败**（见「七、踩坑」）。修复后执行：

```bash
# 暂存修复后的两个 CI 工作流（Release 构建与日常构建都需安装 Inno Setup）
git add .github/workflows/release-desktop.yml .github/workflows/build-windows-desktop.yml

# 提交 CI 修复说明
git commit -m "$(cat <<'EOF'
ci: Release 构建前安装 Inno Setup 以生成 YiKeSetup.exe
EOF
)"

git push origin main  # 推送修复到 main，后续移动 tag 时会指向包含此修复的 commit
```

**结果：** `main` 指向 `68d4e4b`。

**等待：** `git push origin main` 返回成功即可，无需等 CI（此 push 本身不触发 Release 工作流，除非改了 tag）。

---

### 阶段 4：打 annotated tag

**目的：** 标记不可变的版本快照；必须使用 **annotated tag**（`-a`），便于 GitHub 识别为 Release 版本。

**首次打 tag（v1.0.0 最初在用户要求时）：**

```bash
# 创建带附注的 tag v1.0.0，-m 写入 tag 说明（会显示在 GitHub Release 标题旁）
git tag -a v1.0.0 -m "$(cat <<'EOF'
v1.0.0 — 忆刻首个稳定版

Web 版 + Windows 桌面版（PyWebview）可用：
- 艾宾浩斯复习、单词双轨、日历、AI 助手
- 桌面版：系统托盘驻留、数据备份导入导出、词典按需下载
EOF
)"

git push origin v1.0.0  # 把 tag 推到 GitHub；v* 格式会触发 release-desktop.yml 自动构建
```

**注意：** 若此时 `main` 上还没有 release notes / 工作流，后续需要**移动 tag**（见阶段 5）。

**常规发版（工作流与 release notes 已在 main 上时）：**

```bash
git checkout main       # 确保在 main 分支上操作
git pull origin main    # 拉取最新 main，tag 应打在最新 commit 上

# 创建 annotated tag；-m 写一行简短版本说明即可
git tag -a v1.0.1 -m "v1.0.1 — 简短说明"
```

---

### 阶段 5：推送 tag（触发 Release CI）

```bash
git push origin vX.Y.Z   # 把本地 tag 推到 GitHub；v* 格式会触发 release-desktop.yml
```

**若需把已有 tag 移到最新 main（v1.0.0 实际做过两次）：**

```bash
git checkout main        # 切到 main 分支
git pull origin main     # 拉取包含修复/workflow/release notes 的最新 commit

git tag -f v1.0.0        # -f：把已有 tag 强制移到当前 HEAD（修正 tag 指错 commit 时用）

# 强制更新远程 tag，重新触发 Release CI（只 force tag，不要 force main）
git push origin v1.0.0 --force
```

**⚠️ 只 force-push tag，不要 `git push --force origin main`。**

**触发后会发生什么：**

1. GitHub 收到 `v*` tag push 事件
2. 启动工作流 **Release Windows Desktop**
3. Runner：`windows-latest`
4. 步骤概要：
   - `checkout` 该 tag 对应代码
   - `choco install innosetup`（生成安装包必需）
   - `windows-desktop/build.ps1`（同步源码、npm build、PyInstaller、Inno Setup）
   - 校验 `windows-desktop/output/YiKeSetup.exe` 存在
   - `softprops/action-gh-release` 创建 Release 并上传 exe

**等待时长：** 约 **5–10 分钟**（含 npm ci、PyInstaller、Inno 打包）。

---

### 阶段 6：等待 CI 完成并验证

#### 6.1 在 GitHub 网页查看

1. 打开：[https://github.com/wx971025/yike/actions/workflows/release-desktop.yml](https://github.com/wx971025/yike/actions/workflows/release-desktop.yml)
2. 找到对应 tag 的最新 run
3. 状态变为 **绿色 ✓ completed / success**

**v1.0.0 两次 run 对照：**

| Run ID                                                                  | 结果       | 原因                                                          |
| ----------------------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| [29976680422](https://github.com/wx971025/yike/actions/runs/29976680422) | ❌ failure | CI 未装 Inno Setup，`YiKeSetup.exe` 未生成，Verify 步骤失败 |
| [29976874667](https://github.com/wx971025/yike/actions/runs/29976874667) | ✅ success | 已安装 Inno Setup，Release 创建成功                           |

#### 6.2 用 API 轮询（可选，命令行）

```bash
# 查询 release-desktop 工作流最近一次运行状态（公开 API，无需 gh 登录）
curl -s "https://api.github.com/repos/wx971025/yike/actions/workflows/release-desktop.yml/runs?per_page=1" \
  | python3 -c "import sys,json; r=json.load(sys.stdin)['workflow_runs'][0]; print(r['status'], r['conclusion'], r['html_url'])"
# status=运行中/已完成（queued/in_progress/completed）
# conclusion=success/failure/null（未完成时为 null）
# html_url=该次 run 的 Actions 详情页链接

# 查询指定某次 run 的详情（把 RUN_ID 换成 Actions 页 URL 里的数字，如 29976874667）
curl -s "https://api.github.com/repos/wx971025/yike/actions/runs/RUN_ID" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'], d['conclusion'])"
# 输出示例：completed success
```

**等到：** `completed success`。

#### 6.3 验证 Release 与安装包

```bash
# 读取指定 tag 的 Release 信息（含附件列表与下载地址）
curl -s "https://api.github.com/repos/wx971025/yike/releases/tags/v1.0.0" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('Release:', d.get('html_url'))
for a in d.get('assets',[]):
    print(' Asset:', a['name'], round(a['size']/1024/1024,1), 'MB')
"
# 期望看到 YiKeSetup.exe 及文件大小；若没有 assets 说明 CI 还未成功上传
```

**期望输出（v1.0.0 成功时）：**

```text
Release: https://github.com/wx971025/yike/releases/tag/v1.0.0
 Asset: YiKeSetup.exe 32.0 MB
```

**浏览器验证：**

- Release 页：[https://github.com/wx971025/yike/releases/tag/v1.0.0](https://github.com/wx971025/yike/releases/tag/v1.0.0)
- 直接下载：[https://github.com/wx971025/yike/releases/download/v1.0.0/YiKeSetup.exe](https://github.com/wx971025/yike/releases/download/v1.0.0/YiKeSetup.exe)

---

## 四、完整命令清单（可复制模板）

将 `v1.0.1` 替换为你的新版本号。

```bash
# ========== 0. 进入仓库并同步 main ==========
cd /path/to/yike                    # 进入仓库根目录
git checkout main && git pull origin main   # 切到 main 并拉最新（tag 应打在最新 commit 上）

# ========== 1. Web 部署（如有前后端变更）==========
./deploy.sh                         # Docker 重建并重启，更新线上 Web 版

# ========== 2. 编写 Release 说明（手动编辑文件）==========
# 新建并编辑：.github/release-notes/v1.0.1.md
# CI 会把这个文件内容作为 GitHub Release 页面正文

# ========== 3. 提交 release notes 并推送 main ==========
git add .github/release-notes/v1.0.1.md   # 暂存 release 说明（文件名必须与 tag 版本一致）
git commit -m "docs: v1.0.1 release notes" # 提交说明文件
git push origin main                       # 推 main；确保 tag 指向的 commit 包含此文件

# ========== 4. 打 tag 并推送（触发 Release CI）==========
git tag -a v1.0.1 -m "v1.0.1 — 简短说明"  # 创建 annotated tag，标记版本快照
git push origin v1.0.1                     # 推送 tag → 自动构建 YiKeSetup.exe 并发布 Release

# ========== 5. 等待 CI（约 5–10 分钟）==========
# 打开 Actions 页查看进度：
# https://github.com/wx971025/yike/actions/workflows/release-desktop.yml

# ========== 6. 验证 Release ==========
# 浏览器打开 Release 页，确认可下载 YiKeSetup.exe：
# https://github.com/wx971025/yike/releases/tag/v1.0.1

# ========== 7. 同步到国内更新镜像（桌面版 v1.1.7+ 优先从此拉取）==========
./get_releases.sh v1.0.1              # 从 GitHub 下载指定版本 → releases/desktop/，生成 latest.json
# 或: ./scripts/sync-desktop-release.sh v1.0.1
# 镜像地址：http://43.128.141.141/releases/desktop/latest.json
# 安装包不进 Git（releases/desktop/ 已在 .gitignore）
```

---

## 五、CI 各步骤说明（Release Windows Desktop）

| 步骤                      | 做什么                        | 失败时常见原因                                     |
| ------------------------- | ----------------------------- | -------------------------------------------------- |
| checkout                  | 检出 tag 对应代码             | tag 不存在或 ref 错误                              |
| setup-node / setup-python | 准备构建环境                  | 无                                                 |
| Install Inno Setup 6      | `choco install innosetup`   | Chocolatey 网络问题（少见）                        |
| Build YiKe desktop app    | `windows-desktop/build.ps1` | 前端/后端编译错误、依赖缺失                        |
| Verify installer          | 检查`output/YiKeSetup.exe`  | **未安装 Inno Setup**（v1.0.0 首次失败原因） |
| Create GitHub Release     | 上传 exe + 写入 release notes | **缺少 `.github/release-notes/vX.Y.Z.md`** |

---

## 六、与「Build Windows Desktop」工作流的区别

| 工作流                            | 触发时机                       | 产物去向                                                  |
| --------------------------------- | ------------------------------ | --------------------------------------------------------- |
| **Build Windows Desktop**   | 每次 push`main`              | Actions**Artifacts**（临时，30 天），不创建 Release |
| **Release Windows Desktop** | push`v*` tag 或手动 dispatch | GitHub**Release** 永久附件 `YiKeSetup.exe`        |

日常开发看 Artifacts；**正式发版必须走 tag → Release 工作流**。

---

## 七、v1.0.0 发版踩坑（已修复）

### 7.1 第一次 CI 失败：没有 YiKeSetup.exe

- **现象：** Verify installer 失败，Release 步骤 skipped
- **原因：** GitHub `windows-latest` 默认没有 Inno Setup，`build.ps1` 会跳过安装包，只产出 portable 目录
- **修复：** 在 `release-desktop.yml` 和 `build-windows-desktop.yml` 中增加 `choco install innosetup`
- **重发方式：**

  ```bash
  git push origin main          # 先把 CI 修复推到 main，使最新 commit 包含 Inno Setup 安装步骤
  git tag -f v1.0.0             # 把 tag 移到包含修复的最新 commit（覆盖本地 tag 指向）
  git push origin v1.0.0 --force   # 强制更新远程 tag，重新跑 Release 工作流（只 force tag）
  ```

### 7.2 tag 指向的 commit 没有 release 工作流

- **现象：** 若 tag 打在旧 commit 上，该 commit 可能没有 `.github/workflows/release-desktop.yml`
- **解决：** 把 tag 移到包含工作流 + release notes 的最新 commit（`git tag -f` + force push tag）

### 7.3 本地 `gh` 未登录

- **现象：** `gh release create` 不可用
- **解决：** 不依赖本地 `gh`，完全由 CI 自动创建 Release（当前标准流程）

---

## 八、手动补发（仅 CI 长期不可用时）

正常情况下**不要**手动上传。若必须：

1. 在 Windows 机器上执行 `windows-desktop/build.ps1` — 本地完整打包（npm build + PyInstaller + Inno Setup）
2. 取 `windows-desktop/output/YiKeSetup.exe` — 安装包输出路径
3. 在 GitHub → Releases → Draft new release → 选择 tag → 上传 exe — 网页手动创建 Release 并附安装包

---

## 九、相关文件索引

| 路径                                                                                             | 作用                           |
| ------------------------------------------------------------------------------------------------ | ------------------------------ |
| [`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)             | tag 触发：构建 + 发 Release    |
| [`.github/workflows/build-windows-desktop.yml`](../.github/workflows/build-windows-desktop.yml) | push main 触发：构建 Artifacts |
| [`.github/release-notes/v1.0.0.md`](../.github/release-notes/v1.0.0.md)                         | v1.0.0 Release 正文模板        |
| [`windows-desktop/build.ps1`](../windows-desktop/build.ps1)                                     | Windows 一键打包脚本           |
| [`.cursor/rules/general.mdc`](../.cursor/rules/general.mdc)                                     | 项目内发版规则摘要             |

---

## 十、检查清单（发版前勾选）

- [ ] 功能代码已在 `main` 且已 push
- [ ] `./deploy.sh` 已执行（如有前后端变更）
- [ ] `.github/release-notes/vX.Y.Z.md` 已写好
- [ ] release notes 已 commit 并 push 到 `main`
- [ ] `git tag -a vX.Y.Z` 打在正确 commit 上
- [ ] `git push origin vX.Y.Z` 已执行
- [ ] Actions「Release Windows Desktop」显示 success
- [ ] Release 页可下载 `YiKeSetup.exe`
- [ ] （可选）在 Windows 上安装后，设置 →「检查更新」显示正确版本号；旧版客户端可检测到新版本

---

## 十一、桌面版版本号与自动更新

### 版本号注入

- CI 解析 tag（如 `v1.0.2`）→ `build.ps1 -AppVersion 1.0.2`
- 构建时写入 `windows-desktop/launcher/version.json`，PyInstaller 打包进 exe
- Inno Setup 通过 `/DMyAppVersion=1.0.2` 编译，**无需再手工改** `yike.iss` 中的 `#define MyAppVersion`

### 客户端行为

| 能力     | 说明                                                   |
| -------- | ------------------------------------------------------ |
| 当前版本 | `GET /api/desktop/version` 或设置菜单显示            |
| 检查更新 | 对比 GitHub`releases/latest` 与本地 semver           |
| 下载     | 保存到`%TEMP%\YiKe\updates\YiKeSetup-{version}.exe`  |
| 安装     | Inno`/CLOSEAPPLICATIONS`，需退出托盘后再覆盖程序文件 |

### 发版后即可被旧客户端检测到

只要新 tag 的 Release 含 `YiKeSetup.exe`，旧版桌面客户端（已实现更新功能后）即可检测并升级。
