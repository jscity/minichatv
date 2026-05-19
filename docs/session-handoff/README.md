# MiniChatV 会话备忘录

更新时间：2026-05-20

## 项目定位

MiniChatV 是一个部署在 Vercel 上的复古终端风格聊天前端，前端使用 Vite + React，后端使用 Vercel Serverless Function 转发 Gemini API。

当前仓库：

- 本地路径：`/Users/xt/Desktop/家庭AI助手/minichatv`
- GitHub：`https://github.com/jscity/minichatv`
- Vercel 项目页：`https://vercel.com/xts-projects-b1da549d/jscity-minichatv/`
- Vercel Project ID：`prj_KEnpLtnR9nc6NBMCSbFhOa2Q3Nph`

## 当前状态

- Vercel 部署结构已修正为 Vite 静态输出 + `/api/*` Serverless Function。
- `/api/chat` 只应使用 `POST` 调用；浏览器直接 `GET /api/chat` 返回 404/405 类错误并不代表聊天接口不能用。
- `vercel.json` 的 `includeFiles` 已按 Vercel schema 改为字符串格式。
- 默认模型路由已升级到 V3：`lite` 使用 `gemini-3.1-flash-lite`，`balanced` 使用 `gemini-3.5-flash`，`pro` 使用 `gemini-3.1-pro-preview`。
- 前端展示模型名已隐藏，不再显示具体 `gemini-*` 模型名称。
- 聊天内容已支持 Markdown 渲染，减少普通用户看到 `*`、`-` 等标记时的困惑。
- 登录密码文件化，默认密码来自 `PASSCODE.md`。
- SOUL 文件会在后端注入，不再只停留在前端 UI 选择。

## 已完成的关键改动

- 修复 Vercel 404：添加 SPA rewrite，前端路由回落到 `index.html`。
- 修复 Vercel schema：`functions.api/chat.js.includeFiles` 使用字符串。
- 增加默认 `MACHINE` SOUL 和四个菜单 SOUL：
  - `MACHINE`：默认绿色，不在菜单中；冷酷、极简、超理性。
  - `GENTLE`：温和、情绪照顾。
  - `PRO`：专业、无废话。
  - `SHARP`：犀利、有个性。
  - `SAVAGE`：毒舌、偶尔脏话。
- 右上角三个点打开 SOUL 选择器，已从轮盘改为复古终端弹窗。
- SOUL 选择保存到 cookie，重新打开页面后保留。
- 移动端内容区有透明全屏按钮，不再使用双击触发，避免 iOS 双击缩放冲突。
- 首次打开需要密码，解锁状态写入 cookie。
- 移动端解锁界面模拟电话拨号盘，桌面端模拟系统登录。
- 后端增加基于轻量任务、普通任务、高等数学、复杂代码和高风险领域的三档模型路由。
- 后端增加时间、黄金价格、最新信息等实时上下文获取入口。
- 高风险领域会强制走 `pro` 路由，并把激进 SOUL 降级到 `PRO`，避免医疗、金融、法律类回答过度人格化。

## 当前架构判断

当前系统可以实现“不要只依赖模型知识截止时间”的能力，但前提是问题触发了实时信号：

- 时间类问题：使用客户端传入的时区，并由服务端生成对应地区时间。
- 黄金价格类问题：后端尝试获取实时价格上下文。
- 最新、新闻、搜索类问题：后端尝试获取在线实时摘要。

这个设计不会让所有普通聊天都变慢：轻量短任务走 `lite`，大多数普通聊天走 `balanced`，只有高等数学、复杂代码、高风险或深度推理信号才走 `pro`。

## Vercel 注意点

- GitHub `main` 分支 push 后会触发 Vercel 自动部署。
- 优先使用 `LITE_MODEL`、`BALANCED_MODEL`、`PRO_MODEL`；旧的 `QUICK_MODEL` / `THINKING_MODEL` 仍兼容，但建议在 Vercel 控制台改成新变量。
- Gemini API Key 当前代码读取变量名是 `OPENAI_API_KEY`，这是历史命名，实际应填 Gemini Key。
- GitHub check 里出现 “No GitHub account was found matching the commit author email address”，原因是提交作者邮箱没有匹配 GitHub 账号；解决方式是把本地 git author email 改成 GitHub 账号邮箱或 noreply 邮箱后重新提交。

## 后续升级方向

- 用户记忆系统可以分两阶段：
  - 短期：继续使用 cookie 保存轻量偏好，如主题、语气、受众。
  - 下一版：引入服务端用户与记忆存储，支持长期偏好、摘要、线程历史和可控删除。
- 后续多模型路由可以扩展为 provider registry：
  - Gemini Flash-Lite：极速、低成本轻量回复。
  - Gemini Flash：默认全方位回答。
  - Gemini Pro：高等数学、复杂代码和高风险领域。
  - ChatGPT / Claude：强推理、代码、长文、复杂判断、风格化写作等细分路由。
- Vercel 管理可以继续补齐：
  - 拉取项目环境变量。
  - 检查最近部署状态。
  - 检查函数日志。
  - 校验生产域名与 GitHub 分支绑定。
