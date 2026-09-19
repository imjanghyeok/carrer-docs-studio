import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { atomic } from '../storage/files.mjs';
import { fail } from '../shared/errors.mjs';

function printHtml(html, base) {
  // Iframe and print renderer both enforce CSP: authored content cannot execute scripts.
  html = html.replace(/<base\b[^>]*>/gi, '');
  return html
    .replace(/<head[^>]*>/i, `$&<base href="${base}">`)
    .replace(
      /<\/head>/i,
      `<style data-studio-print>[data-excluded="true"]{display:none!important} [data-studio-selected]{outline:none!important} .page:last-of-type{break-after:auto;page-break-after:auto} @media print{html,body{background:white!important}.page{box-shadow:none!important;margin:0 auto!important}}</style></head>`,
    );
}

/** Owns Chromium and short-lived render sessions. */
export function createPdfExporter({ port, outputs }) {
  let browser;
  const renders = new Map();
  async function exportDocument(doc, state) {
    const renderId = randomUUID();
    renders.set(renderId, printHtml(state.html, state.base));
    browser ||= await chromium.launch();
    const context = await browser.newContext();
    try {
      await context.route('**/*', (route) => {
        const u = route.request().url();
        return u.startsWith(`http://127.0.0.1:${port}/`) || u.startsWith('data:')
          ? route.continue()
          : route.abort();
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${port}/render/${renderId}`, {
        waitUntil: 'networkidle',
      });
      await page
        .locator('[data-excluded="true"]')
        .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
      await page.locator('.page').evaluateAll((nodes) => {
        const last = nodes.at(-1);
        if (last) {
          last.style.breakAfter = 'auto';
          last.style.pageBreakAfter = 'auto';
        }
      });
      // eslint-disable-next-line no-undef -- Runs in Chromium, not in Node.
      await page.evaluate(() => document.fonts.ready);
      const broken = await page
        .locator('img')
        .evaluateAll((imgs) =>
          imgs
            .filter((i) => !i.closest('[data-excluded="true"]') && (!i.complete || !i.naturalWidth))
            .map((i) => i.getAttribute('src')),
        );
      if (broken.length) fail('이미지 경로를 찾을 수 없습니다: ' + broken.join(', '));
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      await atomic(path.join(outputs, doc.id + '.pdf'), pdf);
      return {
        url: '/exports/' + doc.id + '.pdf',
        path: 'exports/' + doc.id + '.pdf',
      };
    } finally {
      await context.close();
      renders.delete(renderId);
    }
  }
  return { exportDocument, renders, close: () => browser?.close() };
}
