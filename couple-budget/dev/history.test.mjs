// 이력 자동 기록 테스트.  실행: node --test couple-budget/dev/history.test.mjs
// 진짜 git 저장소를 임시 폴더에 만들어서 기록·중복 방지·따라잡기를 확인한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  END, START, buildEntry, cleanBody, describe, insertEntries, kst,
  parseVersion, recordedShas, stripVersion,
} from './history.mjs';
import { run } from './changelog.mjs';
import { versionInfo } from './version-json.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const EMPTY = `# 변경 이력\n\n${START}\n${END}\n\n## 이전 이력\n`;

// ------------------------------------------------------------ 순수 함수

test('버전을 제목 첫머리에서 읽는다', () => {
  assert.equal(parseVersion('v16: 인수인계 문서 추가 (#60)'), 16);
  assert.equal(parseVersion('V7：전각 콜론도'), 7);
  assert.equal(parseVersion('신의 마을 v8: 다른 앱 스타일'), 8);
  assert.equal(parseVersion('경조사·용돈 장부 탭 추가 (#32)'), null);
  assert.equal(parseVersion('v2 없음 콜론 없음'), null);
});

test('제목에서 버전 머리를 뗀다', () => {
  assert.equal(stripVersion('v16: 인수인계 (#60)'), '인수인계 (#60)');
  assert.equal(stripVersion('버전 없는 제목'), '버전 없는 제목');
});

test('UTC 시각을 한국 시간으로 바꾼다', () => {
  assert.equal(kst('2026-11-12T06:30:00Z'), '2026-11-12 15:30');
  assert.equal(kst('2026-11-12T20:05:00+00:00'), '2026-11-13 05:05');   // 날짜가 넘어간다
});

test('본문에서 꼬리표·생성 문구를 빼고 제목줄은 굵게 바꾼다', () => {
  const body = [
    '## 무엇을',
    '- 하나',
    '- 둘',
    '',
    '',
    '',
    '🤖 Generated with [Claude Code](https://claude.com/claude-code)',
    '',
    'https://claude.ai/code/session_01ABC',
    'Co-Authored-By: Claude <noreply@anthropic.com>',
    'Claude-Session: https://claude.ai/code/session_01ABC',
  ].join('\n');
  assert.equal(cleanBody(body), '**무엇을**\n- 하나\n- 둘');
});

test('본문이 기록 표시를 흉내 내도 중복 검사를 속이지 못한다', () => {
  const body = `<!-- sha:${SHA_A} -->`;
  const cleaned = cleanBody(body);
  assert.ok(!cleaned.includes('<!--'));
  assert.equal(recordedShas(cleaned).size, 0);
});

