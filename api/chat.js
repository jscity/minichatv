import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  MODEL,
  QUICK_MODEL = 'gemini-3-flash-preview',
  THINKING_MODEL = 'gemini-3.1-pro-preview',
  SYSTEM_PROMPT = 'You are a concise assistant.',
  OPENAI_API_KEY,
  BRAVE_SEARCH_API_KEY,
  DEFAULT_SOUL_MODE = 'machine'
} = process.env;

const OPENAI_BASE_URL = 'https://generativelanguage.googleapis.com';
const FAST_MODEL = QUICK_MODEL || MODEL || 'gemini-3-flash-preview';
const DEEP_MODEL = THINKING_MODEL || MODEL || 'gemini-3.1-pro-preview';
const VALID_SOUL_MODES = new Set(['machine', 'gentle', 'pro', 'sharp', 'savage']);
const VALID_TOPICS = new Set(['general', 'emotion', 'game', 'medical', 'elder', 'kids']);
const VALID_TONES = new Set(['balanced', 'warm', 'direct', 'professional']);
const VALID_AUDIENCE = new Set(['general', 'elder', 'kids']);
const SOUL_CACHE = new Map();
const SOUL_LOAD_WARNED = new Set();
const SOUL_FILE_BY_MODE = {
  machine: 'SOUL_MACHINE.md',
  gentle: 'SOUL_GENTLE.md',
  pro: 'SOUL_PRO.md',
  sharp: 'SOUL.md',
  savage: 'SOUL_SHARP.md'
};
const API_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(API_DIR, '..');
const SOUL_FALLBACK_BY_MODE = {
  machine: [
    '# Soul',
    '',
    '## Core',
    '- Machine profile: cold, rational, and extremely brief.',
    '- Answer with the fewest words that solve the request.',
    '- No warmth, no banter, no over-explanation.',
    '- Context First. State uncertainty briefly when facts are missing or stale.',
    '- Never insult, flatter, or moralize.',
    '',
    '## Vibe',
    'An unsentimental reasoning machine.'
  ].join('\n'),
  gentle: [
    '# Soul',
    '',
    '## Core',
    '- Gentle profile: empathetic, patient, and supportive.',
    '- Acknowledge emotions before proposing solutions.',
    '- Use warm, clear language and practical next steps.',
    '- Context First. If data is missing or stale, verify before advising.',
    '- No mockery, no aggression, no personal attacks.',
    '',
    '## Vibe',
    'Kind, stable, and reassuring.'
  ].join('\n'),
  pro: [
    '# Soul',
    '',
    '## Core',
    '- Pro profile: concise, technical, and execution-focused.',
    '- Start with conclusion, then key evidence.',
    '- No emotional padding or motivational filler.',
    '- Context First. Verify stale or missing facts before conclusions.',
    '- State assumptions and uncertainty clearly.',
    '',
    '## Vibe',
    'Professional, calm, and exact.'
  ].join('\n'),
  sharp: [
    '# Soul',
    '',
    '## Core',
    '- Sharp profile: decisive, clear, and fast.',
    '- Commit to a take and explain why.',
    '- Context First. Verify when facts are stale.',
    '- Be concise and direct, with light wit.',
    '- Challenge bad ideas without attacking the user.',
    '',
    '## Vibe',
    'Smart and direct with zero fluff.'
  ].join('\n'),
  savage: [
    '# Soul',
    '',
    '## Core',
    '- Savage profile: bold, spicy, and highly direct.',
    '- Commit hard, cut fluff, and keep momentum.',
    '- Occasional profanity is allowed when it adds impact.',
    '- Context First. Verify stale or missing facts before claiming certainty.',
    '- Never insult the user as a person.',
    '',
    '## Vibe',
    'High-energy, witty, and bluntly useful.'
  ].join('\n')
};

const HIGH_STAKES_RE =
  /(医疗|医生|病情|诊断|用药|处方|手术|法律|合同|起诉|刑事|合规|税务|理财|投资|股票建议|financial advice|medical advice|legal advice|diagnosis|prescription|lawsuit|compliance)/i;
const COMPLEX_RE =
  /(架构|设计方案|分步骤|trade[- ]?off|debug|排查|算法|深度分析|implementation|refactor|多方案对比|根因分析|推理)/i;
