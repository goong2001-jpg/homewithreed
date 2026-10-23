/* 화면 조작: 서버 연결(SSE), 명령 전송, 실황 로그, 결과, 기록. 서버가 없으면 데모만 돈다. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const el = {
    conn: $('#conn'), connLabel: $('#conn .label'), banner: $('#banner'), account: $('#account'), resume: $('#resume'),
    form: $('#commandForm'), text: $('#commandText'), send: $('#sendBtn'), demo: $('#demoBtn'), stop: $('#stopBtn'), queue: $('#queue'),
    live: $('#live'), result: $('#result'), resultMeta: $('#resultMeta'), history: $('#history'), orgList: $('#orgList'),
    pinModal: $('#pinModal'), pinForm: $('#pinForm'), pinInput: $('#pinInput'), pinErr: $('#pinErr'), toast: $('#toast'),
    stage: $('#stage'), stageInner: $('#stageInner'), canvas: $('#office'),
  };
  let pin = '';
  try { pin = localStorage.getItem('aiOfficePin') || ''; } catch (e) {}
  let org = null, office = null, es = null, serverOk = false, status = null, demo = null;
  let zoom = 1;
  const NAMES = {}; const COLORS = {};

  // ---------- 시작 ----------
  boot();
  async function boot() {
    try {
      const r = await api('/api/org');
      org = await r.json();
    } catch (e) {
      org = window.DEMO_ORG; // 서버 없음: 내장 조직도로 데모만
    }
    buildNames();
    office = new window.Office(el.canvas, org);
    renderOrg();
    fitStage();
    connect();
    try { if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js'); } catch (e) {}
  }
  function buildNames() {
    NAMES.ceo = org.ceo.name; COLORS.ceo = org.ceo.color;
    org.agents.forEach(a => { NAMES[a.id] = a.name; COLORS[a.id] = a.color; });
  }

  // ---------- 서버 연결 ----------
  function api(path, opts) {
    opts = opts || {}; opts.headers = Object.assign({ 'x-office-pin': pin }, opts.headers || {});
    return fetch(path, opts).then(r => { if (r.status === 401) { askPin(); throw new Error('pin'); } return r; });
  }
  function connect() {
    if (es) { es.close(); es = null; }
    setConn('wait', '연결 중…');
    es = new EventSource('/api/events?pin=' + encodeURIComponent(pin));
    es.onopen = () => { serverOk = true; setConn('on', '브리지 연결됨'); el.banner.classList.add('hidden'); loadHistory(); };
    es.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch (e) {} };
    es.onerror = () => {
      serverOk = false; setConn('off', '서버 없음');
      // 401 이면 EventSource 가 그냥 에러만 낸다. status 로 확인.
      fetch('/api/status', { headers: { 'x-office-pin': pin } }).then(r => { if (r.status === 401) { es.close(); askPin(); } }).catch(() => {
        el.banner.textContent = '브리지 서버에 연결되지 않았습니다. PC 에서 서버를 켜고 다시 열어 주세요. 지금은 "데모"만 됩니다.';
        el.banner.classList.remove('hidden');
      });
    };
  }
  function setConn(state, label) { el.conn.className = 'conn ' + state; el.connLabel.textContent = label; }

  function askPin() {
    el.pinModal.classList.remove('hidden'); el.pinInput.value = ''; el.pinInput.focus();
    if (pin) el.pinErr.classList.remove('hidden');
  }
  el.pinForm.addEventListener('submit', (e) => {
    e.preventDefault(); pin = el.pinInput.value.trim();
    try { localStorage.setItem('aiOfficePin', pin); } catch (err) {}
    el.pinModal.classList.add('hidden'); el.pinErr.classList.add('hidden');
    boot();
  });

  // ---------- 이벤트 처리 ----------
  let currentJob = null;
  function onEvent(ev) {
    if (ev.type === 'status') { status = ev; renderStatus(ev); return; }
    if (office) office.handle(ev);
    switch (ev.type) {
      case 'job_start':
        currentJob = ev.id; el.live.innerHTML = '';
        log({ who: 'sys', text: (ev.demo ? '[데모] ' : '') + '지시: ' + ev.text, cls: 'sys', t: ev.t }); break;
      case 'init': log({ who: 'sys', text: '세션 시작' + (ev.model ? ' · ' + ev.model : ''), cls: 'sys', t: ev.t }); break;
      case 'say': log({ who: ev.agent, text: ev.text, t: ev.t }); break;
      case 'tool': log({ who: ev.agent, text: (window.OFFICE_TOOL_ICON[ev.tool] || '🔧') + ' ' + ev.tool + (ev.detail ? ' · ' + ev.detail : ''), cls: 'tool', t: ev.t }); break;
      case 'hook_tool': if (ev.agent) log({ who: ev.agent, text: (window.OFFICE_TOOL_ICON[ev.tool] || '🔧') + ' ' + ev.tool + (ev.detail ? ' · ' + ev.detail : ''), cls: 'tool', t: ev.t }); break;
      case 'agent_start': log({ who: 'ceo', text: '→ ' + name(ev.agent) + ' 에게: ' + (ev.description || '업무 지시'), cls: 'sys', t: ev.t }); setBusy(ev.agent, true); break;
      case 'agent_end': log({ who: ev.agent, text: (ev.ok ? '✅ 보고: ' : '⚠️ 보고: ') + (ev.summary || '완료'), t: ev.t }); setBusy(ev.agent, false); break;
      case 'result': showResult(ev); log({ who: 'ceo', text: ev.ok ? '📣 최종 보고를 올렸습니다. [결과] 탭을 보세요.' : '⚠️ 작업이 실패로 끝났습니다.', cls: 'sys', t: ev.t }); break;
      case 'job_end': log({ who: 'sys', text: ev.stopped ? '중지됨' : (ev.ok ? '작업 끝' : '작업이 오류로 끝남'), cls: 'sys', t: ev.t }); currentJob = null; loadHistory(); break;
      case 'error': log({ who: 'sys', text: ev.message, cls: 'err', t: ev.t }); toast(ev.message.split('\n')[0]); break;
      case 'spawn': log({ who: 'sys', text: 'claude 실행 (' + (ev.account || '기본') + ' 계정)', cls: 'sys', t: ev.t }); break;
    }
  }
  function name(id) { return NAMES[id] || id; }
  function log(o) {
    const li = document.createElement('li');
    const who = document.createElement('span'); who.className = 'who';
    if (o.who !== 'sys') { const sw = document.createElement('i'); sw.className = 'sw'; sw.style.background = COLORS[o.who] || '#7f8597'; who.appendChild(sw); who.appendChild(document.createTextNode(name(o.who))); }
    else who.textContent = '시스템';
    const txt = document.createElement('span'); txt.className = 'txt' + (o.cls ? ' ' + o.cls : ''); txt.textContent = o.text;
    const tm = document.createElement('time'); const d = new Date(o.t || Date.now()); tm.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    li.append(who, txt, tm); el.live.appendChild(li);
    while (el.live.children.length > 400) el.live.removeChild(el.live.firstChild);
    const pane = document.getElementById('pane-live'); pane.scrollTop = pane.scrollHeight;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function setBusy(id, on) { const li = el.orgList.querySelector('[data-id="' + id + '"]'); if (li) { li.classList.toggle('busy', on); li.querySelector('.st').textContent = on ? '작업 중' : '대기'; } }

  function renderStatus(s) {
    if (el.account.options.length !== s.accounts.length) {
      el.account.innerHTML = '';
      s.accounts.forEach(a => { const o = document.createElement('option'); o.value = a.id; o.textContent = a.name; el.account.appendChild(o); });
      try { const saved = localStorage.getItem('aiOfficeAccount'); if (saved && s.accounts.some(a => a.id === saved)) el.account.value = saved; } catch (e) {}
    }
    el.stop.disabled = !s.running;
    el.resume.disabled = !s.lastSessionId;
    el.resume.parentElement.title = s.lastSessionId ? '마지막 작업의 대화를 이어서 지시합니다' : '이어갈 이전 작업이 없습니다';
    if (s.queue && s.queue.length) {
      el.queue.innerHTML = '대기 ' + s.queue.length + '건: ';
      s.queue.forEach(j => { const sp = document.createElement('span'); sp.textContent = j.text.slice(0, 18) + (j.text.length > 18 ? '…' : ''); const b = document.createElement('button'); b.textContent = '×'; b.title = '대기열에서 빼기'; b.onclick = () => api('/api/stop?id=' + j.id, { method: 'POST' }); sp.appendChild(b); el.queue.appendChild(sp); });
      el.queue.classList.remove('hidden');
    } else el.queue.classList.add('hidden');
    if (s.mock) { el.banner.textContent = '모의(mock) 모드: 실제 Claude 대신 가짜 회사가 돕니다.'; el.banner.classList.remove('hidden'); }
  }

  function showResult(ev) {
    el.result.innerHTML = renderMd(ev.text || '(내용 없음)');
    const parts = [];
    if (ev.duration) parts.push('소요 ' + Math.round(ev.duration / 1000) + '초');
    if (ev.turns) parts.push('턴 ' + ev.turns);
    if (ev.sessionId) parts.push('세션 ' + ev.sessionId.slice(0, 8));
    el.resultMeta.textContent = parts.join(' · ');
    if (window.innerWidth < 900) switchTab('result');
  }

  // ---------- 명령 ----------
  el.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = el.text.value.trim(); if (!text) return;
    if (!serverOk) { toast('브리지 서버에 연결돼 있지 않습니다'); return; }
    el.send.disabled = true;
    try {
      const r = await api('/api/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, account: el.account.value, resume: el.resume.checked }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '실패');
      el.text.value = ''; el.resume.checked = false;
      if (j.queued > 0 && status && status.running) toast('앞 작업이 끝나면 시작합니다 (대기 ' + j.queued + '건)');
      switchTab('live');
    } catch (err) { if (err.message !== 'pin') toast('전송 실패: ' + err.message); }
    el.send.disabled = false;
  });
  el.text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); el.form.requestSubmit(); } });
  el.account.addEventListener('change', () => { try { localStorage.setItem('aiOfficeAccount', el.account.value); } catch (e) {} });
  el.stop.addEventListener('click', () => api('/api/stop', { method: 'POST' }).catch(() => {}));
  el.demo.addEventListener('click', async () => {
    if (serverOk) {
      try { await api('/api/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: el.text.value.trim() || '우리 회사 소개 문서 만들기 (데모)', demo: true }) }); switchTab('live'); }
      catch (e) { toast('데모 실행 실패'); }
    } else {
      if (demo) { demo.stop(); }
      office.reset(); el.live.innerHTML = '';
      demo = window.playDemo(onEvent);
      switchTab('live');
    }
  });

  // ---------- 탭 / 기록 / 조직 ----------
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  function switchTab(id) {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    document.querySelectorAll('.tabPane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + id));
  }
  async function loadHistory() {
    if (!serverOk) return;
    try {
      const r = await api('/api/history'); const list = await r.json();
      el.history.innerHTML = '';
      if (!list.length) { el.history.innerHTML = '<li class="muted" style="cursor:default;background:none;border:none">아직 기록이 없습니다.</li>'; return; }
      list.forEach(h => {
        const li = document.createElement('li'); if (!h.ok) li.classList.add('bad');
        const d = new Date(h.startedAt);
        li.innerHTML = '<div class="t"></div><div class="m"></div>';
        li.querySelector('.t').textContent = h.text;
        li.querySelector('.m').textContent = `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())} · ${h.account || '기본'} · ${h.stopped ? '중지됨' : h.ok ? '완료' : '실패'}`;
        li.onclick = () => { showResult({ text: h.result || '(결과 없음)', duration: h.endedAt - h.startedAt, sessionId: h.sessionId }); switchTab('result'); };
        el.history.appendChild(li);
      });
    } catch (e) {}
  }
  function renderOrg() {
    el.orgList.innerHTML = '';
    [org.ceo, ...org.agents].forEach(a => {
      const li = document.createElement('li'); li.dataset.id = a.id;
      li.innerHTML = '<i class="sw"></i><div><div class="n"></div><div class="r"></div></div><span class="st">대기</span>';
      li.querySelector('.sw').style.background = a.color; li.querySelector('.n').textContent = a.name;
      li.querySelector('.r').textContent = a.title + ' · ' + a.team + (a.id === 'ceo' ? '' : ' · subagent: ' + a.id);
      el.orgList.appendChild(li);
    });
  }

  // ---------- 확대/축소 ----------
  function fitStage() {
    const w = el.stage.clientWidth - 16;
    const h = window.innerWidth >= 900 ? el.stage.clientHeight - 16 : Infinity;
    const base = Math.min(2, w / 736, h / 480);
    el.canvas.style.width = Math.round(736 * base * zoom) + 'px';
    el.canvas.style.maxWidth = 'none';
  }
  $('#zoomIn').addEventListener('click', () => { zoom = Math.min(3, zoom * 1.25); fitStage(); });
  $('#zoomOut').addEventListener('click', () => { zoom = Math.max(0.5, zoom / 1.25); fitStage(); });
  window.addEventListener('resize', fitStage);

  // ---------- 보조 ----------
  let toastTimer;
  function toast(msg) { el.toast.textContent = msg; el.toast.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 3500); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function inline(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); }
  function renderMd(src) {
    const lines = String(src).split('\n'); let out = '', list = null, code = false;
    const closeList = () => { if (list) { out += '</' + list + '>'; list = null; } };
    for (const raw of lines) {
      if (raw.trim().startsWith('```')) { if (code) { out += '</code></pre>'; code = false; } else { closeList(); out += '<pre><code>'; code = true; } continue; }
      if (code) { out += esc(raw) + '\n'; continue; }
      const h = raw.match(/^(#{1,3})\s+(.*)/); if (h) { closeList(); out += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; continue; }
      const ul = raw.match(/^\s*[-*]\s+(.*)/); if (ul) { if (list !== 'ul') { closeList(); out += '<ul>'; list = 'ul'; } out += '<li>' + inline(ul[1]) + '</li>'; continue; }
      const ol = raw.match(/^\s*\d+[.)]\s+(.*)/); if (ol) { if (list !== 'ol') { closeList(); out += '<ol>'; list = 'ol'; } out += '<li>' + inline(ol[1]) + '</li>'; continue; }
      closeList();
      if (raw.trim()) out += '<p>' + inline(raw) + '</p>';
    }
    if (code) out += '</code></pre>'; closeList();
    return out;
  }
})();
