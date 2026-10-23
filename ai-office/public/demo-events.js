/* 서버 없이도 화면을 확인할 수 있는 내장 데모. [지연ms, 이벤트] 목록을 순서대로 흘려보낸다. */
(function (global) {
  'use strict';
  global.DEMO_ORG = {
    ceo: { id: 'ceo', name: '총괄', title: '총괄 AI', team: '경영', color: '#2d5be3', hair: '#3a2a1a', pos: [16, 2], facing: 'down', desk: [16, 3] },
    agents: [
      { id: 'plan_lead', name: '기획팀장', title: '기획팀장', team: '기획', color: '#b5452f', hair: '#1d1d1d', pos: [16, 10], facing: 'down', desk: [16, 11] },
      { id: 'build_lead', name: '제작팀장', title: '제작팀장', team: '제작', color: '#2f8f5b', hair: '#5a3b1e', pos: [19, 10], facing: 'down', desk: [19, 11] },
      { id: 'researcher', name: '조사원', title: '조사 담당', team: '기획', color: '#d49a1e', hair: '#2b2b2b', pos: [3, 4], facing: 'up', desk: [3, 3] },
      { id: 'planner', name: '기획자', title: '기획 담당', team: '기획', color: '#8a4fcf', hair: '#7a3b14', pos: [8, 4], facing: 'up', desk: [8, 3] },
      { id: 'maker', name: '제작자', title: '생성 담당', team: '제작', color: '#1f9fb8', hair: '#111111', pos: [3, 10], facing: 'down', desk: [3, 11] },
      { id: 'reviewer', name: '검토자', title: '검토 담당', team: '제작', color: '#c9426f', hair: '#4a2a10', pos: [8, 10], facing: 'down', desk: [8, 11] },
    ],
    reportSpots: [[16, 4], [17, 4], [15, 4]],
  };
  const S = [
    [0, { type: 'job_start', id: 'demo', text: '가족 여행 체크리스트 문서 만들어줘', demo: true }],
    [600, { type: 'say', agent: 'ceo', text: '지시 접수: 가족 여행 체크리스트. 기획팀장에게 계획을 받겠습니다.' }],
    [1200, { type: 'agent_start', agent: 'plan_lead', description: '작업 계획 수립' }],
    [4200, { type: 'tool', agent: 'plan_lead', tool: 'Glob', detail: 'output/**' }],
    [1500, { type: 'say', agent: 'plan_lead', text: '조사와 기획을 동시에, 제작 후 검토 순서로 가겠습니다.' }],
    [2000, { type: 'agent_end', agent: 'plan_lead', ok: true, summary: '계획: 조사원·기획자 동시 → 제작자 → 검토자 → 제작팀장 통합' }],
    [4200, { type: 'say', agent: 'ceo', text: '계획대로 조사원과 기획자에게 동시에 맡깁니다.' }],
    [800, { type: 'agent_start', agent: 'researcher', description: '여행 준비물 자료 조사' }],
    [400, { type: 'agent_start', agent: 'planner', description: '체크리스트 구조 설계' }],
    [4500, { type: 'tool', agent: 'researcher', tool: 'WebSearch', detail: '가족 여행 준비물 체크리스트' }],
    [800, { type: 'tool', agent: 'planner', tool: 'Read', detail: 'output/research.md' }],
    [1800, { type: 'tool', agent: 'researcher', tool: 'WebFetch', detail: 'https://example.com/travel' }],
    [1200, { type: 'say', agent: 'planner', text: '출발 전 / 짐 / 아이 용품 / 현지 네 묶음으로 잡겠습니다.' }],
    [1500, { type: 'say', agent: 'researcher', text: '출처 3개 확보했습니다.' }],
    [1200, { type: 'tool', agent: 'planner', tool: 'Write', detail: 'output/outline.md' }],
    [800, { type: 'tool', agent: 'researcher', tool: 'Write', detail: 'output/research.md' }],
    [1600, { type: 'agent_end', agent: 'planner', ok: true, summary: '구조 설계 완료: output/outline.md' }],
    [900, { type: 'agent_end', agent: 'researcher', ok: true, summary: '조사 완료: output/research.md (출처 3개)' }],
    [4500, { type: 'say', agent: 'ceo', text: '조사와 기획이 끝났습니다. 제작자에게 작성을 맡깁니다.' }],
    [800, { type: 'agent_start', agent: 'maker', description: '체크리스트 문서 작성' }],
    [4200, { type: 'tool', agent: 'maker', tool: 'Read', detail: 'output/outline.md' }],
    [1200, { type: 'tool', agent: 'maker', tool: 'Read', detail: 'output/research.md' }],
    [1200, { type: 'say', agent: 'maker', text: '초안 작성 중입니다.' }],
    [1800, { type: 'tool', agent: 'maker', tool: 'Write', detail: 'output/draft.md' }],
    [1500, { type: 'agent_end', agent: 'maker', ok: true, summary: '초안 작성 완료: output/draft.md' }],
    [4200, { type: 'agent_start', agent: 'reviewer', description: '초안 검토' }],
    [4200, { type: 'tool', agent: 'reviewer', tool: 'Read', detail: 'output/draft.md' }],
    [1800, { type: 'say', agent: 'reviewer', text: '중요 1건(여권 유효기간 누락), 사소 2건.' }],
    [1500, { type: 'agent_end', agent: 'reviewer', ok: true, summary: '검토 결과: 중요 1건, 사소 2건' }],
    [4200, { type: 'say', agent: 'ceo', text: '검토 지적을 반영하도록 제작자에게 수정 요청합니다.' }],
    [800, { type: 'agent_start', agent: 'maker', description: '검토 반영 수정' }],
    [4200, { type: 'tool', agent: 'maker', tool: 'Edit', detail: 'output/draft.md' }],
    [1500, { type: 'agent_end', agent: 'maker', ok: true, summary: '수정 완료' }],
    [4200, { type: 'agent_start', agent: 'build_lead', description: '최종 통합' }],
    [4200, { type: 'tool', agent: 'build_lead', tool: 'Read', detail: 'output/draft.md' }],
    [1200, { type: 'tool', agent: 'build_lead', tool: 'Write', detail: 'output/final.md' }],
    [1500, { type: 'agent_end', agent: 'build_lead', ok: true, summary: '통합 완료: output/final.md' }],
    [4200, { type: 'result', ok: true, duration: 61000, turns: 16, text: '## 결과\n가족 여행 체크리스트를 4개 묶음(출발 전 / 짐 / 아이 용품 / 현지) 42개 항목으로 만들었습니다. 검토에서 나온 여권 유효기간 항목을 추가했습니다.\n\n## 산출물\n- output/final.md : 최종 체크리스트\n- output/research.md : 조사 자료와 출처\n- output/outline.md : 구조 설계\n\n## 참여\n- 기획팀장: 계획 수립\n- 조사원: 자료 조사\n- 기획자: 구조 설계\n- 제작자: 작성 및 수정\n- 검토자: 검토\n- 제작팀장: 최종 통합\n\n## 남은 일 / 확인 필요\n- 없음' }],
    [800, { type: 'job_end', ok: true, id: 'demo' }],
  ];
  global.playDemo = function (handler) {
    let i = 0, timer = null, stopped = false;
    function step() {
      if (stopped || i >= S.length) return;
      const [delay, ev] = S[i++];
      timer = setTimeout(() => { handler(Object.assign({ t: Date.now() }, ev)); step(); }, delay);
    }
    step();
    return { stop() { stopped = true; clearTimeout(timer); } };
  };
})(window);
