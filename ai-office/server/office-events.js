'use strict';
// Claude Code `--output-format stream-json` 한 줄씩을 받아 사무실 화면용 이벤트로 바꾼다.
// 이벤트 종류:
//  say        {agent, text}            누가 말했다(말풍선 + 실황 로그)
//  tool       {agent, tool, detail}    누가 어떤 도구를 쓰기 시작했다
//  agent_start{agent, taskId, description}  총괄이 직원에게 일을 줬다
//  agent_end  {agent, taskId, ok}      직원이 보고하고 자리로 돌아간다
//  result     {text, ok, cost, duration, turns, sessionId}
//  error      {message}

const SUBAGENT_TOOLS = new Set(['Task', 'Agent']);

class OfficeEventParser {
  constructor(knownAgents) {
    this.known = new Set(knownAgents || []);
    this.taskAgent = new Map();   // tool_use_id -> agent id
    this.sessionId = null;
    this.buf = '';
  }

  feedChunk(chunk) {
    this.buf += chunk;
    const out = [];
    let i;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i).trim();
      this.buf = this.buf.slice(i + 1);
      if (line) out.push(...this.feedLine(line));
    }
    return out;
  }

  flush() {
    const line = this.buf.trim(); this.buf = '';
    return line ? this.feedLine(line) : [];
  }

  feedLine(line) {
    let msg;
    try { msg = JSON.parse(line); } catch (e) { return [{ type: 'raw', text: line }]; }
    return this.feed(msg);
  }

  agentFor(msg) {
    const p = msg.parent_tool_use_id;
    if (p && this.taskAgent.has(p)) return this.taskAgent.get(p);
    return 'ceo';
  }

  feed(msg) {
    const ev = [];
    if (!msg || typeof msg !== 'object') return ev;
    if (msg.session_id && !this.sessionId) this.sessionId = msg.session_id;

    if (msg.type === 'system' && msg.subtype === 'init') {
      ev.push({ type: 'init', sessionId: msg.session_id, model: msg.model, agents: msg.agents });
      return ev;
    }

    if (msg.type === 'assistant' && msg.message && Array.isArray(msg.message.content)) {
      const who = this.agentFor(msg);
      for (const block of msg.message.content) {
        if (block.type === 'text' && block.text && block.text.trim()) {
          ev.push({ type: 'say', agent: who, text: block.text.trim() });
        } else if (block.type === 'tool_use') {
          const input = block.input || {};
          if (SUBAGENT_TOOLS.has(block.name) && who === 'ceo') {
            const target = pickAgent(input.subagent_type, this.known);
            this.taskAgent.set(block.id, target);
            ev.push({ type: 'agent_start', agent: target, taskId: block.id,
              description: String(input.description || '').slice(0, 80),
              brief: String(input.prompt || '').slice(0, 400) });
          } else {
            ev.push({ type: 'tool', agent: who, tool: block.name, detail: toolDetail(block.name, input) });
          }
        }
      }
      return ev;
    }

    if (msg.type === 'user' && msg.message && Array.isArray(msg.message.content)) {
      for (const block of msg.message.content) {
        if (block.type === 'tool_result' && this.taskAgent.has(block.tool_use_id) && !msg.parent_tool_use_id) {
          const agent = this.taskAgent.get(block.tool_use_id);
          ev.push({ type: 'agent_end', agent, taskId: block.tool_use_id, ok: !block.is_error,
            summary: textOf(block.content).slice(0, 600) });
        }
      }
      return ev;
    }

    if (msg.type === 'result') {
      ev.push({ type: 'result', ok: msg.subtype === 'success' && !msg.is_error,
        text: msg.result || (msg.is_error ? '오류로 끝났습니다.' : ''),
        cost: msg.total_cost_usd, duration: msg.duration_ms, turns: msg.num_turns,
        sessionId: msg.session_id || this.sessionId, subtype: msg.subtype });
      return ev;
    }
    return ev;
  }
}

function pickAgent(type, known) {
  if (!type) return 'unknown';
  const t = String(type).trim();
  if (known.has(t)) return t;
  const lower = t.toLowerCase();
  for (const k of known) if (k.toLowerCase() === lower) return k;
  return t; // 모르는 직원이면 그 이름 그대로(화면에서는 임시 직원으로 표시)
}

function textOf(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(c => (c && c.type === 'text') ? c.text : '').join('\n');
  return '';
}

function toolDetail(name, input) {
  input = input || {};
  const short = s => String(s || '').replace(/\s+/g, ' ').slice(0, 70);
  switch (name) {
    case 'Read': return short(input.file_path);
    case 'Write': return short(input.file_path);
    case 'Edit': case 'MultiEdit': return short(input.file_path);
    case 'Glob': return short(input.pattern);
    case 'Grep': return short(input.pattern);
    case 'WebSearch': return short(input.query);
    case 'WebFetch': return short(input.url);
    case 'Bash': return short(input.description || input.command);
    case 'TodoWrite': return (input.todos || []).length + '개 할 일';
    default: return short(JSON.stringify(input));
  }
}

module.exports = { OfficeEventParser };
