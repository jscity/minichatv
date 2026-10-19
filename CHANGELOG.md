# Changelog

All notable changes to this project are documented in this file.

## 3.1.0 - 2026-10-19
- Switched the upstream provider from Gemini to OpenRouter's OpenAI-compatible API (`https://openrouter.ai/api/v1`).
- Defaulted both `fast` and `pro` routes to `deepseek/deepseek-v4.1-flash` (DeepSeek V4.1 Flash); `fast` disables reasoning, `pro` enables it. Reasoning content is not returned to the client.
- Read the key from `OPENROUTER_API_KEY`, falling back to the legacy `OPENAI_API_KEY`; added optional `OPENROUTER_BASE_URL`.
- Added a prominent sunset notice to the unlock screen and chat page: the project goes offline on 2027-01-17; users are pointed to Doubao or DeepSeek.

## 3.0.1 - 2026-05-21
- Removed Flash-Lite from active routing.
- Collapsed model routing to `fast` (`gemini-3.5-flash`) and `pro` (`gemini-3.1-pro-preview`).
- Routed former balanced/default requests to Pro; only lightweight short tasks stay on Fast.

## 3.0.0 - 2026-05-20
- Added three-tier Gemini routing: `lite`, `balanced`, and `pro`.
- Updated defaults to `gemini-3.1-flash-lite`, `gemini-3.5-flash`, and `gemini-3.1-pro-preview`.
- Routed advanced math, complex coding, and high-risk topics to Pro; lightweight quick tasks to Lite; general chat to Balanced.
- Updated the welcome screen version display to `V3`.

## 2.1.0 - 2026-05-11
- Replaced Google News RSS snapshots with Brave Search API runtime context.
- Added intent-based live search routing for news, gossip, game realtime updates, and game guides.
- Updated the welcome screen version display to `v2.1.0` and removed the ASCII frame around the version title.

## 2.0.0 - 2026-02-12
- Added `SOUL.md` to define assistant personality and response style.
- Updated `server.js` to load `SOUL.md` as system prompt with fallback to `SYSTEM_PROMPT`.
- Updated Docker runtime image to copy `SOUL.md` via `Dockerfile`.
- Bumped project version from `0.1.0` to `2.0.0` in `package.json` and `package-lock.json`.
