#!/usr/bin/env node
// 배포된 커밋까지의 이 앱 변경을 CHANGELOG.md 자동 영역에 채워 넣는다.
//
//   node couple-budget/dev/changelog.mjs [--upto <커밋>] [--dry-run]
//
// - 이미 기록된 커밋(<!-- sha:… --> 표시)은 건너뛴다 → 몇 번을 돌려도 중복이 생기지 않는다.
// - 직전 배포에서 기록이 실패·취소됐어도 다음 배포 때 빠진 것까지 따라잡는다.
// - 파일만 고친다. 커밋·푸시는 record-changelog.sh 가 한다.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  APP_DIR, appCommits, buildEntry, commitInfo, git, insertEntries, recordedShas,
} from './history.mjs';

export function run({ cwd, upto = 'HEAD', dryRun = false, repoUrl, limit = 50 } = {}) {
  const root = git(['rev-parse', '--show-toplevel'], cwd).trim();
  const file = join(root, APP_DIR, 'CHANGELOG.md');
  const text = readFileSync(file, 'utf8');
  const seen = recordedShas(text);

  // 최신순으로 받아서 → 아직 없는 것만 → 오래된 것부터 넣는다
  const missing = appCommits(root, { upto, limit }).filter(sha => !seen.has(sha)).reverse();
  const infos = missing.map(sha => commitInfo(root, sha));
  if (infos.length && !dryRun) {
    writeFileSync(file, insertEntries(text, infos.map(i => buildEntry(i, { repoUrl }))));
  }
  return infos;
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const opt = name => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const repoUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
    : undefined;
  try {
    const added = run({
      cwd: process.cwd(),
      upto: opt('--upto') ?? 'HEAD',
      dryRun: args.includes('--dry-run'),
      repoUrl,
    });
    if (!added.length) console.log('새로 기록할 커밋이 없습니다.');
    for (const i of added) console.log(`기록${args.includes('--dry-run') ? '(예정)' : ''}: ${i.sha.slice(0, 7)} ${i.subject}`);
  } catch (e) {
    console.error(`CHANGELOG 기록 실패: ${e.message}`);
    process.exit(1);
  }
}
