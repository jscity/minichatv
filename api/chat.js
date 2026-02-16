import fs from 'node:fs';
import path from 'node:path';

const {
  MODEL = 'gemini-2.5-pro',
  SYSTEM_PROMPT = 'You are a concise assistant.',
  OPENAI_API_KEY
} = process.env;

const OPENAI_BASE_URL = 'https://generativelanguage.googleapis.com';

const effectiveSystemPrompt = (() => {
  try {
    const soulPath = path.join(process.cwd(), 'SOUL.md');
    return fs.readFileSync(soulPath, 'utf8').trim();
  } catch {
    return SYSTEM_PROMPT;
  }
})();

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
    const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const contents = rawHistory.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content || '' }]
    }));

    if (req.body?.text && typeof req.body.text === 'string') {
      const last = contents[contents.length - 1];
      const lastText = last?.parts?.[0]?.text || '';
      if (lastText !== req.body.text) {
        contents.push({
          role: 'user',
          parts: [{ text: req.body.text }]
        });
      }
    }

    const body = {
      contents,
      systemInstruction: { parts: [{ text: effectiveSystemPrompt }] }
    };

    const apiPath = `/v1beta/models/${MODEL}:streamGenerateContent`;
    const url = `${OPENAI_BASE_URL}${apiPath}?key=${OPENAI_API_KEY}&alt=sse`;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

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
            model: MODEL,
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
