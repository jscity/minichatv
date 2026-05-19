# Changelog

All notable changes to this project are documented in this file.

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
