import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || '4318';
const url = `http://127.0.0.1:${port}`;
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: here, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(Error(`${command}: 종료 코드 ${code}`)),
    );
  });
}
async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
async function modified(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  return Math.max(
    0,
    ...(await Promise.all(
      files.map(async (f) =>
        f.isDirectory()
          ? modified(path.join(dir, f.name))
          : (await fs.stat(path.join(dir, f.name))).mtimeMs,
      ),
    )),
  );
}
function openBrowser() {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  spawn(command, [url], { stdio: 'ignore' }).on('error', () =>
    console.log(`브라우저에서 ${url} 을 여세요.`),
  );
}
try {
  if (!(await exists(path.join(here, 'node_modules/.package-lock.json')))) {
    console.log('처음 실행하는 데 필요한 패키지를 설치합니다.');
    await run('npm', ['ci', '--no-audit', '--no-fund']);
  }
  const { chromium } = await import('playwright');
  if (!(await exists(chromium.executablePath()))) {
    console.log('PDF 출력용 Chromium을 설치합니다.');
    await run('npx', ['playwright', 'install', 'chromium']);
  }
  const built = await fs.stat(path.join(here, 'dist/index.html')).catch(() => null);
  const latest = Math.max(
    await modified(path.join(here, 'src')),
    await modified(path.join(here, 'public')),
    ...(await Promise.all(
      ['index.html', 'vite.config.js', 'package-lock.json'].map(
        async (f) => (await fs.stat(path.join(here, f))).mtimeMs,
      ),
    )),
  );
  if (!built || built.mtimeMs < latest) await run('npm', ['run', 'build']);
  const live = await fetch(url + '/api/config', { signal: AbortSignal.timeout(1200) })
    .then((r) => r.json())
    .catch(() => null);
  if (live?.app === 'career-studio-public') {
    openBrowser();
    console.log(`이미 실행 중입니다: ${url}`);
  } else {
    console.log('이 터미널을 닫으면 작업실도 종료됩니다. 종료: Control + C');
    const server = spawn(process.execPath, ['server.mjs'], {
      cwd: here,
      env: process.env,
      stdio: ['inherit', 'pipe', 'inherit'],
    });
    let opened = false;
    server.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      if (!opened) {
        opened = true;
        openBrowser();
      }
    });
    process.on('SIGINT', () => server.kill('SIGINT'));
    process.on('SIGTERM', () => server.kill('SIGTERM'));
    server.on('exit', (code) => {
      process.exitCode = code || 0;
    });
  }
} catch (error) {
  console.error('작업실을 시작하지 못했습니다:', error.message);
  process.exitCode = 1;
}
