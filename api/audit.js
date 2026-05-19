import crypto from 'node:crypto';
import { waitUntil } from '@vercel/functions';

const {
  AUDIT_LOG_ENDPOINT = '',
  AUDIT_LOG_TOKEN = '',
  AUDIT_LOG_INCLUDE_USER_TEXT = 'true',
  AUDIT_LOG_TIMEOUT_MS = '800',
  AUDIT_IP_HASH_SALT = AUDIT_LOG_TOKEN || 'minichat-audit'
} = process.env;

const SESSION_COOKIE = 'mini_session_id';
const SESSION_MAX_AGE = 365 * 24 * 60 * 60;
const INCLUDE_USER_TEXT = AUDIT_LOG_INCLUDE_USER_TEXT !== 'false';
const TIMEOUT_MS = Number.parseInt(AUDIT_LOG_TIMEOUT_MS, 10) || 800;

export function parseCookies(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return {};
  return headerValue.split(';').reduce((acc, pair) => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) return acc;
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (!key) return acc;
    try {
      acc[key] = decodeURIComponent(value);
    } catch {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export function getHeader(req, name) {
  const headers = req?.headers || {};
  const value = headers[name] || headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value || '';
}

export function getClientIp(req) {
  const cloudflareIp = getHeader(req, 'cf-connecting-ip');
  if (cloudflareIp) return cloudflareIp.trim();
  const trueClientIp = getHeader(req, 'true-client-ip');
  if (trueClientIp) return trueClientIp.trim();
  const forwarded = getHeader(req, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return (
    getHeader(req, 'x-real-ip') ||
    req?.socket?.remoteAddress ||
    req?.connection?.remoteAddress ||
    ''
  );
}

export function hashIp(ip) {
  if (!ip) return '';
  return crypto.createHash('sha256').update(`${AUDIT_IP_HASH_SALT}:${ip}`).digest('hex');
}

export function resolveAuditSession(req, res) {
  const cookies = parseCookies(getHeader(req, 'cookie'));
  const existing = typeof cookies[SESSION_COOKIE] === 'string' ? cookies[SESSION_COOKIE] : '';
  const sessionId = existing || crypto.randomUUID();

  if (!existing && res && !res.headersSent) {
    const forwardedProto = getHeader(req, 'x-forwarded-proto');
    const secure = forwardedProto === 'https' || Boolean(process.env.VERCEL);
    const cookie = [
      `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
      `Max-Age=${SESSION_MAX_AGE}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      secure ? 'Secure' : ''
    ]
      .filter(Boolean)
      .join('; ');
    const current = res.getHeader('Set-Cookie');
    const next = Array.isArray(current) ? [...current, cookie] : current ? [current, cookie] : cookie;
    res.setHeader('Set-Cookie', next);
  }

  return sessionId;
}

export function getBodySize(body) {
  if (body == null) return 0;
  if (typeof body === 'string') return Buffer.byteLength(body, 'utf8');
  try {
    return Buffer.byteLength(JSON.stringify(body), 'utf8');
  } catch {
    return 0;
  }
}

function detectDevice(userAgent) {
  const ua = userAgent || '';
  const lower = ua.toLowerCase();
  const deviceType =
    lower.includes('iphone') || (lower.includes('android') && lower.includes('mobile'))
      ? 'mobile'
      : lower.includes('ipad') || lower.includes('tablet')
        ? 'tablet'
        : ua
          ? 'desktop'
          : 'unknown';

  const browser = lower.includes('edg/')
    ? 'Edge'
    : lower.includes('chrome/') && !lower.includes('chromium')
      ? 'Chrome'
      : lower.includes('safari/') && !lower.includes('chrome/')
        ? 'Safari'
        : lower.includes('firefox/')
          ? 'Firefox'
          : ua
            ? 'Other'
            : 'unknown';

  const os = lower.includes('windows')
    ? 'Windows'
    : lower.includes('iphone') || lower.includes('ipad') || lower.includes('ios')
      ? 'iOS'
      : lower.includes('android')
        ? 'Android'
        : lower.includes('mac os x') || lower.includes('macintosh')
          ? 'macOS'
          : lower.includes('linux')
            ? 'Linux'
            : ua
              ? 'Other'
              : 'unknown';

  return { deviceType, browser, os };
}

export function buildAuditEvent(req, res, fields = {}) {
  const sourceIp = getClientIp(req);
  const userAgent = getHeader(req, 'user-agent');
  const device = detectDevice(userAgent);
  const userText = typeof fields.userText === 'string' ? fields.userText : '';

  return {
    request_id: crypto.randomUUID(),
    event_type: fields.eventType || 'unknown',
    occurred_at: Math.floor(Date.now() / 1000),
    source_ip: sourceIp,
    ip_hash: hashIp(sourceIp),
    user_agent: userAgent,
    device_type: device.deviceType,
    browser: device.browser,
    os: device.os,
    session_id: fields.sessionId || resolveAuditSession(req, res),
    path: fields.path || req?.url || '',
    method: req?.method || '',
    status: fields.status,
    content_length: Number.parseInt(getHeader(req, 'content-length'), 10) || getBodySize(req?.body),
    body_size: getBodySize(req?.body),
    text_length: userText.length,
    user_text: INCLUDE_USER_TEXT ? userText : undefined,
    route_tags: fields.routeTags || [],
    duration_ms: fields.durationMs,
    error_type: fields.errorType || undefined
  };
}

async function sendAuditLog(event) {
  if (!AUDIT_LOG_ENDPOINT || !AUDIT_LOG_TOKEN) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(AUDIT_LOG_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AUDIT_LOG_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event),
      signal: controller.signal
    });
    if (!response.ok) {
      console.warn(`[AUDIT] ingest failed: ${response.status}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err || 'unknown');
    console.warn(`[AUDIT] ingest error: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

export function scheduleAuditLog(event) {
  const task = sendAuditLog(event);
  if (process.env.VERCEL) {
    waitUntil(task);
    return;
  }
  void task;
}
