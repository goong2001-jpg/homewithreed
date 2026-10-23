'use strict';
// 작업 하나 = claude -p 프로세스 하나. 프롬프트는 stdin 으로 넘긴다(Windows 셸 따옴표 문제 회피).
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { OfficeEventParser } = require('./office-events');
const { ROOT } = require('./config');

const IS_WIN = process.platform === 'win32';

class ClaudeRunner extends EventEmitter {
  constructor(cfg, org) {
    super();
    this.cfg = cfg;
    this.org = org;
    this.proc = null;
    this.parser = null;
  }

  get running() { return !!this.proc; }

  // 작업 폴더에 직원 정의와 훅을 설치한다. 사용자의 다른 설정은 건드리지 않는다.
  installOffice(workspace) {
    const dotClaude = path.join(workspace, '.claude');
    const agentsDst = path.join(dotClaude, 'agents');
    fs.mkdirSync(agentsDst, { recursive: true });
    const agentsSrc = path.join(ROOT, 'office', 'agents');
    for (const f of fs.readdirSync(agentsSrc)) {
      if (f.endsWith('.md')) fs.copyFileSync(path.join(agentsSrc, f), path.join(agentsDst, f));
    }
    fs.mkdirSync(path.join(workspace, 'output'), { recursive: true });

    if (this.cfg.hooks) {
      const settingsPath = path.join(dotClaude, 'settings.local.json');
      let settings = {};
      try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {}; } catch (e) { settings = {}; }
      const hookJs = path.join(ROOT, 'server', 'hook.js').replace(/\\/g, '/');
      const cmd = `node "${hookJs}"`;
      settings.hooks = settings.hooks || {};
      for (const ev of ['PreToolUse', 'PostToolUse', 'SubagentStop', 'Stop']) {
        const list = Array.isArray(settings.hooks[ev]) ? settings.hooks[ev] : [];
        const isMine = h => h && Array.isArray(h.hooks) && h.hooks.some(x => x && typeof x.command === 'string' && x.command.includes('/server/hook.js'));
        const others = list.filter(h => !isMine(h));
        settings.hooks[ev] = others.concat([{ hooks: [{ type: 'command', command: cmd, timeout: 5 }] }]);
      }
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }
  }

  buildArgs(job) {
    const cfg = this.cfg;
    const args = [...cfg.claudeArgsPrefix, '-p', '--verbose', '--output-format', 'stream-json'];
    if (cfg.skipPermissions) args.push('--dangerously-skip-permissions');
    else {
      args.push('--permission-mode', cfg.permissionMode);
      const tools = cfg.allowedTools.slice();
      if (cfg.allowBash && !tools.includes('Bash')) tools.push('Bash');
      args.push('--allowedTools', tools.join(','));
    }
    if (cfg.model) args.push('--model', cfg.model);
    if (job.resume) args.push('--resume', job.resume);
    return args;
  }

  buildPrompt(job) {
    const ceo = fs.readFileSync(path.join(ROOT, 'office', 'ceo.md'), 'utf8');
    const today = new Date().toISOString().slice(0, 10);
    if (job.resume) return `(이어서) ${job.text}`;
    return `${ceo}\n\n오늘 날짜: ${today}\n작업 폴더: ${this.cfg.workspace}\n\n---\n\n# 사용자 지시\n\n${job.text}\n`;
  }

  start(job, account) {
    if (this.proc) throw new Error('이미 실행 중');
    const cfg = this.cfg;
    fs.mkdirSync(cfg.workspace, { recursive: true });
    this.installOffice(cfg.workspace);

    const env = Object.assign({}, process.env, {
      AI_OFFICE_URL: `http://127.0.0.1:${cfg.port}`,
      AI_OFFICE_JOB: job.id,
    });
    if (account && account.configDir) env.CLAUDE_CONFIG_DIR = account.configDir;

    const args = this.buildArgs(job);
    const known = this.org.agents.map(a => a.id);
    this.parser = new OfficeEventParser(known);
    this.emit('event', { type: 'spawn', command: cfg.claudeCommand, args, account: account && account.id });

    let proc;
    const q = v => (IS_WIN && /\s/.test(v) && !/^".*"$/.test(v)) ? `"${v}"` : v;
    try {
      proc = spawn(q(cfg.claudeCommand), IS_WIN ? args.map(q) : args, { cwd: cfg.workspace, env, shell: IS_WIN, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      this.emit('event', { type: 'error', message: 'claude 실행 실패: ' + e.message });
      this.emit('done', { ok: false });
      return;
    }
    this.proc = proc;
    let stderr = '';

    proc.on('error', (e) => {
      const hint = e.code === 'ENOENT' ? ' (claude 명령을 못 찾았습니다. Claude Code 가 설치되어 있고 PATH 에 있는지 확인하세요)' : '';
      this.emit('event', { type: 'error', message: 'claude 실행 실패: ' + e.message + hint });
    });
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      for (const ev of this.parser.feedChunk(chunk)) this.emit('event', ev);
    });
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk) => { stderr += chunk; if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    proc.stdin.on('error', () => {});
    proc.stdin.end(this.buildPrompt(job), 'utf8');

    proc.on('close', (code, signal) => {
      for (const ev of this.parser.flush()) this.emit('event', ev);
      this.proc = null;
      if (code !== 0 && !this.stopped) {
        const tail = stderr.trim().split('\n').slice(-6).join('\n');
        this.emit('event', { type: 'error', message: `claude 가 비정상 종료 (code ${code}${signal ? ', ' + signal : ''})${tail ? '\n' + tail : ''}` });
      }
      this.emit('done', { ok: code === 0, code, stopped: !!this.stopped, sessionId: this.parser.sessionId });
      this.stopped = false;
    });
  }

  stop() {
    if (!this.proc) return false;
    this.stopped = true;
    const p = this.proc;
    if (IS_WIN) spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true });
    else { try { p.kill('SIGTERM'); } catch (e) {} setTimeout(() => { try { p.kill('SIGKILL'); } catch (e) {} }, 3000); }
    return true;
  }
}

module.exports = { ClaudeRunner };
