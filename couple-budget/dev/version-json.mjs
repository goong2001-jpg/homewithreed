#!/usr/bin/env node
// 배포 폴더에 version.json 을 쓴다 → 배포된 앱이 어느 버전인지 주소 하나로 확인할 수 있다.
//
//   node couple-budget/dev/version-json.mjs --out couple-budget/build/version.json
//
// 앱 코드는 건드리지 않는다. 빌드가 끝난 뒤 결과물 폴더에 파일 하나를 더할 뿐이다.
// 확인: https://goong2001-jpg.github.io/homewithreed/couple-budget/version.json

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { APP_DIR, describe, git, kst, latestAppCommit, stripVersion } from './history.mjs';

export function versionInfo({ cwd, now = new Date(), deployed = process.env.GITHUB_SHA } = {}) {
  const root = git(['rev-parse', '--show-toplevel'], cwd).trim();
  const head = git(['rev-parse', 'HEAD'], root).trim();
  const c = latestAppCommit(root);
  const d = c ? describe(c) : null;
  return {
    app: APP_DIR,
    version: d?.version != null ? `v${d.version}` : null,
    title: d ? stripVersion(d.title) : null,
    // 이 앱을 마지막으로 바꾼 커밋 — 다른 앱 때문에 다시 배포돼도 이 값은 그대로다
    commit: c?.sha ?? null,
    committedAtKst: c ? kst(c.iso) : null,
    // 이번 배포를 일으킨 커밋 (저장소 전체 기준)
    deployedCommit: deployed || head,
    builtAtKst: kst(now.toISOString()),
  };
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const i = process.argv.indexOf('--out');
  const info = versionInfo({ cwd: process.cwd() });
  const json = `${JSON.stringify(info, null, 2)}\n`;
  if (i >= 0 && process.argv[i + 1]) writeFileSync(process.argv[i + 1], json);
  process.stdout.write(json);
}
