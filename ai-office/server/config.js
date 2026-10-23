'use strict';
// 설정 읽기. config.json 이 없으면 config.example.json 의 기본값을 쓴다.
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function load() {
  const example = readJson(path.join(ROOT, 'config.example.json')) || {};
  const user = readJson(path.join(ROOT, 'config.json')) || {};
  const cfg = Object.assign({}, example, user);
  cfg.accounts = (user.accounts && user.accounts.length ? user.accounts : example.accounts) || [];

  cfg.port = Number(process.env.AI_OFFICE_PORT || cfg.port || 7777);
  cfg.host = process.env.AI_OFFICE_HOST || cfg.host || '0.0.0.0';
  cfg.pin = String(process.env.AI_OFFICE_PIN || cfg.pin || '');
  cfg.workspace = path.resolve(expandHome(process.env.AI_OFFICE_WORKSPACE || cfg.workspace || path.join(ROOT, 'workspace')));
  cfg.dataDir = path.resolve(expandHome(cfg.dataDir || path.join(ROOT, 'data')));
  cfg.claudeCommand = process.env.AI_OFFICE_CLAUDE || cfg.claudeCommand || 'claude';
  cfg.claudeArgsPrefix = cfg.claudeArgsPrefix || [];
  cfg.permissionMode = cfg.permissionMode || 'acceptEdits';
  cfg.allowedTools = cfg.allowedTools || ['Agent', 'Task', 'Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'TodoWrite'];
  cfg.allowBash = !!cfg.allowBash;
  cfg.skipPermissions = !!cfg.skipPermissions;
  cfg.model = cfg.model || '';
  cfg.hooks = cfg.hooks !== false;
  cfg.mock = process.env.AI_OFFICE_MOCK === '1' || !!cfg.mock;

  cfg.accounts = cfg.accounts.map(a => ({
    id: a.id, name: a.name || a.id,
    configDir: a.configDir ? path.resolve(expandHome(a.configDir)) : path.join(os.homedir(), '.claude-office-' + a.id),
  }));
  if (!cfg.accounts.length) cfg.accounts = [{ id: 'default', name: '기본 계정 (Claude Code 로그인)', configDir: '' }];
  return cfg;
}

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

module.exports = { load, ROOT };
