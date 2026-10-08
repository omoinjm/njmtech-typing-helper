// Minimal static server for fixture pages (content scripts don't run on file:// by default).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';

const root = join(import.meta.dirname, '../fixtures');
createServer(async (req, res) => {
  const path = normalize(new URL(req.url, 'http://x').pathname).replace(/^(\.\.[/\\])+/, '');
  let body;
  try {
    body = await readFile(join(root, path));
  } catch {
    return res.writeHead(404).end('not found');
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
}).listen(Number(process.env.PORT ?? 4599));