const CODING_RE = /(代码|编程|开发|调试|bug|api|python|javascript|typescript|react|程序|code|coding|programming)/i;
const TIME_RE = /(现在几点|当前时间|现在时间|what time|current time|time now|today date|今天几号)/i;
const GOLD_RE = /(黄金|金价|xau|gold price|gold quote|gold)/i;
const EXPLICIT_SEARCH_RE = /(搜索|查一下|联网|网上查|实时信息|latest|breaking|online search)/i;
const NEWS_RE = /(新闻|快讯|headline|latest news|breaking news|时事|突发|报道|发布会)/i;
const GOSSIP_RE = /(爆料|八卦|吃瓜|热搜|塌房|回应|声明|绯闻|大瓜|瓜|怎么回事)/i;
const GAME_DOMAIN_RE =
  /(游戏|手游|端游|主机|steam|ps5|xbox|switch|原神|崩铁|星穹铁道|崩坏|绝区零|王者荣耀|王者|英雄联盟|lol|云顶|金铲铲|和平精英|pubg|cs2|无畏契约|瓦罗兰特|valorant|明日方舟|阴阳师|第五人格|逆水寒|魔兽|wow|暗黑|diablo|塞尔达|王国之泪|旷野之息|黑神话|悟空|艾尔登法环|elden ring|赛博朋克|cyberpunk|我的世界|minecraft|宝可梦|pokemon|炉石|hearthstone|dota|apex|fortnite|cod|使命召唤)/i;
const GAME_REALTIME_RE =
  /(游戏更新|版本更新|补丁|活动|卡池|赛季|服务器|停服|维护|上线时间|兑换码|meta|tier list|强度榜|更新公告|前瞻|复刻|限定|排位|赛程)/i;
const GAME_GUIDE_RE =
  /(攻略|技巧|玩法|教程|通关|配队|阵容|配装|build|出装|加点|天赋|铭文|符文|连招|打法|机制|路线|隐藏任务|隐藏结局|成就|速刷|刷材料|角色培养|培养|怎么打|怎么过|怎么配|怎么玩)/i;
const FRESHNESS_RE = /(最新|今天|刚刚|现在|最近|目前|当前|本周|这周|本月|202[6-9]|latest|current|recent|today|now)/i;
const FRESH_TOPIC_RE =
  /(新闻|快讯|发布|宣布|上线|下架|价格|票房|排行|排名|赛程|政策|版本|更新|活动|趋势|进展|结果|名单|财报|发布会|事件)/i;
const SEARCH_FALSE_POSITIVE_RE = /(最新的?(结构|格式|版本)?整理|新闻风格|写一篇新闻|模拟新闻|新闻稿|改写成新闻)/i;

