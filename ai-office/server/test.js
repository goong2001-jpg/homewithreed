'use strict';
// 파서 테스트: 가짜 claude 의 출력을 그대로 넣어 이벤트가 제대로 나오는지 확인한다.
const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const { OfficeEventParser } = require('./office-events');

const r = spawnSync(process.execPath, [path.join(__dirname, 'mock-claude.js')], { input: '# 사용자 지시\n\n테스트 지시\n', env: Object.assign({}, process.env, { MOCK_FAST: '1' }), encoding: 'utf8' });
assert.strictEqual(r.status, 0, 'mock exited ' + r.status + ' ' + r.stderr);
const p = new OfficeEventParser(['plan_lead', 'build_lead', 'researcher', 'planner', 'maker', 'reviewer']);
const events = p.feedChunk(r.stdout).concat(p.flush());
const types = events.map(e => e.type);
assert.ok(types.includes('init'), 'init');
const starts = events.filter(e => e.type === 'agent_start').map(e => e.agent);
const ends = events.filter(e => e.type === 'agent_end').map(e => e.agent);
assert.deepStrictEqual(starts, ['plan_lead', 'researcher', 'planner', 'maker', 'reviewer', 'maker', 'build_lead'], 'starts ' + starts);
assert.deepStrictEqual(ends.sort(), starts.slice().sort(), 'every start has an end');
const tools = events.filter(e => e.type === 'tool');
assert.ok(tools.some(e => e.agent === 'researcher' && e.tool === 'WebSearch'), 'subagent tool attributed by parent_tool_use_id');
assert.ok(!tools.some(e => e.agent === 'ceo' && (e.tool === 'Task')), 'Task is not reported as a plain tool');
const says = events.filter(e => e.type === 'say');
assert.ok(says.some(e => e.agent === 'ceo'), 'ceo says');
assert.ok(says.some(e => e.agent === 'plan_lead'), 'subagent says attributed');
const result = events.find(e => e.type === 'result');
assert.ok(result && result.ok && /## 결과/.test(result.text), 'result');
// 줄이 쪼개져 들어와도 동일해야 한다
const p2 = new OfficeEventParser(['plan_lead', 'researcher']);
let ev2 = [];
for (let i = 0; i < r.stdout.length; i += 7) ev2 = ev2.concat(p2.feedChunk(r.stdout.slice(i, i + 7)));
ev2 = ev2.concat(p2.flush());
assert.strictEqual(ev2.length, events.length, 'chunked parse matches');
console.log('ok -', events.length, 'events,', starts.length, 'tasks');
