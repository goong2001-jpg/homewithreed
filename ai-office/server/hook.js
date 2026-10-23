'use strict';
// Claude Code 훅. stdin 으로 받은 JSON 을 브리지 서버에 그대로 전달하고 바로 끝난다.
// 서버가 꺼져 있어도 Claude Code 작업을 막지 않도록 모든 오류를 삼킨다.
const http = require('http');
const url = process.env.AI_OFFICE_URL || 'http://127.0.0.1:7777';
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { data += c; });
process.stdin.on('end', () => {
  let body;
  try { body = JSON.parse(data || '{}'); } catch (e) { body = { raw: data }; }
  body.__job = process.env.AI_OFFICE_JOB || null;
  const u = new URL('/api/hook', url);
  const payload = JSON.stringify(body);
  const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }, timeout: 1500 },
    res => { res.resume(); res.on('end', () => process.exit(0)); });
  req.on('error', () => process.exit(0));
  req.on('timeout', () => { req.destroy(); process.exit(0); });
  req.end(payload);
});
setTimeout(() => process.exit(0), 3000).unref();