function parseJsonMaybe(input) {
  if (!input) return {};
  if (typeof input === 'object') return input;
  if (typeof input !== 'string') return {};
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

function parseCookies(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return {};
  return headerValue.split(';').reduce((acc, pair) => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) return acc;
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function readSoulText(mode) {
  const key = VALID_SOUL_MODES.has(mode) ? mode : 'machine';
  const cached = SOUL_CACHE.get(key);
  if (cached) return { text: cached, source: 'cache' };

  const fileName = SOUL_FILE_BY_MODE[key] || 'SOUL_MACHINE.md';
  const soulPath = path.join(PROJECT_ROOT, fileName);
  try {
    const text = fs.readFileSync(soulPath, 'utf8').trim();
    SOUL_CACHE.set(key, text);
    return { text, source: 'file' };
  } catch (err) {
    if (!SOUL_LOAD_WARNED.has(fileName)) {
      SOUL_LOAD_WARNED.add(fileName);
      const message = err instanceof Error ? err.message : String(err || 'unknown');
      console.warn(`[SOUL] Failed to load ${fileName} from ${soulPath}: ${message}`);
    }
    return {
      text: SOUL_FALLBACK_BY_MODE[key] || SYSTEM_PROMPT,
      source: 'fallback'
    };
  }
}

function normalizeSoulAlias(mode) {
  if (!mode || typeof mode !== 'string') return '';
  const normalized = mode.toLowerCase();
  const alias = {
    warm: 'gentle',
    professional: 'pro',
    toxic: 'savage',
    edgy: 'savage',
    default: 'machine',
    cold: 'machine',
    machine: 'machine'
  };
  return alias[normalized] || normalized;
}

function sanitizeProfile(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const topic = typeof candidate.topicPreference === 'string' ? candidate.topicPreference : '';
  const tone = typeof candidate.tonePreference === 'string' ? candidate.tonePreference : '';
  const audience = typeof candidate.audienceMode === 'string' ? candidate.audienceMode : '';

  return {
    topicPreference: VALID_TOPICS.has(topic) ? topic : 'general',
    tonePreference: VALID_TONES.has(tone) ? tone : 'balanced',
    audienceMode: VALID_AUDIENCE.has(audience) ? audience : 'general'
  };
}

function resolveSoulMode(requestedMode, highStakes) {
  const normalized = normalizeSoulAlias(requestedMode);
  const defaultMode = normalizeSoulAlias(DEFAULT_SOUL_MODE);
  const resolved = VALID_SOUL_MODES.has(normalized)
    ? normalized
    : VALID_SOUL_MODES.has(defaultMode)
      ? defaultMode
      : 'machine';
  if (highStakes && (resolved === 'savage' || resolved === 'sharp')) return 'pro';
  return resolved;
}

function getLatestUserText(payload, history) {
  if (typeof payload?.text === 'string' && payload.text.trim()) return payload.text.trim();
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (msg?.role === 'user' && typeof msg.content === 'string') return msg.content.trim();
  }
  return '';
}

function classifySearchIntent(text) {
  const source = (text || '').trim();
  if (!source || SEARCH_FALSE_POSITIVE_RE.test(source)) return 'none';

  const hasExplicitSearch = EXPLICIT_SEARCH_RE.test(source);
  const hasFreshness = FRESHNESS_RE.test(source);
  const hasGameDomain = GAME_DOMAIN_RE.test(source);
  const hasGameGuide = GAME_GUIDE_RE.test(source);
  const hasGameRealtime = GAME_REALTIME_RE.test(source);
  const hasGossip = GOSSIP_RE.test(source);
  const hasNews = NEWS_RE.test(source);

  if (hasGameDomain && hasGameGuide) return 'game_guide';
  if (hasGameDomain && hasGameRealtime) return 'game_realtime';
  if (hasGossip && (hasFreshness || hasExplicitSearch || hasNews)) return 'gossip';
  if (hasNews && (hasFreshness || hasExplicitSearch)) return 'news';
  if (hasExplicitSearch) return 'explicit_search';
  if (hasFreshness && (FRESH_TOPIC_RE.test(source) || hasGameDomain || hasGossip || hasNews)) return 'general_fresh';

  return 'none';
}

function detectSignals(text) {
  const source = (text || '').trim();
  const searchIntent = classifySearchIntent(source);
  return {
    highStakes: HIGH_STAKES_RE.test(source),
    complex: source.length > 260 || COMPLEX_RE.test(source) || CODING_RE.test(source),
    coding: CODING_RE.test(source),
    needTime: TIME_RE.test(source),
    needGoldPrice: GOLD_RE.test(source),
    searchIntent,
    needSearch: searchIntent !== 'none',
    needRealtime: TIME_RE.test(source) || GOLD_RE.test(source) || searchIntent !== 'none'
  };
}

function resolveModelRoute(signals) {
  const tier = signals.highStakes || signals.complex ? 'pro' : 'flash';
  const model = tier === 'pro' ? DEEP_MODEL : FAST_MODEL;
  return { tier, model };
}

function resolveTimeZone(input) {
  if (typeof input !== 'string' || !input.trim()) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: input }).format(new Date());
    return input;
  } catch {
    return 'UTC';
  }
}

function formatTimeForZone(date, timeZone, locale = 'zh-CN') {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGoldSnapshot() {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d';
  try {
    const resp = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MiniChatRuntime/1.0)'
        }
      },
      4500
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null;

    return {
      price: meta.regularMarketPrice,
      currency: meta.currency || 'USD',
      marketTime: typeof meta.regularMarketTime === 'number' ? meta.regularMarketTime : null,
      source: 'Yahoo Finance GC=F (COMEX Gold Futures)'
    };
  } catch {
    return null;
  }
}

function detectSearchLanguage(text) {
  return /[\u4e00-\u9fff]/.test(text || '')
    ? { country: 'CN', searchLang: 'zh', uiLang: 'zh-CN' }
    : { country: 'US', searchLang: 'en', uiLang: 'en-US' };
}

