'use strict';
// AI 사무실 브리지 서버. 화면(public/)을 서빙하고, 명령을 받아 Claude Code 를 돌리고, 진행 이벤트를 SSE 로 흘려보낸다.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { load, ROOT } = require('./config');
const { ClaudeRunner } = require('./claude-runner');

const cfg = load();
if (process.argv.includes('--mock')) cfg.mock = true;
if (cfg.mock) { cfg.claudeCommand = process.execPath; cfg.claudeArgsPrefix = [path.join(ROOT, 'server', 'mock-claude.js')]; }

const org = JSON.parse(fs.readFileSync(path.join(ROOT, 'office', 'org.json'), 'utf8'));
const PUBLIC = path.join(ROOT, 'public');
fs.mkdirSync(cfg.dataDir, { recursive: true });
const HISTORY = path.join(cfg.dataDir, 'history.json');

const runner = new ClaudeRunner(cfg, org);
const clients = new Set();          // SSE 응답들
const queue = [];                   // 대기 중인 작업
let current = null;                 // 실행 중인 작업 {id, text, account, resume, startedAt, events: []}
let history = loadHistory();
let lastSessionId = history.length ? history[0].sessionId : null;

function loadHistory() { try { return JSON.parse(fs.readFileSync(HISTORY, 'utf8')); } catch (e) { return []; } }
function saveHistory() { try { fs.writeFileSync(HISTORY, JSON.stringify(history.slice(0, 50))); } catch (e) {} }

function broadcast(ev) {
  const line = `data: ${JSON.stringify(ev)}\n\n`;
  for (const res of clients) { try { res.write(line); } catch (e) {} }
}

function statusEvent() {
  return { type: 'status', running: !!current, current: current && { id: current.id, text: current.text, account: current.account, startedAt: current.startedAt },
    queue: queue.map(j => ({ id: j.id, text: j.text })), accounts: cfg.accounts.map(a => ({ id: a.id, name: a.name })),
    mock: cfg.mock, workspace: cfg.workspace, lastSessionId, hasPin: !!cfg.pin };
}

function pushEvent(ev) {
  ev.t = Date.now();
  if (current) { ev.job = current.id; current.events.push(ev); }
  broadcast(ev);
}

runner.on('event', (ev) => {
  if (ev.type === 'result') { if (ev.sessionId) { lastSessionId = ev.sessionId; if (current) current.sessionId = ev.sessionId; } if (current) current.result = ev.text; }
  pushEvent(ev);
});
runner.on('done', (info) => {
  if (current) {
    current.endedAt = Date.now();
    current.ok = info.ok && !info.stopped;
    current.stopped = info.stopped;
    if (!current.sessionId && info.sessionId) { current.sessionId = info.sessionId; lastSessionId = info.sessionId; }
    pushEvent({ type: 'job_end', ok: current.ok, stopped: !!info.stopped, id: current.id });
    history.unshift({ id: current.id, text: current.text, account: current.account, startedAt: current.startedAt, endedAt: current.endedAt,
      ok: current.ok, stopped: current.stopped, sessionId: current.sessionId, result: current.result || '', events: current.events.slice(-400) });
    history = history.slice(0, 50);
    saveHistory();
    current = null;
  }
  broadcast(statusEvent());
  setTimeout(next, 300);
});

function next() {
  if (current || !queue.length) return;
  const job = queue.shift();
  current = Object.assign(job, { startedAt: Date.now(), events: [] });
  const account = cfg.accounts.find(a => a.id === job.account) || cfg.accounts[0];
  if (job.mock) { cfg.claudeCommand = process.execPath; cfg.claudeArgsPrefix = [path.join(ROOT, 'server', 'mock-claude.js')]; }
  else if (!cfg.mock) { cfg.claudeCommand = cfg._realCommand; cfg.claudeArgsPrefix = cfg._realPrefix; }
  pushEvent({ type: 'job_start', id: job.id, text: job.text, account: account.id, demo: !!job.mock });
  broadcast(statusEvent());
  try { runner.start(job, account); } catch (e) { pushEvent({ type: 'error', message: e.message }); runner.emit('done', { ok: false }); }
}
cfg._realCommand = cfg.claudeCommand; cfg._realPrefix = cfg.claudeArgsPrefix;

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8' };

