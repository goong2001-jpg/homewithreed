#!/usr/bin/env node
// 배포용 빌드(build/)를 실제 브라우저로 열어 기본 흐름이 도는지 본다.
//
//   npm run build && node dev/smoke.mjs            (couple-budget 폴더에서)
//   node dev/smoke.mjs --require                    playwright 가 없으면 실패로 친다
//
// 서버는 배포와 같은 경로(/homewithreed/couple-budget/)로 띄운다 — homepage 값이 틀리면 여기서 잡힌다.
// playwright 가 없으면 건너뛴다 (설치: npm i --no-save playwright && npx playwright install chromium)

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(APP, 'build');
const BASE = '/homewithreed/couple-budget/';
const MUST = process.argv.includes('--require');

function loadPlaywright() {
  const places = [
    APP, process.cwd(),
    ...(process.env.NODE_PATH ?? '').split(':').filter(Boolean),
    '/opt/node22/lib/node_modules', '/usr/local/lib/node_modules', '/usr/lib/node_modules',
  ];
  for (const p of places) {
    try { return createRequire(join(p, 'noop.js'))('playwright'); } catch {}
  }
  return null;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function serve() {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
      if (!url.startsWith(BASE)) { res.writeHead(404).end(); return; }
      let file = normalize(join(BUILD, url.slice(BASE.length)));
      if (!file.startsWith(BUILD)) { res.writeHead(403).end(); return; }
      if (!existsSync(file) || statSync(file).isDirectory()) file = join(BUILD, 'index.html');
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${extra ? `  (${extra})` : ''}`);
};

async function main() {
  if (!existsSync(join(BUILD, 'index.html'))) {
    console.error('build/ 가 없습니다. 먼저 npm run build 를 돌려주세요.');
    process.exit(1);
  }
  const pw = loadPlaywright();
  if (!pw) {
    console.log('  ⏭  playwright 가 없어 브라우저 점검을 건너뜁니다.');
    process.exit(MUST ? 1 : 0);
  }

  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}${BASE}`;
  const browser = await pw.chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    const text = () => page.textContent('body');

    await page.goto(url, { waitUntil: 'networkidle' });
    check('첫 화면이 뜬다 (수입 입력 안내)', /이 달 수입을 먼저 입력해주세요/.test(await text()));

    const tabs = await page.$$eval('nav button', bs => bs.map(b => b.textContent.replace(/\s+/g, '')));
    const want = ['저금통', '입력', '내역', 'TOP5', '경조사', '설정'];
    check('탭 6개', want.every((w, i) => tabs[i]?.endsWith(w)), tabs.join(','));

    for (const t of want) {
      await page.getByRole('button', { name: new RegExp(`${t}$`) }).last().click();
      await page.waitForTimeout(250);
    }
    check('탭을 모두 돌아도 오류가 없다', errors.length === 0, errors[0] ?? '');

    // 수입 → 하루 금액이 달력 일수로 나뉘어 나오는지
    await page.getByRole('button', { name: /저금통$/ }).click();
    await page.getByRole('button', { name: '수입 입력하러 가기' }).click();
    await page.fill('#income-amount', '3100000');
    await page.getByRole('button', { name: /더하기$/ }).click();
    await page.waitForTimeout(300);
    const expectDaily = await page.evaluate(() => {
      const n = new Date();
      const days = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
      return `${Math.floor(3100000 / days).toLocaleString('ko-KR')}원`;
    });
    check('수입을 넣으면 하루 금액이 나온다', (await text()).includes(expectDaily), expectDaily);

    // 지출 → 누적 지출에 반영
    await page.getByRole('button', { name: /입력$/ }).last().click();
    await page.fill('#amount', '12000');
    await page.getByRole('button', { name: /저장$/ }).click();
    await page.waitForTimeout(300);
    check('지출이 이달 누적 지출에 반영된다', /이달 누적 지출[\s\S]{0,40}12,000원/.test(await text()));

    await page.reload({ waitUntil: 'networkidle' });
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('couple_budget_expenses') || '[]').length);
    check('새로고침해도 기록이 남는다 (localStorage)', stored === 1, `${stored}건`);

    await page.getByRole('button', { name: /경조사$/ }).click();
    await page.waitForTimeout(250);
    check('경조사 탭이 열린다', /받은 돈 적기/.test(await text()));

    const wide = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    check('390px 폭에서 가로 스크롤이 없다', wide);

    check('전체 흐름에서 콘솔·페이지 오류가 없다', errors.length === 0, errors.join(' | '));

    const shot = join(tmpdir(), 'couple-budget-smoke.png');
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`  📸 ${shot}`);
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(results.every(Boolean) ? 0 : 1);
}

main().catch(e => { console.error(`  ❌ 스모크 테스트 중단: ${e.message}`); process.exit(1); });