function resolveSearchPlan(text, intent) {
  const source = (text || '').trim();
  const language = detectSearchLanguage(source);
  const urgentGame = /(今天|刚刚|现在|停服|维护|上线|兑换码|today|now)/i.test(source);
  const versionSensitiveGuide = /(最新|当前版本|版本|meta|赛季|强度榜|卡池|build|tier list|current|latest)/i.test(source);
  const oldOrGeneralGuide = /(老游戏|怀旧|基础|新手技巧|机制|教程|入门)/i.test(source);

  const plan = {
    endpoint: 'web',
    freshness: 'pw',
    query: source.slice(0, 120) || 'latest news',
    intent,
    ...language
  };

  if (intent === 'news' || intent === 'gossip') {
    plan.endpoint = 'news';
    plan.freshness = 'pd';
  } else if (intent === 'game_realtime') {
    plan.endpoint = 'web';
    plan.freshness = urgentGame ? 'pd' : 'pw';
  } else if (intent === 'game_guide') {
    plan.endpoint = 'web';
    plan.freshness = oldOrGeneralGuide && !versionSensitiveGuide ? '' : versionSensitiveGuide ? 'pw' : 'pm';
  } else if (intent === 'general_fresh' || intent === 'explicit_search') {
    plan.endpoint = 'web';
    plan.freshness = 'pw';
  }

  plan.query = rewriteSearchQuery(source, intent);
  return plan;
}

function rewriteSearchQuery(text, intent) {
  const source = (text || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!source) return intent === 'news' || intent === 'gossip' ? 'latest news' : 'current information';

  if (intent !== 'game_guide') return source;

  const additions = [];
  if (!/(攻略|guide|walkthrough)/i.test(source)) additions.push('攻略');
  if (/(配队|阵容)/i.test(source) && !/阵容/.test(source)) additions.push('阵容');
  if (/(配装|build|出装|铭文|符文|天赋|加点)/i.test(source) && !/(配装|build)/i.test(source)) {
    additions.push('配装');
  }
  if (/(打法|怎么打|通关|怎么过|隐藏结局|隐藏任务)/i.test(source) && !/打法/.test(source)) {
    additions.push('打法');
  }
  if (/(最新|当前版本|版本|meta|赛季|强度榜|tier list|current|latest)/i.test(source) && !/当前版本/.test(source)) {
    additions.push('当前版本');
  }

  return [source, ...additions].join(' ').slice(0, 140);
}

function normalizeBraveResult(item, searchType, freshness) {
  const title = item?.title || item?.name || '';
  const url = item?.url || item?.profile?.url || '';
  const description = item?.description || item?.snippet || '';
  const age = item?.age || '';
  const published = item?.page_age || item?.published || item?.date || '';
  const source = item?.source || item?.meta_url?.hostname || '';

  if (!title && !description) return null;
  return {
    title,
    url,
    description,
    age,
    published,
    source,
    searchType,
    freshness
  };
}

async function requestBraveSearch(plan, freshnessOverride) {
  const token = typeof BRAVE_SEARCH_API_KEY === 'string' ? BRAVE_SEARCH_API_KEY.trim() : '';
  if (!token) return { ok: false, reason: 'missing_api_key', results: [] };

  const freshness = freshnessOverride ?? plan.freshness;
  const endpointPath = plan.endpoint === 'news' ? '/res/v1/news/search' : '/res/v1/web/search';
  const url = new URL(`https://api.search.brave.com${endpointPath}`);
  url.searchParams.set('q', plan.query);
  url.searchParams.set('count', plan.endpoint === 'news' ? '5' : '5');
  url.searchParams.set('country', plan.country);
  url.searchParams.set('search_lang', plan.searchLang);
  url.searchParams.set('ui_lang', plan.uiLang);
  url.searchParams.set('extra_snippets', 'true');
  url.searchParams.set('safesearch', 'moderate');
  if (freshness) url.searchParams.set('freshness', freshness);

  try {
    const resp = await fetchWithTimeout(
      url.toString(),
      {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': token,
          'User-Agent': 'Mozilla/5.0 (compatible; MiniChatRuntime/1.0)'
        }
      },
      4500
    );
    if (!resp.ok) return { ok: false, reason: `http_${resp.status}`, results: [] };
    const data = await resp.json();
    const rawResults = plan.endpoint === 'news' ? data?.results || [] : data?.web?.results || data?.results || [];
    const results = rawResults
      .map((item) => normalizeBraveResult(item, plan.endpoint, freshness || 'none'))
      .filter(Boolean)
      .slice(0, 5);
    return { ok: true, reason: '', results };
  } catch {
    return { ok: false, reason: 'request_failed', results: [] };
  }
}

