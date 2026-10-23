'use strict';
// 계정별 Claude Code 로그인. 예: npm run login -- main
const { spawn } = require('child_process');
const { load } = require('./config');
const cfg = load();
const id = process.argv[2] || (cfg.accounts[0] && cfg.accounts[0].id);
const acc = cfg.accounts.find(a => a.id === id);
if (!acc) {
  console.error('계정을 찾을 수 없습니다:', id, '\n설정된 계정:', cfg.accounts.map(a => a.id).join(', '));
  process.exit(1);
}
const env = Object.assign({}, process.env);
if (acc.configDir) env.CLAUDE_CONFIG_DIR = acc.configDir;
console.log(`[ai-office] "${acc.name}" 계정으로 Claude Code 를 엽니다.`);
console.log(`[ai-office] 설정 폴더: ${acc.configDir || '(Claude Code 기본)'}`);
console.log('[ai-office] 로그인 화면이 뜨면 브라우저에서 로그인하세요. 이미 로그인돼 있으면 /login 을 입력해 계정을 바꿀 수 있습니다. 끝나면 /exit 로 나옵니다.\n');
const cmd = (process.platform === 'win32' && /\s/.test(cfg.claudeCommand)) ? `"${cfg.claudeCommand}"` : cfg.claudeCommand;
const p = spawn(cmd, [], { stdio: 'inherit', env, shell: process.platform === 'win32' });
p.on('error', e => { console.error('claude 실행 실패:', e.message); process.exit(1); });
p.on('close', code => process.exit(code || 0));
