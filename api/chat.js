import fs from 'node:fs';
import path from 'node:path';

const {
  MODEL,
  QUICK_MODEL = 'gemini-3-flash-preview',
  THINKING_MODEL = 'gemini-3-pro-preview',
  SYSTEM_PROMPT = 'You are a concise assistant.',
  OPENAI_API_KEY,
  DEFAULT_SOUL_MODE = 'warm'
} = process.env;

const OPENAI_BASE_URL = 'https://generativelanguage.googleapis.com';
const FAST_MODEL = QUICK_MODEL || MODEL || 'gemini-3-flash-preview';
const DEEP_MODEL = THINKING_MODEL || MODEL || 'gemini-3-pro-preview';
const VALID_SOUL_MODES = new Set(['warm', 'sharp']);
const VALID_TOPICS = new Set(['general', 'emotion', 'game', 'coding', 'medical', 'elder', 'kids']);
const VALID_TONES = new Set(['balanced', 'warm', 'direct', 'professional']);
const VALID_AUDIENCE = new Set(['general', 'elder', 'kids']);
const SOUL_CACHE = new Map();
const SOUL_FILE_BY_MODE = {
  warm: 'SOUL.md',
  sharp: 'SOUL_SHARP.md'
};

const HIGH_STAKES_RE =
  /(医疗|医生|病情|诊断|用药|处方|手术|法律|合同|起诉|刑事|合规|税务|理财|投资|股票建议|financial advice|medical advice|legal advice|diagnosis|prescription|lawsuit|compliance)/i;
const COMPLEX_RE =
  /(架构|设计方案|分步骤|trade[- ]?off|debug|排查|算法|深度分析|implementation|refactor|多方案对比|根因分析|推理)/i;
const TIME_RE = /(现在几点|当前时间|现在时间|what time|current time|time now|today date|今天几号)/i;
const GOLD_RE = /(黄金|金价|xau|gold price|gold quote|gold)/i;
const SEARCH_RE = /(搜索|查一下|联网|最新|新闻|快讯|headline|breaking|latest news|online search|实时信息)/i;

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
  const key = VALID_SOUL_MODES.has(mode) ? mode : 'warm';
  const cached = SOUL_CACHE.get(key);
  if (cached) return cached;

  const fileName = SOUL_FILE_BY_MODE[key] || 'SOUL.md';
  const soulPath = path.join(process.cwd(), fileName);
  try {
    const text = fs.readFileSync(soulPath, 'utf8').trim();
    SOUL_CACHE.set(key, text);
    return text;
  } catch {
    return SYSTEM_PROMPT;
  }
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
  const mode = typeof requestedMode === 'string' ? requestedMode.toLowerCase() : '';
  const normalized = VALID_SOUL_MODES.has(mode) ? mode : DEFAULT_SOUL_MODE;
  if (highStakes && normalized === 'sharp') return 'warm';
  return VALID_SOUL_MODES.has(normalized) ? normalized : 'warm';
}

function getLatestUserText(payload, history) {
  if (typeof payload?.text === 'string' && payload.text.trim()) return payload.text.trim();
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (msg?.role === 'user' && typeof msg.content === 'string') return msg.content.trim();
  }
  return '';
}

function detectSignals(text) {
  const source = (text || '').trim();
  return {
    highStakes: HIGH_STAKES_RE.test(source),
    complex: source.length > 260 || COMPLEX_RE.test(source),
    needTime: TIME_RE.test(source),
    needGoldPrice: GOLD_RE.test(source),
    needSearch: SEARCH_RE.test(source),
    needRealtime: TIME_RE.test(source) || GOLD_RE.test(source) || SEARCH_RE.test(source)
  };
}

function resolveModel(signals) {
  if (signals.highStakes || signals.complex) return DEEP_MODEL;
  return FAST_MODEL;
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

function decodeEntities(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function pickFirstTag(itemXml, tagName) {
  const re = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const matched = itemXml.match(re);
  return matched?.[1] ? decodeEntities(matched[1].trim()) : '';
}

async function fetchNewsSnapshot(query) {
  const q = query.trim().slice(0, 90) || 'latest world news';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
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
    if (!resp.ok) return [];
    const xml = await resp.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    return blocks.slice(0, 3).map((item) => ({
      title: pickFirstTag(item, 'title'),
      pubDate: pickFirstTag(item, 'pubDate')
    }));
  } catch {
    return [];
  }
}

async function buildRuntimeContext({ text, clientTimeZone, locale, signals }) {
  const blocks = [];
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
    const news = await fetchNewsSnapshot(text);
    if (news.length > 0) {
      const lines = news.map((item, idx) => `${idx + 1}. ${item.title} (${item.pubDate || 'time unknown'})`);
      blocks.push(['[Live Search Snapshot]', '- Source: Google News RSS', ...lines].join('\n'));
    }
  }

  return blocks.join('\n\n');
}

function buildSystemInstruction({ soulText, userProfile, runtimeContext, signals }) {
  const baseRules = [
    'Runtime rules:',
    '- If runtime context is present, prioritize it over model memory.',
    '- If the question requires fresh data but runtime context is missing, state uncertainty explicitly.',
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
    const model = resolveModel(signals);
    const soulMode = resolveSoulMode(payload?.soulMode || cookies.soul_mode, signals.highStakes);
    const soulText = readSoulText(soulMode);
    const runtimeContext = await buildRuntimeContext({
      text,
      clientTimeZone: payload?.clientTimeZone || cookies.client_tz,
      locale: payload?.locale || 'zh-CN',
      signals
    });
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
    res.setHeader('X-Route-Model', model);
    res.setHeader('X-Route-Soul', soulMode);
    res.setHeader(
      'X-Route-Tags',
      [
        signals.highStakes ? 'high_stakes' : '',
        signals.complex ? 'complex' : '',
        signals.needRealtime ? 'realtime' : '',
        signals.needGoldPrice ? 'gold' : '',
        signals.needSearch ? 'search' : ''
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
