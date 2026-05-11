# Mini Chat (Figma UI build)

基于全新 Figma 设计的 Mini Chat 前端，复用原有的流式聊天代理逻辑，使用 Docker 进行一键部署。

## 功能概览

- ⚡️ `/api/chat` 支持流式响应，按问题类型自动路由到快模型或思考模型。
- 🛰️ 支持按需实时上下文：当前时间（用户时区）、黄金期货快照、Brave 在线搜索快照。
- 🧠 轻量偏好记忆（cookie）：按话题/语气/受众模式进行回答风格微调；代码类问题只作为当前路由信号，不写入长期身份偏好。
- 🎭 默认机器灵魂 + 四个可选灵魂：默认绿色 `Machine` 不出现在菜单中；菜单提供 `Gentle`、`Pro`、`Sharp`、`Savage`。高风险问题会自动回退到更稳健风格。
- 🔐 首次访问需要输入密码（来自 `PASSCODE.md`），通过后写入 cookie，cookie 有效期内免重复输入。
- 📝 支持 Markdown 渲染，列表、强调、代码块不再显示原始符号。
- 🖥️ 复古终端风格界面，自动滚动、输入框高度自适应、打字中提示等交互。
- 🧱 React + Vite 前端构建，产物由 Express 静态托管。
- 🐳 提供 Dockerfile 与 docker-compose.yml，支持环境变量配置。

## 本地开发

```bash
# 安装依赖
npm install

# 启动前端开发服务器（默认代理到 8787）
npm run dev

# 另开终端启动后端代理（需要 OPENAI_API_KEY；在线搜索需要 BRAVE_SEARCH_API_KEY）
OPENAI_API_KEY=... npm run start
```

在开发时可使用 `.env` 文件存储密钥，或直接在命令行导出环境变量。

## 生产构建

```bash
npm run build
npm run start
```

`npm run build` 会生成 `dist/` 目录，`server.js` 会自动托管该目录并提供 `/api/chat` 流式接口。

## Docker 部署

1. 复制 `.env.example` 为 `.env`，填写真实的 `OPENAI_API_KEY` 及其他配置。
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
OPENAI_API_KEY=你的真实密钥
BRAVE_SEARCH_API_KEY=你的 Brave Search API 密钥   # 可选；启用在线搜索
QUICK_MODEL=gemini-3-flash-preview     # 可选
THINKING_MODEL=gemini-3.1-pro-preview    # 可选
DEFAULT_SOUL_MODE=machine              # 可选: machine/gentle/pro/sharp/savage
SYSTEM_PROMPT=You are a concise assistant.   # 可选
```

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 必填，上游模型服务的密钥 | 无 |
| `BRAVE_SEARCH_API_KEY` | 可选，Brave Search API 密钥；用于新闻、吃瓜、游戏实时/攻略搜索 | 空 |
| `QUICK_MODEL` | 快速模型（普通问题） | `gemini-3-flash-preview` |
| `THINKING_MODEL` | 思考模型（高风险/复杂问题） | `gemini-3.1-pro-preview` |
| `MODEL` | 全局兜底模型（兼容旧配置） | 空 |
| `DEFAULT_SOUL_MODE` | 默认灵魂模式 | `machine` |
| `SYSTEM_PROMPT` | 系统提示词 | `You are a concise assistant.` |
| `PORT` | 服务监听端口 | `8787` |

其余配置沿用旧项目逻辑，如需扩展可直接修改 `server.js`。

## 代码结构

```
mini-chat-figma-app/
├── Dockerfile
├── docker-compose.yml
├── vercel.json
├── api/
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