function send(res, code, body, type) {
  const buf = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { 'content-type': type || 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(buf);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = ''; req.setEncoding('utf8');
    req.on('data', c => { d += c; if (d.length > 1e6) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function pinOk(req, url) {
  if (!cfg.pin) return true;
  const given = req.headers['x-office-pin'] || url.searchParams.get('pin') || '';
  const a = Buffer.from(String(given)), b = Buffer.from(cfg.pin);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isLocal(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p.startsWith('/api/')) {
    if (p === '/api/hook') {
      if (!isLocal(req)) return send(res, 403, { error: 'local only' });
      try { handleHook(await readBody(req)); } catch (e) {}
      return send(res, 200, { ok: true });
    }
    if (!pinOk(req, url)) return send(res, 401, { error: 'PIN 이 틀립니다' });

    if (p === '/api/status') return send(res, 200, statusEvent());
    if (p === '/api/org') return send(res, 200, org);
    if (p === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
      res.write(':ok\n\n');
      clients.add(res);
      res.write(`data: ${JSON.stringify(statusEvent())}\n\n`);
      if (current) for (const ev of current.events) res.write(`data: ${JSON.stringify(ev)}\n\n`);
      const ping = setInterval(() => { try { res.write(':ping\n\n'); } catch (e) {} }, 25000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }
    if (p === '/api/history') return send(res, 200, history.map(h => ({ id: h.id, text: h.text, account: h.account, startedAt: h.startedAt, endedAt: h.endedAt, ok: h.ok, stopped: h.stopped, sessionId: h.sessionId, result: h.result })));
    if (p.startsWith('/api/history/')) { const h = history.find(x => x.id === p.slice(13)); return h ? send(res, 200, h) : send(res, 404, { error: 'not found' }); }
    if (p === '/api/command' && req.method === 'POST') {
      let body; try { body = await readBody(req); } catch (e) { return send(res, 400, { error: 'bad json' }); }
      const text = String(body.text || '').trim();
      if (!text) return send(res, 400, { error: '지시 내용이 비었습니다' });
      if (text.length > 20000) return send(res, 400, { error: '지시가 너무 깁니다' });
      const job = { id: Date.now().toString(36) + crypto.randomBytes(2).toString('hex'), text, account: body.account || null,
        resume: body.resume ? (lastSessionId || null) : null, mock: !!body.demo };
      queue.push(job);
      broadcast(statusEvent());
      next();
      return send(res, 200, { ok: true, id: job.id, queued: queue.length });
    }
    if (p === '/api/stop' && req.method === 'POST') {
      const id = url.searchParams.get('id');
      if (id) { const i = queue.findIndex(j => j.id === id); if (i >= 0) { queue.splice(i, 1); broadcast(statusEvent()); return send(res, 200, { ok: true }); } }
      const stopped = runner.stop();
      if (stopped) pushEvent({ type: 'say', agent: 'ceo', text: '사용자 요청으로 작업을 중지합니다.' });
      return send(res, 200, { ok: stopped });
    }
    return send(res, 404, { error: 'not found' });
  }

  // 정적 파일
  let file = p === '/' ? '/index.html' : decodeURIComponent(p);
  file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC)) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, data, MIME[path.extname(full)] || 'application/octet-stream');
  });
});

// 훅 이벤트: 서브에이전트 내부 도구 사용 등 stream-json 에 안 나오는 세부 동작을 보강한다.
function handleHook(h) {
  if (!current || !h || h.__job !== current.id) return;
  const name = h.hook_event_name;
  if (name === 'PreToolUse' && h.tool_name && !['Task', 'Agent'].includes(h.tool_name)) {
    const agent = h.agent_type || h.agent_id || null;
    pushEvent({ type: 'hook_tool', agent, tool: h.tool_name, detail: shortInput(h.tool_name, h.tool_input) });
  } else if (name === 'SubagentStop') {
    pushEvent({ type: 'hook_subagent_stop', agent: h.agent_type || h.agent_id || null });
  }
}
function shortInput(name, input) {
  input = input || {};
  const v = input.file_path || input.pattern || input.query || input.url || input.description || input.command || '';
  return String(v).replace(/\s+/g, ' ').slice(0, 70);
}

server.listen(cfg.port, cfg.host, () => {
  console.log(`[ai-office] http://localhost:${cfg.port}  (호스트 ${cfg.host})`);
  console.log(`[ai-office] 작업 폴더: ${cfg.workspace}`);
  console.log(`[ai-office] 계정: ${cfg.accounts.map(a => a.id).join(', ')}  PIN: ${cfg.pin ? '설정됨' : '없음(주의)'}`);
  if (cfg.mock) console.log('[ai-office] 모의(mock) 모드: 실제 Claude 대신 가짜 회사가 돕니다.');
});
