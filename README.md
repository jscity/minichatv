# Mini Chat (Figma UI build)

基于全新 Figma 设计的 Mini Chat 前端，复用原有的流式聊天代理逻辑，使用 Docker 进行一键部署。

## 功能概览

- ⚡️ `/api/chat` 支持流式响应，短轻任务走快速模型，其余默认走深度模型。
- 🛰️ 支持按需实时上下文：当前时间（用户时区）、黄金期货快照、Brave 在线搜索快照。
- 🧠 轻量偏好记忆（cookie）：按话题/语气/受众模式进行回答风格微调；代码类问题只作为当前路由信号，不写入长期身份偏好。
- 🎭 默认机器灵魂 + 四个可选灵魂：默认绿色 `Machine` 不出现在菜单中；菜单提供 `Gentle`、`Pro`、`Sharp`、`Savage`。高风险问题会自动回退到更稳健风格。
- 🔐 首次访问需要输入密码（来自 `PASSCODE.md`），通过后写入 cookie，cookie 有效期内免重复输入。
- 📝 支持 Markdown 渲染，列表、强调、代码块不再显示原始符号。
- ⚠️ 打开页（解锁界面）与对话页顶部显示下线提醒：本项目将于 2027-01-17 下线，请改用豆包或 DeepSeek。
- 🖥️ 复古终端风格界面，自动滚动、输入框高度自适应、打字中提示等交互。
- 🧱 React + Vite 前端构建，产物由 Express 静态托管。
- 🐳 提供 Dockerfile 与 docker-compose.yml，支持环境变量配置。

## 本地开发

```bash
# 安装依赖
npm install

# 启动前端开发服务器（默认代理到 8787）
npm run dev

# 另开终端启动后端代理（需要 DEEPSEEK_API_KEY；在线搜索需要 BRAVE_SEARCH_API_KEY）
DEEPSEEK_API_KEY=... npm run start
```

在开发时可使用 `.env` 文件存储密钥，或直接在命令行导出环境变量。

## 生产构建

```bash
npm run build
npm run start
```

`npm run build` 会生成 `dist/` 目录，`server.js` 会自动托管该目录并提供 `/api/chat` 流式接口。

## Docker 部署

1. 复制 `.env.example` 为 `.env`，填写真实的 `DEEPSEEK_API_KEY` 及其他配置。
2. 构建并启动容器：

   ```bash
   docker compose up -d --build
   ```

容器会暴露 `8787` 端口，可通过 `http://localhost:8787` 访问。

## Vercel 部署

本仓库已包含 `vercel.json` 与 `api/chat.js`，可直接部署为：
- 静态前端：`dist/`
- Serverless API：`/api/chat`

在 Vercel 项目中确认以下配置：

```bash
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

并在 Vercel 环境变量中至少设置：

```bash
DEEPSEEK_API_KEY=你的 DeepSeek API 密钥
BRAVE_SEARCH_API_KEY=你的 Brave Search API 密钥   # 可选；启用在线搜索
FAST_MODEL=deepseek-flash              # 可选；快速路由（关闭思考模式）
PRO_MODEL=deepseek-flash               # 可选；默认路由（开启思考模式）
DEFAULT_SOUL_MODE=machine              # 可选: machine/gentle/pro/sharp/savage
SYSTEM_PROMPT=You are a concise assistant.   # 可选
AUDIT_LOG_ENDPOINT=https://audit.xtvv.com/ingest   # 可选；启用访问审计
AUDIT_LOG_TOKEN=你的审计服务 Bearer token          # 可选；与 rack241 保持一致
AUDIT_LOG_INCLUDE_USER_TEXT=true                  # 可选；记录用户输入，不记录模型回复
AUDIT_LOG_TIMEOUT_MS=800                          # 可选；审计投递超时
```

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 必填，DeepSeek API 密钥 | 无 |
| `DEEPSEEK_BASE_URL` | 可选，DeepSeek（OpenAI 兼容）接口地址 | `https://api.deepseek.com` |
| `BRAVE_SEARCH_API_KEY` | 可选，Brave Search API 密钥；用于新闻、吃瓜、游戏实时/攻略搜索 | 空 |
| `FAST_MODEL` | 快速路由模型（短问候、短翻译、简短改写、时间类轻量问题；关闭思考模式） | `deepseek-flash` |
| `PRO_MODEL` | 默认路由模型（普通问答、代码、分析、数学、高风险问题；开启思考模式） | `deepseek-flash` |
| `QUICK_MODEL` | 旧配置兼容；未设置 `FAST_MODEL` 时作为快速模型 | 空 |
| `THINKING_MODEL` | 旧配置兼容；未设置 `PRO_MODEL` 时作为深度模型 | 空 |
| `BALANCED_MODEL` | 旧配置兼容；未设置 `PRO_MODEL` / `THINKING_MODEL` 时作为深度模型 | 空 |
| `LITE_MODEL` | 旧配置残留；当前代码不再读取 | 空 |
| `MODEL` | 全局兜底模型（兼容旧配置） | 空 |
| `DEFAULT_SOUL_MODE` | 默认灵魂模式 | `machine` |
| `SYSTEM_PROMPT` | 系统提示词 | `You are a concise assistant.` |
| `AUDIT_LOG_ENDPOINT` | 可选，审计日志投递地址；设置后 `/api/chat` 与 `/api/unlock` 会异步投递访问元数据 | 空 |
| `AUDIT_LOG_TOKEN` | 可选，审计日志 Bearer token；必须与日志服务一致 | 空 |
| `AUDIT_LOG_INCLUDE_USER_TEXT` | 是否记录用户输入；不会记录模型回复或解锁密码 | `true` |
| `AUDIT_LOG_TIMEOUT_MS` | 审计投递超时时间，失败只写运行日志，不影响聊天 | `800` |
| `AUDIT_IP_HASH_SALT` | 可选，IP 哈希盐；默认使用审计 token | `AUDIT_LOG_TOKEN` |
| `PORT` | 服务监听端口 | `8787` |

其余配置沿用旧项目逻辑，如需扩展可直接修改 `server.js`。

## 代码结构

```
mini-chat-figma-app/
├── Dockerfile
├── docker-compose.yml
├── vercel.json
├── api/
│   ├── audit.js            # 访问审计异步投递工具
│   ├── chat.js             # Vercel Serverless API
│   └── unlock.js           # Passcode verify API
├── PASSCODE.md             # 登录口令（默认 8086）
├── SOUL_MACHINE.md         # 默认 Machine 灵魂
├── SOUL_GENTLE.md          # Gentle 灵魂
├── SOUL_PRO.md             # Pro 灵魂
├── SOUL.md                 # Sharp 灵魂
├── SOUL_SHARP.md           # Savage 灵魂
├── server.js              # Express + 流式代理
├── src/
│   ├── App.tsx
│   ├── components/ChatInterface.tsx
│   ├── main.tsx
│   └── styles/globals.css
├── public/
│   └── favicon.svg
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

祝使用愉快！
