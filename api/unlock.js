import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(API_DIR, '..');
const PASSCODE_PATH = path.join(PROJECT_ROOT, 'PASSCODE.md');

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

function extractPasscodeFromMarkdown(content) {
  const direct = content.match(/passcode\s*[:：]\s*([^\s`]+)/i);
  if (direct?.[1]) return direct[1].trim();

  const inline = content.match(/`([^`\s]{2,64})`/);
  if (inline?.[1]) return inline[1].trim();

  const block = content.match(/```(?:text|txt|md)?\s*([\s\S]*?)```/i);
  if (block?.[1]) {
    const first = block[1]
      .split('\n')
      .map((line) => line.trim())
      .find((line) => Boolean(line && !line.startsWith('#')));
    if (first) return first;
  }

  const fallbackLine = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => Boolean(line && !line.startsWith('#') && !line.startsWith('-')));
  return fallbackLine || '';
}

function readPasscode() {
  try {
    const content = fs.readFileSync(PASSCODE_PATH, 'utf8');
    const parsed = extractPasscodeFromMarkdown(content);
    if (parsed) return parsed;
  } catch {
    // fall through
  }
  return '8086';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const payload = parseJsonMaybe(req.body);
  const submitted = typeof payload?.password === 'string' ? payload.password.trim() : '';
  const expected = readPasscode();

  if (!submitted || submitted !== expected) {
    return res.status(401).json({ ok: false, error: 'Invalid passcode' });
  }

  return res.status(200).json({ ok: true });
}
