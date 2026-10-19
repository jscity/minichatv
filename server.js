import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chatHandler from './api/chat.js';
import unlockHandler from './api/unlock.js';

const { PORT = 8787, OPENROUTER_API_KEY, OPENAI_API_KEY } = process.env;

if (!OPENROUTER_API_KEY && !OPENAI_API_KEY) {
  console.error('[FATAL] OPENROUTER_API_KEY (or legacy OPENAI_API_KEY) is required.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

const app = express();
app.use(express.json());
app.use(express.static(distDir));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.post('/api/chat', chatHandler);
app.post('/api/unlock', unlockHandler);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Mini Chat running: http://0.0.0.0:${PORT}`);
});
