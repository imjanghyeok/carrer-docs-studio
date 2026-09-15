import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { AIService } from './ai-service.mjs';
import { CompanyStore } from './lib/company-store.mjs';
import { defaultDataDirectory } from './lib/paths.mjs';
import { createDocumentStore } from './server/storage/documents.mjs';
import { atomic } from './server/storage/files.mjs';
import { createQueue } from './server/storage/queue.mjs';
import { createPdfExporter } from './server/pdf/exporter.mjs';
import { createRequestHandler } from './server/http/router.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = defaultDataDirectory();
const port = Number(process.env.PORT || 4318);
const token = randomBytes(24).toString('hex');
const locked = createQueue();
const store = createDocumentStore({ data, templates: path.join(here, 'templates') });
const companies = new CompanyStore({ data, locked, atomic });
const { getDoc, load, save } = store;
const ai = new AIService({ data, getDoc, load, save, locked, atomic, materials: companies });
const outputs = path.join(data, 'exports');
const pdf = createPdfExporter({ port, outputs });
await fs.mkdir(data, { recursive: true, mode: 0o700 });
await fs.mkdir(outputs, { recursive: true, mode: 0o700 });

const server = http.createServer(
  createRequestHandler({ data, here, port, token, locked, store, companies, ai, pdf }),
);
server.listen(port, '127.0.0.1', () => console.log(`문서 작업실 http://127.0.0.1:${port}`));
async function close() {
  ai.close();
  await pdf.close();
  server.close(() => process.exit(0));
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