async function fetchSearchSnapshot(query, intent) {
  const plan = resolveSearchPlan(query, intent);
  const first = await requestBraveSearch(plan);
  if (first.results.length > 0) return { ...first, plan };

  if ((intent === 'news' || intent === 'gossip') && plan.freshness === 'pd') {
    const fallback = await requestBraveSearch(plan, 'pw');
    if (fallback.results.length > 0) return { ...fallback, plan: { ...plan, freshness: 'pw' } };

    const webFallbackPlan = { ...plan, endpoint: 'web', freshness: 'pw' };
    const webFallback = await requestBraveSearch(webFallbackPlan);
    return {
      ...webFallback,
      reason: webFallback.reason || fallback.reason || first.reason,
      plan: webFallbackPlan
    };
  }

  return { ...first, plan };
}

async function buildRuntimeContext({ text, clientTimeZone, locale, signals }) {
  const blocks = [];
  const diagnostics = {
    searchStatus: 'not_requested',
    searchReason: '',
    searchIntent: signals.searchIntent || 'none',
    searchEndpoint: '',
    searchFreshness: ''
  };
  const now = new Date();
  const tz = resolveTimeZone(clientTimeZone);
  const localTime = formatTimeForZone(now, tz, locale);

  if (signals.needRealtime || signals.needTime || signals.needGoldPrice) {
    blocks.push(
      [
        '[Current Time]',
        `- User time zone: ${tz}`,
        `- User local time: ${localTime}`,
        `- UTC: ${now.toISOString()}`
      ].join('\n')
    );
  }

  if (signals.needGoldPrice) {
    const snapshot = await fetchGoldSnapshot();
    if (snapshot) {
      const marketIso = snapshot.marketTime ? new Date(snapshot.marketTime * 1000).toISOString() : 'unknown';
      blocks.push(
        [
          '[Gold Market Snapshot]',
          `- Last price: ${snapshot.price} ${snapshot.currency}`,
          `- Market timestamp (UTC): ${marketIso}`,
          `- Source: ${snapshot.source}`,
          '- Note: This is futures data (GC=F), not physical spot quote.'
        ].join('\n')
      );
    }
  }

  if (signals.needSearch) {
    const snapshot = await fetchSearchSnapshot(text, signals.searchIntent);
    diagnostics.searchStatus = snapshot.results.length > 0 ? 'ok' : 'failed';
    diagnostics.searchReason = snapshot.reason || (snapshot.results.length > 0 ? '' : 'no_results');
    diagnostics.searchEndpoint = snapshot.plan?.endpoint || '';
    diagnostics.searchFreshness = snapshot.plan?.freshness || 'none';
    if (snapshot.results.length > 0) {
      const lines = snapshot.results.map((item, idx) =>
        [
          `${idx + 1}. ${item.title || 'Untitled'}`,
          `   - URL: ${item.url || 'unknown'}`,
          `   - Description: ${item.description || 'none'}`,
          `   - Age/Published: ${item.age || item.published || 'unknown'}`,
          `   - Source: ${item.source || 'unknown'}`,
          `   - Search type: ${item.searchType}; freshness: ${item.freshness}`
        ].join('\n')
      );
      blocks.push(
        [
          '[Live Search Snapshot]',
          '- Source: Brave Search API',
          `- Intent: ${signals.searchIntent}`,
          `- Query: ${snapshot.plan.query}`,
          `- Endpoint: ${snapshot.plan.endpoint}; freshness: ${snapshot.plan.freshness || 'none'}`,
          ...lines
        ].join('\n')
      );
    } else {
      blocks.push(
        [
          '[Live Search Snapshot]',
          '- Source: Brave Search API',
          `- Intent: ${signals.searchIntent}`,
          `- Search unavailable or no reliable live results found: ${snapshot.reason || 'no_results'}`,
          '- Do not invent current facts. State uncertainty if fresh data is required.'
        ].join('\n')
      );
    }
  }

  return { text: blocks.join('\n\n'), diagnostics };
}

function buildSystemInstruction({ soulText, userProfile, runtimeContext, signals }) {
  const baseRules = [
    'Runtime rules:',
    '- If runtime context is present, prioritize it over model memory.',
    '- If the question requires fresh data but runtime context is missing, state uncertainty explicitly.',
    '- If live search results are present, use them as grounding and include source names or URLs when useful.',
    '- For gossip or leak-like topics, distinguish confirmed facts from claims, rumors, or media reports.',
    '- For game guides, mention the applicable version or source date when available; if unclear, say the guidance may be outdated.',
    '- If live search is unavailable or weak, say so plainly instead of inventing current facts.',
    '- Keep answers concise and practical.',
    '- Do not insult, mock, or attack the user.'
  ];

  if (signals.highStakes) {
    baseRules.push(
      '- High-stakes mode is active (medical/financial/legal). Give cautious guidance and include verification reminders.'
    );
  }

  const profileLines = userProfile
    ? [
        '[User Preference Memory]',
        `- Topic preference: ${userProfile.topicPreference}`,
        `- Tone preference: ${userProfile.tonePreference}`,
        `- Audience mode: ${userProfile.audienceMode}`
      ]
    : [];

  const runtimeLines = runtimeContext ? ['[Runtime Context]', runtimeContext] : [];

  return [soulText, '', ...baseRules, '', ...profileLines, '', ...runtimeLines].filter(Boolean).join('\n');
}

