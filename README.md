# 艾宾浩斯复习提醒器

基于艾宾浩斯遗忘曲线的复习提醒 Web 应用。你记录学习了什么，系统会在第 1、3、7、15、30、60、180 天提醒你复习；只要你没有标记「已复习」，卡片会持续出现在待复习列表里，直到你完成为止。

## 功能

- 用户注册 / 登录（用户名 + 密码，JWT 鉴权）
- 学习卡片（item）管理：自定义标题、说明、所属分组、学习日期
- 分组（group）管理：按分组归类卡片
- 今日待复习列表：一键标记已复习，逾期卡片红色高亮
- 复习日历：月历视图展示未来每一天要复习的卡片，可按分组筛选查看某个分组的完整艾宾浩斯复习路径

## 技术栈

- 后端：Python 3.11 + FastAPI + SQLAlchemy + SQLite
- 前端：React 18 + TypeScript + Vite + TailwindCSS + FullCalendar
- 部署：Docker Compose，前端 Nginx 反向代理后端 API

## 复习规则

学习日记为第 0 天，复习间隔为 `[1, 3, 7, 15, 30, 60, 180]` 天，共 7 轮。

- 到期且未复习的卡片会出现在「今日待复习」，包含逾期卡片。
- 点击「标记已复习」后进入下一轮；完成第 7 轮后卡片标记为「已完成」。
- 到期当天不复习，第二天仍会继续提醒，直到你标记为止。

## 快速开始（Docker）

```bash
docker compose up --build -d
```

启动后访问 http://localhost:10001 即可使用。

数据保存在名为 `db_data` 的 Docker volume 中的 SQLite 文件里，容器重启不会丢失。删除该 volume 会清空所有数据。

生产环境请通过环境变量覆盖 JWT 密钥：

```bash
JWT_SECRET=your-strong-secret docker compose up --build -d
```

## 本地开发

后端：

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL="sqlite:///./dev.db" uvicorn app.main:app --reload --port 8000
```

前端（已配置代理到 http://localhost:8000）：

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器默认运行在 http://localhost:5173。

## 目录结构

```
ebbinghaus/
├── docker-compose.yml
├── backend/          # FastAPI 后端
│   └── app/
│       ├── main.py
│       ├── models.py
│       ├── schemas.py
│       ├── auth.py
│       ├── services/review.py   # 艾宾浩斯核心算法
│       └── routers/
└── frontend/         # React 前端
    ├── nginx.conf
    └── src/
        ├── pages/
        ├── components/
        └── context/
```
