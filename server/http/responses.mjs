import fs from 'node:fs/promises';
import path from 'node:path';
import { fail } from '../shared/errors.mjs';

export async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 14_000_000) fail('요청이 너무 큽니다.', 413);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail('JSON 형식을 확인해 주세요.');
  }
}
export function reply(res, status, value, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(value));
}
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
};
export const frameCSP =
  "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; script-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'";
export async function sendFile(res, file, headers = {}) {
  const buffer = await fs.readFile(file);
  res.writeHead(200, {
    'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
    ...headers,
  });
  res.end(buffer);
}
