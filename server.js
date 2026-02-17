import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chatHandler from './api/chat.js';

const { PORT = 8787, OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
  console.error('[FATAL] OPENAI_API_KEY is required.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

const app = express();
app.use(express.json());
app.use(express.static(distDir));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.post('/api/chat', chatHandler);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Mini Chat running: http://0.0.0.0:${PORT}`);
});
