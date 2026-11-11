/**
 * 변경 이력 자동 기록 — 배포가 성공하면 GitHub Actions(deploy-subtech.yml)가 실행합니다.
 * 이번 푸시에 들어온 커밋 중 subtech-inventory/ 를 바꾼 것을 CHANGELOG.md 맨 위(AUTO 표시 아래)에 추가합니다.
 *
 *   node subtech-inventory/dev/changelog.js <이전커밋> <새커밋>     (이전커밋이 0000… 이면 새커밋 하나만)
 *   DRY=1 node subtech-inventory/dev/changelog.js HEAD~3 HEAD     → 파일은 안 바꾸고 화면에만 출력
 *
 * 이미 적힌 커밋(짧은 해시)은 다시 적지 않습니다. CHANGELOG.md 는 손으로 고치지 않습니다.
 */
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, '..', 'CHANGELOG.md');
const MARK = '<!-- AUTO:START (이 줄 아래에 자동으로 추가됩니다 — 지우지 마세요) -->';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', env: Object.assign({}, process.env, { TZ: 'Asia/Seoul' }) });

let [before, after] = process.argv.slice(2);
after = after || 'HEAD';
let range;
try { if (before && !/^0+$/.test(before)) { git('cat-file', '-e', before + '^{commit}'); range = before + '..' + after; } } catch (e) { range = null; }
const shas = (range ? git('rev-list', '--reverse', range, '--', 'subtech-inventory')
                    : git('rev-list', '-1', after, '--', 'subtech-inventory')).split('\n').filter(Boolean);

const text = fs.readFileSync(FILE, 'utf8');
if (!text.includes(MARK)) throw new Error('CHANGELOG.md 에 AUTO 표시 줄이 없습니다');
const entries = [];
for (const sha of shas) {
  const short = sha.slice(0, 7);
  if (text.includes('`' + short + '`')) continue;                       // 이미 기록됨
  const files = git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean);
  if (files.every(f => f === 'subtech-inventory/CHANGELOG.md')) continue; // 이력 기록 커밋 자체는 제외
  const msg = git('log', '-1', '--format=%B', sha)
    .split('\n').filter(l => !/^(Co-Authored-By|Claude-Session|Signed-off-by):/i.test(l.trim())).join('\n').trim();
  const [subject, ...body] = msg.split('\n');
  const when = git('log', '-1', '--date=format-local:%Y-%m-%d %H:%M', '--format=%ad', sha).trim();
  let ver = '';
  try { ver = (git('show', sha + ':subtech-inventory/Code.gs').match(/APP_VERSION = '([^']+)'/) || [])[1] || ''; } catch (e) {}
  const lines = body.map(l => l.trimEnd()).filter(l => l.trim())
    .map(l => /^\s*[-*•]/.test(l) ? l.replace(/^\s*[*•]/, '-') : '  ' + l);
  entries.unshift(`### ${ver ? ver + ' · ' : ''}${when} · \`${short}\`\n**${subject.trim()}**${lines.length ? '\n' + lines.join('\n') : ''}\n`);
}
if (!entries.length) { console.log('새로 기록할 커밋 없음'); process.exit(0); }
const out = text.replace(MARK, MARK + '\n\n' + entries.join('\n'));
if (process.env.DRY) { console.log(entries.join('\n')); process.exit(0); }
fs.writeFileSync(FILE, out);
console.log('기록 ' + entries.length + '건');
