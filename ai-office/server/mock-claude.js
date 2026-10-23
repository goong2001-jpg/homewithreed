'use strict';
// 가짜 claude. stream-json 형식으로 회사가 일하는 장면을 흉내 낸다. 로그인·설정 전에 화면을 확인하는 용도.
const fast = process.env.MOCK_FAST === '1';
const wait = ms => new Promise(r => setTimeout(r, fast ? 5 : ms));
let prompt = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { prompt += c; });
process.stdin.on('end', run);
if (process.stdin.isTTY) run();

const sid = 'mock-' + Date.now().toString(36);
let n = 0;
const id = () => 'toolu_' + (++n).toString(36).padStart(4, '0');
const out = o => process.stdout.write(JSON.stringify(Object.assign({ session_id: sid }, o)) + '\n');
const text = (t, parent) => out({ type: 'assistant', parent_tool_use_id: parent || null, message: { role: 'assistant', content: [{ type: 'text', text: t }] } });
const tool = (name, input, parent) => { const i = id(); out({ type: 'assistant', parent_tool_use_id: parent || null, message: { role: 'assistant', content: [{ type: 'tool_use', id: i, name, input }] } }); return i; };
const result = (i, content, parent) => out({ type: 'user', parent_tool_use_id: parent || null, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: i, content }] } });

async function employee(type, desc, steps, summary) {
  const t = tool('Task', { subagent_type: type, description: desc, prompt: desc + ' 에 대해 작업해 주세요.' });
  await wait(900);
  for (const s of steps) {
    if (s.say) text(s.say, t);
    else { const i = tool(s.tool, s.input, t); await wait(700); result(i, 'ok', t); }
    await wait(600);
  }
  text(summary, t);
  await wait(500);
  result(t, summary);
  return t;
}

async function run() {
  const ask = prompt.split('# 사용자 지시').pop().trim().split('\n').filter(Boolean).pop() || '요청';
  out({ type: 'system', subtype: 'init', model: 'mock', tools: ['Task', 'Read', 'Write'], cwd: process.cwd() });
  await wait(600);
  text(`지시 접수: "${ask.slice(0, 40)}". 기획팀장에게 계획을 받겠습니다.`);
  await wait(800);
  await employee('plan_lead', '작업 계획 수립', [
    { tool: 'Glob', input: { pattern: 'output/**' } },
    { say: '조사와 기획을 동시에 진행하고, 제작 후 검토하는 순서로 가겠습니다.' },
  ], '계획: 1) 조사원 자료조사 2) 기획자 구조설계 (동시) 3) 제작자 작성 4) 검토자 검토 5) 제작팀장 통합');
  text('계획대로 조사원과 기획자에게 동시에 일을 맡깁니다.');
  await wait(500);
  await Promise.all([
    employee('researcher', '관련 자료 조사', [
      { tool: 'WebSearch', input: { query: ask.slice(0, 30) } },
      { tool: 'WebFetch', input: { url: 'https://example.com/article' } },
      { say: '출처 3개를 확보했습니다.' },
      { tool: 'Write', input: { file_path: 'output/research.md' } },
    ], '조사 완료: output/research.md (출처 3개)'),
    (async () => { await wait(400); return employee('planner', '결과물 구조 설계', [
      { tool: 'Read', input: { file_path: 'output/research.md' } },
      { say: '목차를 5개 장으로 잡겠습니다.' },
      { tool: 'Write', input: { file_path: 'output/outline.md' } },
    ], '구조 설계 완료: output/outline.md'); })(),
  ]);
  text('조사와 기획이 끝났습니다. 제작자에게 작성을 맡깁니다.');
  await employee('maker', '결과물 작성', [
    { tool: 'Read', input: { file_path: 'output/outline.md' } },
    { tool: 'Read', input: { file_path: 'output/research.md' } },
    { say: '초안을 작성 중입니다.' },
    { tool: 'Write', input: { file_path: 'output/draft.md' } },
    { tool: 'Edit', input: { file_path: 'output/draft.md' } },
  ], '초안 작성 완료: output/draft.md');
  await employee('reviewer', '초안 검토', [
    { tool: 'Read', input: { file_path: 'output/draft.md' } },
    { say: '중요 1건, 사소 2건 발견.' },
  ], '검토 결과: 중요 1건(3장 수치 출처 누락), 사소 2건(표현)');
  text('검토 지적을 반영하도록 제작자에게 수정 요청합니다.');
  await employee('maker', '검토 반영 수정', [
    { tool: 'Edit', input: { file_path: 'output/draft.md' } },
  ], '수정 완료');
  await employee('build_lead', '최종 통합', [
    { tool: 'Read', input: { file_path: 'output/draft.md' } },
    { tool: 'Write', input: { file_path: 'output/final.md' } },
  ], '통합 완료: output/final.md');
  const final = `## 결과\n"${ask.slice(0, 40)}" 요청을 처리했습니다. 조사 자료 3건을 바탕으로 5개 장 구조의 문서를 만들고 검토·수정을 거쳤습니다.\n\n## 산출물\n- output/final.md : 최종 문서\n- output/research.md : 조사 자료와 출처\n- output/outline.md : 구조 설계\n\n## 참여\n- 기획팀장: 계획 수립\n- 조사원: 자료 조사\n- 기획자: 구조 설계\n- 제작자: 작성 및 수정\n- 검토자: 검토\n- 제작팀장: 최종 통합\n\n## 남은 일 / 확인 필요\n- 없음`;
  text(final);
  await wait(300);
  out({ type: 'result', subtype: 'success', is_error: false, result: final, total_cost_usd: 0, duration_ms: 42000, num_turns: 18 });
}
