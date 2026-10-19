# MiniChatV 关键参数手册

更新时间：2026-05-20

## 项目参数

| 项目 | 值 |
| --- | --- |
| 本地目录 | `/Users/xt/Desktop/家庭AI助手/minichatv` |
| GitHub 仓库 | `https://github.com/jscity/minichatv` |
| 默认分支 | `main` |
| Vercel 项目页 | `https://vercel.com/xts-projects-b1da549d/jscity-minichatv/` |
| Vercel Project ID | `prj_KEnpLtnR9nc6NBMCSbFhOa2Q3Nph` |
| 当前 app 版本 | `V3` |
| 前端框架 | `Vite + React` |
| 后端形态 | `Vercel Serverless Functions` |

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run preview
git status --short
git log -5 --oneline
git push origin main
```

## Vercel 构建配置

| 参数 | 值 |
| --- | --- |
| Framework | `vite` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| 前端 fallback | `/:path* -> /index.html` |
| API rewrite | `/api/:path* -> /api/:path*` |
| `api/chat.js` include files | `SOUL*.md` |
| `api/unlock.js` include files | `PASSCODE.md` |

## 环境变量

| 变量 | 必填 | 当前默认值 | 说明 |
| --- | --- | --- | --- |
| `DEEPSEEK_API_KEY` | 是 | 无 | DeepSeek API Key。 |
| `DEEPSEEK_BASE_URL` | 否 | `https://api.deepseek.com` | DeepSeek（OpenAI 兼容）接口地址。 |
| `FAST_MODEL` | 否 | `deepseek-flash` | 快速路由模型（关闭思考模式）；短问候、短翻译、简短改写、时间类轻量问题。 |
| `PRO_MODEL` | 否 | `deepseek-flash` | 默认路由模型（开启思考模式）；普通问答、代码、分析、数学、高风险问题。 |
| `QUICK_MODEL` | 否 | 无 | 旧配置兼容；未设置 `FAST_MODEL` 时作为快速模型。 |
| `THINKING_MODEL` | 否 | 无 | 旧配置兼容；未设置 `PRO_MODEL` 时作为深度模型。 |
| `BALANCED_MODEL` | 否 | 无 | 旧配置兼容；未设置 `PRO_MODEL` / `THINKING_MODEL` 时作为深度模型。 |
| `LITE_MODEL` | 否 | 无 | 旧配置残留；当前代码不再读取。 |
| `MODEL` | 否 | 无 | 兼容兜底模型变量。 |
| `SYSTEM_PROMPT` | 否 | `You are a concise assistant.` | SOUL 文件加载失败时的兜底提示词之一。 |
| `DEFAULT_SOUL_MODE` | 否 | `machine` | 默认灵魂模式。 |

## API 路由

| 路由 | 方法 | 作用 |
| --- | --- | --- |
| `/api/chat` | `POST` | 聊天流式响应、模型路由、SOUL 注入、实时上下文注入。 |
| `/api/unlock` | `POST` | 校验 `PASSCODE.md` 中的访问密码。 |

## 模型路由

| 条件 | 路由 | 默认模型 |
| --- | --- | --- |
| 短问候、短翻译、简短改写、时间类轻量问题 | `fast` | `deepseek-flash`（非思考） |
| 普通问答、联网总结、代码、分析、默认聊天 | `pro` | `deepseek-flash`（思考） |
| 高等数学、长问题、架构、调试、根因分析、复杂代码 | `pro` | `deepseek-flash`（思考） |
| 医疗、金融、法律、税务、合规等高风险领域 | `pro` | `deepseek-flash`（思考） |

高风险领域会自动把 `savage` / `sharp` SOUL 降级到 `pro`，避免过度毒舌或个性化影响严肃建议。

## SOUL 映射

| UI 名称 | 后端值 | 文件 | 用途 |
| --- | --- | --- | --- |
| 默认（不在菜单中） | `machine` | `SOUL_MACHINE.md` | 绿色默认；冷酷、极简、超理性。 |
| `GENTLE` | `gentle` | `SOUL_GENTLE.md` | 温和、情绪照顾、耐心解释。 |
| `PRO` | `pro` | `SOUL_PRO.md` | 专业、直接、少情绪表达。 |
| `SHARP` | `sharp` | `SOUL.md` | 有个性、犀利、但不攻击用户。 |
| `SAVAGE` | `savage` | `SOUL_SHARP.md` | 毒舌、偶尔脏话、有力度。 |

## Cookie

| Cookie | 值 | 作用 |
| --- | --- | --- |
| `terminal_unlock` | `1` | 已通过密码登录，下次打开免输入。 |
| `soul_mode` | `gentle` / `pro` / `sharp` / `savage` | 保存上一次菜单 SOUL 选择；默认 `machine` 不写入 cookie。 |
| `mini_pref` | JSON | 保存轻量用户偏好，如主题、语气、受众。 |

## 本地文件

| 文件 | 作用 |
| --- | --- |
| `api/chat.js` | DeepSeek 转发、流式响应、模型路由、实时上下文、SOUL 注入。 |
| `api/unlock.js` | 密码校验。 |
| `src/components/ChatInterface.tsx` | 主聊天 UI、登录界面、SOUL 弹窗、cookie 偏好、Markdown 渲染。 |
| `src/styles/globals.css` | 复古终端视觉、移动端布局、全屏阅读模式。 |
| `vercel.json` | Vercel 构建、函数 includeFiles、rewrite。 |
| `PASSCODE.md` | 初始访问密码，当前为 `8086`。 |
| `SOUL*.md` | 默认机器灵魂和四种菜单灵魂提示词。 |

## 快速排查清单

| 现象 | 优先检查 |
| --- | --- |
| 前端 `NOT_FOUND` | `vercel.json` rewrites、Vercel output directory 是否为 `dist`。 |
| `/api/chat` GET 404 | 正常；聊天接口应由前端 `POST` 调用。 |
| 聊天无响应 | Vercel env 是否存在 `DEEPSEEK_API_KEY`，函数日志是否有 DeepSeek API 错误。 |
| 模型仍走旧 Gemini | Vercel env 是否残留 `gemini-*` 的 `FAST_MODEL` / `PRO_MODEL` / `THINKING_MODEL`。 |
| SOUL 不生效 | 检查 `api/chat.js` 是否读取 `soulMode`，`vercel.json` 是否 include `SOUL*.md`。 |
| 登录密码不生效 | 检查 `PASSCODE.md` 是否被 include，前端 cookie 是否缓存旧登录状态。 |
| GitHub / Vercel check 失败作者邮箱 | 检查 `git config user.email` 是否匹配 GitHub 账号邮箱。 |