export const config = {
  maxDuration: 60
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: { message: 'OPENAI_API_KEY is required' } });
  }

  try {
    const payload = parseJsonMaybe(req.body);
    const rawHistory = Array.isArray(payload?.history) ? payload.history.slice(-24) : [];
    const cookies = parseCookies(req.headers?.cookie);
    const cookieProfile = sanitizeProfile(parseJsonMaybe(cookies.mini_pref));
    const bodyProfile = sanitizeProfile(payload?.userProfile);
    const userProfile = bodyProfile || cookieProfile;
    const text = getLatestUserText(payload, rawHistory);
    const signals = detectSignals(text);
    const route = resolveModelRoute(signals);
    const model = route.model;
    const soulMode = resolveSoulMode(payload?.soulMode || cookies.soul_mode, signals.highStakes);
    const soulResult = readSoulText(soulMode);
    const soulText = soulResult.text;
    const runtimeContextResult = await buildRuntimeContext({
      text,
      clientTimeZone: payload?.clientTimeZone || cookies.client_tz,
      locale: payload?.locale || 'zh-CN',
      signals
    });
    const runtimeContext = runtimeContextResult.text;
    const runtimeDiagnostics = runtimeContextResult.diagnostics;
    const systemPrompt = buildSystemInstruction({
      soulText,
      userProfile,
      runtimeContext,
      signals
    });

    const contents = rawHistory.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content || '' }]
    }));

    if (typeof payload?.text === 'string' && payload.text.trim()) {
      const last = contents[contents.length - 1];
      const lastText = last?.parts?.[0]?.text || '';
      if (lastText !== payload.text) {
        contents.push({
          role: 'user',
          parts: [{ text: payload.text }]
        });
      }
    }

    const body = {
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    const apiPath = `/v1beta/models/${model}:streamGenerateContent`;
    const url = `${OPENAI_BASE_URL}${apiPath}?key=${OPENAI_API_KEY}&alt=sse`;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Route-Model', route.tier);
    res.setHeader('X-Route-Soul', soulMode);
    res.setHeader('X-Route-Soul-Source', soulResult.source);
    res.setHeader('X-Route-Search-Intent', runtimeDiagnostics.searchIntent);
    res.setHeader('X-Route-Search-Status', runtimeDiagnostics.searchStatus);
    if (runtimeDiagnostics.searchReason) res.setHeader('X-Route-Search-Reason', runtimeDiagnostics.searchReason);
    if (runtimeDiagnostics.searchEndpoint) res.setHeader('X-Route-Search-Endpoint', runtimeDiagnostics.searchEndpoint);
    if (runtimeDiagnostics.searchFreshness) res.setHeader('X-Route-Search-Freshness', runtimeDiagnostics.searchFreshness);
    res.setHeader(
      'X-Route-Tags',
      [
        signals.highStakes ? 'high_stakes' : '',
        signals.complex ? 'complex' : '',
        signals.coding ? 'coding' : '',
        signals.needRealtime ? 'realtime' : '',
        signals.needGoldPrice ? 'gold' : '',
        signals.needSearch ? 'search' : '',
        signals.searchIntent !== 'none' ? `search_${signals.searchIntent}` : ''
      ]
        .filter(Boolean)
        .join(',')
    );

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text().catch(() => '');
      res.write(`data: ${JSON.stringify({ error: { status: upstream.status, body: txt } })}\n\n`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const geminiChunk = JSON.parse(line.substring(6));
          const text = geminiChunk?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) continue;

          const openAiChunk = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{ index: 0, delta: { content: text }, finish_reason: null }]
          };
          res.write(`data: ${JSON.stringify(openAiChunk)}\n\n`);
        } catch {
          // Ignore malformed stream events and continue consuming the stream.
        }
      }
    }

    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'proxy error';
    res.write(`data: ${JSON.stringify({ error: { message } })}\n\n`);
    return res.end();
  }
}
