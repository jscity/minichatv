# Mini Chat (Figma UI build)

基于全新 Figma 设计的 Mini Chat 前端，复用原有的流式聊天代理逻辑，使用 Docker 进行一键部署。

## 功能概览

- ⚡️ 保留原有 `/api/chat` 代理逻辑，向上游 Responses/Chat Completions 接口透传流式响应。
- 🖥️ 复古终端风格界面，自动滚动、输入框高度自适应、打字中提示等交互。
- 🧱 React + Vite 前端构建，产物由 Express 静态托管。
- 🐳 提供 Dockerfile 与 docker-compose.yml，支持环境变量配置。

## 本地开发

```bash
# 安装依赖
npm install

# 启动前端开发服务器（默认代理到 8787）
npm run dev

# 另开终端启动后端代理（需要 OPENAI_API_KEY ）
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
MODEL=gemini-2.5-pro   # 可选
SYSTEM_PROMPT=You are a concise assistant.   # 可选
```

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 必填，上游模型服务的密钥 | 无 |
| `MODEL` | 默认模型名称 | `gemini-2.5-pro` |
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
│   └── chat.js             # Vercel Serverless API
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
