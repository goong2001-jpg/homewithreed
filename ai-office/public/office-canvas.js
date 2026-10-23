/* 픽셀 사무실 렌더러. 외부 이미지 없이 캔버스에 직접 그린다.
 * 지도: 23x15 타일, 타일 32px. 왼쪽 큰 사무실(직원), 오른쪽 위 총괄실, 오른쪽 아래 팀장실.
 * 통로: 왼쪽은 y=7 가로줄, 오른쪽은 x=14 세로줄. 모든 이동은 이 통로를 거친다. */
(function (global) {
  'use strict';
  const T = 32, COLS = 23, ROWS = 15;
  const CORRIDOR_Y = 7, CORRIDOR_X = 14, DIVIDER_X = 13;
  const SPEED = 110; // px/s

  const TOOL_ICON = { Read: '📖', Write: '✍️', Edit: '✏️', MultiEdit: '✏️', Glob: '🔎', Grep: '🔎', WebSearch: '🌐', WebFetch: '🌐', Bash: '💻', TodoWrite: '📝', Task: '📋', Agent: '📋' };

  class Character {
    constructor(def) {
      this.id = def.id; this.name = def.name; this.color = def.color; this.hair = def.hair || '#222';
      this.home = def.pos.slice(); this.homeFacing = def.facing || 'down';
      this.x = def.pos[0] * T + T / 2; this.y = def.pos[1] * T + T; // 발 위치(타일 아래 중앙)
      this.facing = this.homeFacing;
      this.queue = []; this.cur = null;
      this.walkPhase = 0; this.moving = false;
      this.bubble = null; this.toolIcon = null; this.working = false; this.busy = false;
      this.skin = def.skin || '#f3d3b3';
    }
    tile() { return [Math.floor(this.x / T), Math.floor((this.y - 1) / T)]; }
    enqueue(a) { this.queue.push(a); }
    say(text, ms) { this.bubble = { text, until: performance.now() + (ms || 3200) }; }
    tool(name, ms) { this.toolIcon = { icon: TOOL_ICON[name] || '🔧', until: performance.now() + (ms || 2600) }; this.working = true; }

    update(dt, now) {
      if (this.bubble && now > this.bubble.until) this.bubble = null;
      if (this.toolIcon && now > this.toolIcon.until) this.toolIcon = null;
      // 즉시 끝나는 동작들은 한 프레임에 여러 개 처리
      for (let guard = 0; guard < 20; guard++) {
        if (!this.cur) {
          if (!this.queue.length) { this.moving = false; return; }
          this.cur = this.queue.shift();
          if (this.cur.type === 'walk') { this.cur.path = this.pathTo(this.cur.to); this.cur.i = 0; }
          if (this.cur.type === 'wait') this.cur.until = now + this.cur.ms;
          if (this.cur.type === 'say') { this.say(this.cur.text, this.cur.ms); if (this.cur.block) { this.cur.type = 'wait'; this.cur.until = now + (this.cur.ms || 1200); } else { this.cur = null; continue; } }
          if (this.cur.type === 'face') { this.facing = this.cur.dir; this.cur = null; continue; }
          if (this.cur.type === 'work') { this.working = this.cur.on; this.cur = null; continue; }
          if (this.cur.type === 'busy') { this.busy = this.cur.on; this.cur = null; continue; }
          if (this.cur.type === 'tool') { this.tool(this.cur.name); this.cur = null; continue; }
        }
        const c = this.cur;
        if (c.type === 'wait') { if (now >= c.until) { this.cur = null; continue; } this.moving = false; return; }
        if (c.type === 'walk') {
          const target = c.path[c.i];
          if (!target) { this.cur = null; this.moving = false; continue; }
          const tx = target[0] * T + T / 2, ty = target[1] * T + T;
          const dx = tx - this.x, dy = ty - this.y, dist = Math.hypot(dx, dy);
          if (dist < 0.5) { this.x = tx; this.y = ty; c.i++; continue; }
          const step = Math.min(dist, SPEED * dt);
          this.x += dx / dist * step; this.y += dy / dist * step;
          this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          this.moving = true; this.walkPhase += dt * 10;
          return;
        }
        this.cur = null;
      }
    }

    // 통로를 거치는 경로. 왼쪽 구역은 세로로 y=7 까지, 오른쪽 구역은 가로로 x=14 까지 나온 뒤 통로를 따라간다.
    pathTo(to) {
      const from = this.tile();
      const entry = p => (p[0] < DIVIDER_X ? [p[0], CORRIDOR_Y] : [CORRIDOR_X, p[1]]);
      const a = entry(from), b = entry(to);
      const path = [];
      if (a[0] !== from[0] || a[1] !== from[1]) path.push(a);
      if (a[0] < DIVIDER_X && b[0] < DIVIDER_X) { /* 같은 가로 통로 */ }
      else if (a[0] >= DIVIDER_X && b[0] >= DIVIDER_X) { /* 같은 세로 통로 */ }
      else path.push([CORRIDOR_X, CORRIDOR_Y]);
      if (path.length === 0 || path[path.length - 1][0] !== b[0] || path[path.length - 1][1] !== b[1]) path.push(b);
      if (b[0] !== to[0] || b[1] !== to[1]) path.push(to);
      return path;
    }
  }

  class Office {
    constructor(canvas, org) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.org = org;
      this.chars = new Map();
      this.addChar(org.ceo);
      org.agents.forEach(a => this.addChar(a));
      this.spare = [[11, 12], [11, 10], [6, 12], [6, 6]];
      this.reportSpots = org.reportSpots || [[16, 4], [17, 4], [15, 4]];
      this.reportIdx = 0;
      this.last = performance.now();
      this.bg = this.renderBackground();
      this.frame = this.frame.bind(this);
      requestAnimationFrame(this.frame);
    }
    addChar(def) { const c = new Character(def); this.chars.set(def.id, c); return c; }
    char(id) {
      if (this.chars.has(id)) return this.chars.get(id);
      // 조직도에 없는 직원은 임시 자리에 앉힌다
      const pos = this.spare.shift() || [11, 12];
      return this.addChar({ id, name: id, color: '#7f8597', hair: '#333', pos, facing: 'down' });
    }
    nextReportSpot() { const s = this.reportSpots[this.reportIdx % this.reportSpots.length]; this.reportIdx++; return s; }

    // ---- 이벤트 → 연출 ----
    handle(ev) {
      const ceo = this.chars.get('ceo');
      switch (ev.type) {
        case 'job_start':
          ceo.queue.length = 0;
          ceo.enqueue({ type: 'say', text: '📨 지시 접수', ms: 2500 });
          ceo.enqueue({ type: 'work', on: true });
          break;
        case 'agent_start': {
          const c = this.char(ev.agent);
          const spot = this.nextReportSpot();
          c.enqueue({ type: 'busy', on: true });
          c.enqueue({ type: 'work', on: false });
          c.enqueue({ type: 'walk', to: spot });
          c.enqueue({ type: 'face', dir: 'up' });
          c.enqueue({ type: 'say', text: '📋 ' + (ev.description || '업무 지시'), ms: 1500, block: true });
          c.enqueue({ type: 'walk', to: c.home });
          c.enqueue({ type: 'face', dir: c.homeFacing });
          c.enqueue({ type: 'work', on: true });
          break;
        }
        case 'say': {
          const c = this.char(ev.agent);
          c.enqueue({ type: 'say', text: shorten(ev.text, 26), ms: 3500 });
          break;
        }
        case 'tool': case 'hook_tool': {
          if (!ev.agent) break;
          const c = this.char(ev.agent);
          c.enqueue({ type: 'tool', name: ev.tool });
          break;
        }
        case 'agent_end': {
          const c = this.char(ev.agent);
          const spot = this.nextReportSpot();
          c.enqueue({ type: 'work', on: false });
          c.enqueue({ type: 'walk', to: spot });
          c.enqueue({ type: 'face', dir: 'up' });
          c.enqueue({ type: 'say', text: ev.ok ? '✅ 보고 드립니다' : '⚠️ 문제가 있었습니다', ms: 1600, block: true });
          c.enqueue({ type: 'walk', to: c.home });
          c.enqueue({ type: 'face', dir: c.homeFacing });
          c.enqueue({ type: 'busy', on: false });
          break;
        }
        case 'result':
          ceo.enqueue({ type: 'work', on: false });
          ceo.enqueue({ type: 'say', text: ev.ok ? '📣 보고 완료!' : '⚠️ 작업 실패', ms: 5000 });
          break;
        case 'job_end':
          for (const c of this.chars.values()) { c.enqueue({ type: 'work', on: false }); c.enqueue({ type: 'busy', on: false }); }
          break;
        case 'error':
          ceo.enqueue({ type: 'say', text: '⚠️ 오류', ms: 4000 });
          break;
      }
    }
    reset() { for (const c of this.chars.values()) { c.queue.length = 0; c.cur = null; c.working = false; c.busy = false; c.toolIcon = null; c.bubble = null; c.x = c.home[0] * T + T / 2; c.y = c.home[1] * T + T; c.facing = c.homeFacing; } }

    // ---- 그리기 ----
    frame(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      for (const c of this.chars.values()) c.update(dt, now);
      const ctx = this.ctx;
      ctx.drawImage(this.bg, 0, 0);
      this.drawDynamicFurniture(ctx, now);
      const list = [...this.chars.values()].sort((a, b) => a.y - b.y);
      for (const c of list) this.drawChar(ctx, c, now);
      for (const c of list) this.drawBubble(ctx, c);
      requestAnimationFrame(this.frame);
    }

    renderBackground() {
      const off = document.createElement('canvas'); off.width = COLS * T; off.height = ROWS * T;
      const g = off.getContext('2d');
      // 바닥
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        let col;
        if (x < DIVIDER_X) col = (x + y) % 2 ? '#b8834a' : '#b07c44';           // 나무 바닥
        else if (y < CORRIDOR_Y) col = (x + y) % 2 ? '#3f5f8f' : '#3a5885';      // 총괄실 카펫
        else if (y === CORRIDOR_Y && x > CORRIDOR_X) col = '#6d6a7a';
        else col = (x + y) % 2 ? '#5c7f6a' : '#567862';                           // 팀장실 카펫
        if (x === CORRIDOR_X && x >= DIVIDER_X) col = (y % 2) ? '#8d8aa0' : '#86839a'; // 복도
        g.fillStyle = col; g.fillRect(x * T, y * T, T, T);
        if (x < DIVIDER_X) { g.fillStyle = '#00000012'; g.fillRect(x * T, y * T + T - 2, T, 2); }
      }
      // 통로 표시 (은은한 러그)
      g.fillStyle = '#00000010'; g.fillRect(T, CORRIDOR_Y * T, (DIVIDER_X - 1) * T, T);
      // 벽
      const wall = (x, y, w, h) => { g.fillStyle = '#4a4458'; g.fillRect(x * T, y * T, w * T, h * T); g.fillStyle = '#6b6380'; g.fillRect(x * T, y * T, w * T, 6); g.fillStyle = '#2d2838'; g.fillRect(x * T, (y + h) * T - 4, w * T, 4); };
      wall(0, 0, COLS, 1); wall(0, 0, 1, ROWS); wall(COLS - 1, 0, 1, ROWS); wall(0, ROWS - 1, COLS, 1);
      for (let y = 1; y < ROWS - 1; y++) if (y !== CORRIDOR_Y) wall(DIVIDER_X, y, 1, 1);
      wall(DIVIDER_X + 2, CORRIDOR_Y, COLS - DIVIDER_X - 3, 1);
      // 문 (바닥색으로 비움 표시)
      g.fillStyle = '#9b7a5a'; g.fillRect(DIVIDER_X * T, CORRIDOR_Y * T + 4, T, T - 8);
      // 장식
      this.drawShelf(g, 2, 0); this.drawShelf(g, 3, 0); this.drawShelf(g, 8, 0); this.drawShelf(g, 9, 0);
      this.drawPainting(g, 17, 0); this.drawPainting(g, 18, 0);
      this.drawWindow(g, 5, 0); this.drawWindow(g, 6, 0); this.drawWindow(g, 11, 0); this.drawWindow(g, 15, 0); this.drawWindow(g, 20, 0);
      [[1, 13], [12, 13], [12, 1], [21, 6], [21, 13], [15, 6], [20, 8], [1, 1]].forEach(p => this.drawPlant(g, p[0], p[1]));
      this.drawCooler(g, 12, 5); this.drawPrinter(g, 15, 13); this.drawSofa(g, 16, 8); this.drawTable(g, 18, 8);
      this.drawRug(g, 16, 5, 2, 1);
      // 책상 + 의자
      const deskOf = (c) => { const d = c.desk, chairUp = c.facing === 'up'; this.drawDesk(g, d[0], d[1], c.pos[0]); this.drawChair(g, c.pos[0], c.pos[1], chairUp); };
      deskOf(this.org.ceo); this.org.agents.forEach(deskOf);
      // 명패
      g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff6';
      g.fillText('총괄실', (CORRIDOR_X + 4.5) * T, 1 * T + 26);
      g.fillText('팀장실', (CORRIDOR_X + 4.5) * T, 13 * T + 26);
      g.fillText('실무팀', 6.5 * T, 13 * T + 26);
      return off;
    }
    drawDesk(g, x, y, monitorX) {
      g.fillStyle = '#6b3f1f'; g.fillRect(x * T + 1, y * T + 6, 2 * T - 2, T - 8);
      g.fillStyle = '#8a5530'; g.fillRect(x * T + 1, y * T + 6, 2 * T - 2, 6);
      g.fillStyle = '#4a2a12'; g.fillRect(x * T + 3, y * T + T - 4, 4, 4); g.fillRect(x * T + 2 * T - 7, y * T + T - 4, 4, 4);
      // 모니터(화면 부분은 동적으로 다시 그림), 키보드, 머그컵
      g.fillStyle = '#222'; g.fillRect(monitorX * T + 7, y * T + 4, 18, 14); g.fillRect(monitorX * T + 14, y * T + 18, 4, 4);
      g.fillStyle = '#ddd'; g.fillRect((x + 1) * T + 6, y * T + 14, 16, 6);
      g.fillStyle = '#e9e9e9'; g.fillRect((x + 1) * T + 24, y * T + 10, 6, 7); g.fillStyle = '#c33'; g.fillRect((x + 1) * T + 25, y * T + 11, 4, 2);
    }
    drawChair(g, x, y, up) { g.fillStyle = '#2c2c3a'; g.fillRect(x * T + 8, y * T + (up ? 10 : 6), 16, 18); g.fillStyle = '#44445a'; g.fillRect(x * T + 10, y * T + (up ? 20 : 8), 12, 6); }
    drawShelf(g, x, y) { g.fillStyle = '#5a3418'; g.fillRect(x * T + 2, y * T + 6, T - 4, T - 8); const cols = ['#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22']; for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) { g.fillStyle = cols[(i + r + x) % cols.length]; g.fillRect(x * T + 4 + i * 5, y * T + 9 + r * 10, 4, 8); } }
    drawPainting(g, x, y) { g.fillStyle = '#c9a24a'; g.fillRect(x * T + 4, y * T + 6, T - 8, T - 12); g.fillStyle = '#7fc7ff'; g.fillRect(x * T + 6, y * T + 8, T - 12, T - 16); g.fillStyle = '#6ab04c'; g.fillRect(x * T + 6, y * T + 16, T - 12, 6); g.fillStyle = '#ffe66d'; g.fillRect(x * T + 18, y * T + 10, 4, 4); }
    drawWindow(g, x, y) { g.fillStyle = '#9fd3ff'; g.fillRect(x * T + 4, y * T + 5, T - 8, T - 11); g.fillStyle = '#e4f3ff'; g.fillRect(x * T + 5, y * T + 6, 8, 6); g.fillStyle = '#5c5570'; g.fillRect(x * T + T / 2 - 1, y * T + 5, 2, T - 11); g.fillRect(x * T + 4, y * T + T / 2 - 2, T - 8, 2); }
    drawPlant(g, x, y) { g.fillStyle = '#b55'; g.fillRect(x * T + 10, y * T + 18, 12, 12); g.fillStyle = '#d66'; g.fillRect(x * T + 9, y * T + 16, 14, 4); g.fillStyle = '#2e8b57'; g.fillRect(x * T + 13, y * T + 6, 6, 12); g.fillRect(x * T + 6, y * T + 10, 8, 5); g.fillRect(x * T + 18, y * T + 9, 8, 5); g.fillStyle = '#3cb371'; g.fillRect(x * T + 14, y * T + 3, 4, 6); }
    drawCooler(g, x, y) { g.fillStyle = '#ddd'; g.fillRect(x * T + 9, y * T + 12, 14, 18); g.fillStyle = '#6fc3ff'; g.fillRect(x * T + 11, y * T + 2, 10, 11); g.fillStyle = '#48a'; g.fillRect(x * T + 12, y * T + 18, 3, 3); }
    drawPrinter(g, x, y) { g.fillStyle = '#cfcfd6'; g.fillRect(x * T + 4, y * T + 10, 24, 16); g.fillStyle = '#777'; g.fillRect(x * T + 6, y * T + 6, 20, 5); g.fillStyle = '#fff'; g.fillRect(x * T + 10, y * T + 4, 12, 4); }
    drawSofa(g, x, y) { g.fillStyle = '#8e3b5e'; g.fillRect(x * T + 2, y * T + 8, 2 * T - 4, 18); g.fillStyle = '#b25078'; g.fillRect(x * T + 4, y * T + 12, 2 * T - 8, 10); g.fillStyle = '#6a2a46'; g.fillRect(x * T + 2, y * T + 8, 6, 18); g.fillRect(x * T + 2 * T - 8, y * T + 8, 6, 18); }
    drawTable(g, x, y) { g.fillStyle = '#6b3f1f'; g.fillRect(x * T + 5, y * T + 12, 22, 12); g.fillStyle = '#eee'; g.fillRect(x * T + 10, y * T + 14, 6, 6); g.fillStyle = '#ddd'; g.fillRect(x * T + 18, y * T + 15, 5, 5); }
    drawRug(g, x, y, w, h) { g.fillStyle = '#ffffff14'; g.fillRect(x * T + 2, y * T + 2, w * T - 4, h * T - 4); }

    drawDynamicFurniture(ctx, now) {
      // 모니터 화면: 일하는 중이면 밝게 깜빡임
      const all = [this.org.ceo, ...this.org.agents];
      for (const d of all) {
        const c = this.chars.get(d.id);
        const on = c && c.working;
        const mx = d.pos[0] * T + 8, my = d.desk[1] * T + 5;
        ctx.fillStyle = on ? ((Math.floor(now / 250) % 2) ? '#8fe3ff' : '#6fcfff') : '#3a4660';
        ctx.fillRect(mx, my, 16, 12);
        if (on) { ctx.fillStyle = '#ffffffaa'; const lines = 3; for (let i = 0; i < lines; i++) { const w = 4 + ((Math.floor(now / 180) + i * 3) % 9); ctx.fillRect(mx + 2, my + 2 + i * 3, w, 1); } }
      }
    }

    drawChar(ctx, c, now) {
      const x = Math.round(c.x), y = Math.round(c.y);
      const bob = c.moving ? Math.round(Math.sin(c.walkPhase) * 1.5) : (c.working ? Math.round(Math.sin(now / 120) * 0.6) : 0);
      // 그림자
      ctx.fillStyle = '#00000033'; ctx.beginPath(); ctx.ellipse(x, y - 2, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
      // 다리
      const legOff = c.moving ? Math.round(Math.sin(c.walkPhase) * 3) : 0;
      ctx.fillStyle = '#2b3a67';
      ctx.fillRect(x - 6, y - 10 + Math.max(0, legOff), 5, 8 - Math.max(0, legOff));
      ctx.fillRect(x + 1, y - 10 + Math.max(0, -legOff), 5, 8 - Math.max(0, -legOff));
      ctx.fillStyle = '#222'; ctx.fillRect(x - 6, y - 3, 5, 3); ctx.fillRect(x + 1, y - 3, 5, 3);
      // 몸통
      ctx.fillStyle = c.color; ctx.fillRect(x - 8, y - 21 + bob, 16, 12);
      ctx.fillStyle = '#ffffff22'; ctx.fillRect(x - 8, y - 21 + bob, 16, 3);
      // 팔
      ctx.fillStyle = c.skin;
      if (c.facing === 'left') ctx.fillRect(x - 4, y - 16 + bob, 4, 7);
      else if (c.facing === 'right') ctx.fillRect(x, y - 16 + bob, 4, 7);
      else { ctx.fillRect(x - 11, y - 18 + bob, 3, 8); ctx.fillRect(x + 8, y - 18 + bob, 3, 8); }
      // 머리
      ctx.fillStyle = c.skin; ctx.fillRect(x - 7, y - 33 + bob, 14, 13);
      // 머리카락
      ctx.fillStyle = c.hair;
      ctx.fillRect(x - 8, y - 35 + bob, 16, 6);
      if (c.facing === 'up') ctx.fillRect(x - 8, y - 35 + bob, 16, 12);
      else if (c.facing === 'left') { ctx.fillRect(x - 8, y - 35 + bob, 6, 12); ctx.fillRect(x + 4, y - 35 + bob, 4, 8); }
      else if (c.facing === 'right') { ctx.fillRect(x + 2, y - 35 + bob, 6, 12); ctx.fillRect(x - 8, y - 35 + bob, 4, 8); }
      else { ctx.fillRect(x - 8, y - 35 + bob, 3, 10); ctx.fillRect(x + 5, y - 35 + bob, 3, 10); }
      // 눈
      ctx.fillStyle = '#222';
      if (c.facing === 'down') { ctx.fillRect(x - 4, y - 27 + bob, 2, 3); ctx.fillRect(x + 2, y - 27 + bob, 2, 3); }
      else if (c.facing === 'left') ctx.fillRect(x - 5, y - 27 + bob, 2, 3);
      else if (c.facing === 'right') ctx.fillRect(x + 3, y - 27 + bob, 2, 3);
      // 이름표
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000000aa'; const w = ctx.measureText(c.name).width + 6;
      ctx.fillRect(x - w / 2, y + 1, w, 11);
      ctx.fillStyle = c.busy || c.working ? '#9ff0b5' : '#fff'; ctx.fillText(c.name, x, y + 9);
      // 도구 아이콘
      if (c.toolIcon) { ctx.font = '13px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(c.toolIcon.icon, x + 14, y - 30 + bob); }
      else if (c.working && !c.moving) { const d = Math.floor(now / 350) % 3; ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('.'.repeat(d + 1), x + 14, y - 30 + bob); }
    }

    drawBubble(ctx, c) {
      if (!c.bubble) return;
      const now = performance.now();
      const alpha = Math.min(1, (c.bubble.until - now) / 400);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      const text = c.bubble.text;
      const w = Math.min(190, ctx.measureText(text).width + 14), h = 20;
      let bx = Math.round(c.x - w / 2), by = Math.round(c.y - 58);
      bx = Math.max(2, Math.min(COLS * T - w - 2, bx)); if (by < 2) by = Math.round(c.y + 14);
      ctx.fillStyle = '#fffdf5'; roundRect(ctx, bx, by, w, h, 6); ctx.fill();
      ctx.fillStyle = '#fffdf5'; ctx.beginPath(); ctx.moveTo(c.x - 4, by + h); ctx.lineTo(c.x + 4, by + h); ctx.lineTo(c.x, by + h + 5); ctx.fill();
      ctx.fillStyle = '#222'; clipText(ctx, text, w - 10, bx + w / 2, by + 14);
      ctx.globalAlpha = 1;
    }
  }

  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function clipText(ctx, text, maxW, x, y) { let t = text; while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + '…'; ctx.fillText(t, x, y); }
  function shorten(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  global.Office = Office;
  global.OFFICE_TOOL_ICON = TOOL_ICON;
})(window);