test('병합 커밋은 PR 제목(본문 첫 줄)을 제목으로 쓴다', () => {
  const d = describe({
    sha: SHA_A, iso: '2026-10-23T00:00:00Z',
    subject: 'Merge pull request #46 from goong2001-jpg/fix',
    body: 'v15: 예산 경고 추가\n\n- 하나\n',
  });
  assert.equal(d.title, 'v15: 예산 경고 추가');
  assert.equal(d.version, 15);
  assert.match(d.body, /- 하나/);
  assert.match(d.body, /Merge pull request #46/);
});

test('항목에는 버전·한국시간·해시·본문·기록표시가 들어간다', () => {
  const e = buildEntry(
    { sha: SHA_A, iso: '2026-11-12T06:30:00Z', subject: 'v16: 인수인계 (#60)', body: '- 문서\n' },
    { repoUrl: 'https://github.com/o/r' },
  );
  assert.match(e, /^### v16 — 인수인계 \(#60\)$/m);
  assert.match(e, /`2026-11-12 15:30 KST`/);
  assert.match(e, /\[`aaaaaaa`\]\(https:\/\/github\.com\/o\/r\/commit\/a{40}\)/);
  assert.match(e, /^- 문서$/m);
  assert.ok(e.includes(`<!-- sha:${SHA_A} -->`));
});

test('버전이 없는 커밋도 기록은 된다', () => {
  const e = buildEntry({ sha: SHA_A, iso: '2026-01-01T00:00:00Z', subject: '옛 방식 제목', body: '' });
  assert.match(e, /^### 버전 없음 — 옛 방식 제목$/m);
});

test('새 항목은 자동 영역 맨 위로 들어가고, 최신이 위에 온다', () => {
  const out = insertEntries(EMPTY, ['### 첫째\n', '### 둘째\n']);
  const a = out.indexOf('### 둘째');
  const b = out.indexOf('### 첫째');
  assert.ok(out.indexOf(START) < a && a < b && b < out.indexOf(END));
  assert.ok(out.endsWith('## 이전 이력\n'));   // 자동 영역 밖은 그대로
});

test('표시가 없는 파일에는 쓰지 않는다', () => {
  assert.throws(() => insertEntries('# 아무 파일\n', ['### x']), /AUTO-CHANGELOG/);
});

test('기록된 해시를 자동·수동 영역 가리지 않고 모은다', () => {
  const text = `${START}\n<!-- sha:${SHA_A} -->\n${END}\n| v1 | ... |\n<!-- sha:${SHA_B} -->`;
  assert.deepEqual([...recordedShas(text)].sort(), [SHA_A, SHA_B]);
});

// ------------------------------------------------------------ 진짜 git 저장소

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'cb-history-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, env: ENV, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'main');
  g('config', 'commit.gpgsign', 'false');
  mkdirSync(join(dir, 'couple-budget'));
  mkdirSync(join(dir, 'other-app'));
  writeFileSync(join(dir, 'couple-budget', 'CHANGELOG.md'), EMPTY);
  // CHANGELOG 만 있는 커밋은 기록 대상이 아니므로 앱 파일도 같이 넣는다
  writeFileSync(join(dir, 'couple-budget', 'a.txt'), '0');
  g('add', '.');
  g('commit', '-q', '-m', 'v1: 처음');
  const commit = (path, content, msg) => {
    writeFileSync(join(dir, path), content);
    g('add', '.');
    g('commit', '-q', '-m', msg);
    return g('rev-parse', 'HEAD');
  };
  const log = () => readFileSync(join(dir, 'couple-budget', 'CHANGELOG.md'), 'utf8');
  return { dir, g, commit, log, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('이 앱을 바꾼 커밋만, 최신이 위로 기록된다', () => {
  const r = repo();
  try {
    r.commit('couple-budget/a.txt', '1', 'v2: 지출 수정\n\n- 금액 고치기\n\nCo-Authored-By: X <x@x>');
    r.commit('other-app/x.txt', '1', '다른 앱 변경');
    r.commit('couple-budget/a.txt', '2', 'v3: 경조사 탭');
    const added = run({ cwd: r.dir });
    assert.deepEqual(added.map(i => i.subject), ['v1: 처음', 'v2: 지출 수정', 'v3: 경조사 탭']);
    const text = r.log();
    assert.ok(text.indexOf('### v3') < text.indexOf('### v2'));
    assert.ok(text.indexOf('### v2') < text.indexOf('### v1'));
    assert.ok(!text.includes('다른 앱 변경'));
    assert.ok(!text.includes('Co-Authored-By'));
  } finally { r.done(); }
});

test('몇 번을 돌려도 같은 커밋은 한 번만 기록된다', () => {
  const r = repo();
  try {
    r.commit('couple-budget/a.txt', '1', 'v2: 하나');
    run({ cwd: r.dir });
    const once = r.log();
    assert.deepEqual(run({ cwd: r.dir }), []);
    assert.equal(r.log(), once);
  } finally { r.done(); }
});

test('CHANGELOG 만 바꾼 커밋(자동 기록 커밋)은 다시 기록되지 않는다', () => {
  const r = repo();
  try {
    run({ cwd: r.dir });
    r.g('add', '.');
    r.g('commit', '-q', '-m', 'couple-budget: CHANGELOG 자동 기록 [skip ci]');
    assert.deepEqual(run({ cwd: r.dir }), []);
    assert.ok(!r.log().includes('자동 기록'));
  } finally { r.done(); }
});

test('배포된 커밋까지만 기록하고, 다음 배포 때 빠진 것을 따라잡는다', () => {
  const r = repo();
  try {
    const v2 = r.commit('couple-budget/a.txt', '1', 'v2: 둘');
    r.commit('couple-budget/a.txt', '2', 'v3: 셋');
    assert.deepEqual(run({ cwd: r.dir, upto: v2 }).map(i => i.subject), ['v1: 처음', 'v2: 둘']);
    assert.ok(!r.log().includes('v3'));
    // 기록 단계가 한 번 실패·취소됐다고 치고, 다음 배포가 와도 v3 가 빠지지 않는다
    r.commit('other-app/x.txt', '1', '다른 앱 배포');
    assert.deepEqual(run({ cwd: r.dir }).map(i => i.subject), ['v3: 셋']);
  } finally { r.done(); }
});

test('병합 커밋으로 들어온 PR 은 한 줄로 기록되고 안의 작업 커밋은 따로 안 남는다', () => {
  const r = repo();
  try {
    run({ cwd: r.dir });
    r.g('checkout', '-q', '-b', 'feature');
    r.commit('couple-budget/a.txt', '1', 'wip 1');
    r.commit('couple-budget/a.txt', '2', 'wip 2');
    r.g('checkout', '-q', 'main');
    r.g('merge', '-q', '--no-ff', 'feature', '-m', 'Merge pull request #46 from x/feature\n\nv4: 예산 경고\n\n- 막대');
    const added = run({ cwd: r.dir });
    assert.equal(added.length, 1);
    const text = r.log();
    assert.match(text, /^### v4 — 예산 경고$/m);
    assert.ok(!text.includes('wip 1'));
  } finally { r.done(); }
});

test('미리보기(--dry-run)는 파일을 바꾸지 않는다', () => {
  const r = repo();
  try {
    const before = r.log();
    assert.equal(run({ cwd: r.dir, dryRun: true }).length, 1);
    assert.equal(r.log(), before);
  } finally { r.done(); }
});

test('version.json 은 이 앱을 마지막으로 바꾼 커밋의 버전을 알려준다', () => {
  const r = repo();
  try {
    const v2 = r.commit('couple-budget/a.txt', '1', 'v2: 앱 변경');
    const other = r.commit('other-app/x.txt', '1', '다른 앱 변경');
    const info = versionInfo({ cwd: r.dir, now: new Date('2026-11-12T06:30:00Z'), deployed: '' });
    assert.equal(info.version, 'v2');
    assert.equal(info.title, '앱 변경');
    assert.equal(info.commit, v2);
    assert.equal(info.deployedCommit, other);       // 배포를 일으킨 건 다른 앱 커밋
    assert.equal(info.builtAtKst, '2026-11-12 15:30');
  } finally { r.done(); }
});
