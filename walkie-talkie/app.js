/* 집무전기 — 폰 마이크 + 스피커로 쓰는 PTT 무전기
 *
 * 구조
 *   채널마다 '허브' 자리(hwr-wt-<채널>-hub)가 하나 있다. 먼저 들어온 사람이 그 자리를 차지하고
 *   참가자 명단만 관리한다(통화는 하지 않는다). 나머지는 허브에 이름을 알리고 명단을 받아,
 *   명단에 실제로 있는 사람하고만 직접 연결한다.
 *
 *   예전 방식(자리 6개를 다 두드려 보기)은 빈 자리에도 계속 연결을 걸어서
 *   폰 브라우저의 동시 연결 한도를 잡아먹고 진짜 연결까지 실패시켰다.
 *
 *   허브가 나가면 남은 사람 중 하나가 자동으로 허브 자리를 이어받는다.
 *   이미 이어진 통화는 허브와 무관하게 계속 유지된다.
 */
(function () {
  'use strict';

  var NS = 'hwr-wt';
  var HUB_SUFFIX = 'hub';
  var KEEP_MS = 5000;          // 생존 신호 주기
  var STALE_MS = 20000;        // 이만큼 소식 없으면 끊긴 것으로 본다
  var CONNECT_TIMEOUT = 12000; // 연결 시도 포기 시간
  var MAX_TRIES = 4;           // 같은 상대에게 다시 걸어보는 최대 횟수
  var RETRY_REST_MS = 30000;   // 시도를 다 쓴 뒤 이만큼 쉬고 처음부터 다시 건다
  var HIGHER_DIAL_MS = 15000;  // 작은 ID 쪽이 이만큼 걸어오지 않으면 큰 ID 쪽도 건다

  var ICE = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // 직접 연결이 막힐 때 쓰는 무료 공개 중계(TURN). 월 20GB 공유 서버라 느리거나 막힐 수 있다.
      {
        urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 2
  };

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    name: '', room: '', myId: '', hubId: '',
    peer: null,            // 내 통화용 Peer
    hubPeer: null,         // 허브 자리를 차지했을 때만 존재 (명단 관리 전용)
    isHub: false,
    hubConn: null,         // 멤버일 때 허브로 가는 데이터 연결
    hubMembers: {},        // 허브일 때: id -> { name, seen, conn }
    roster: {},            // 모두: id -> name
    peers: {},             // id -> { conn, call, name, talking, seen, audio, tries, timer, dc, mc, dir, gen, since, lastTry }
                           //   dc/mc: 열렸든 아니든 지금 걸려 있는 데이터/소리 연결, dir: 'out' 내가 건 것 / 'in' 상대가 건 것
    localStream: null, micTrack: null,
    talking: false, locked: false, duplex: true,
    hubSeen: 0,
    rawStream: null, gate: null, analyser: null, levelBuf: null, statsTimer: null,
    wakeLock: null, timer: null, audioCtx: null,
    logs: []
  };

  /* ---------- 진단 기록 ---------- */
  function log(msg) {
    var t = new Date().toTimeString().slice(0, 8);
    var line = t + '  ' + msg;
    state.logs.push(line);
    if (state.logs.length > 200) state.logs.shift();
    var el = $('log');
    if (el) { el.textContent = state.logs.join('\n'); el.scrollTop = el.scrollHeight; }
  }

  function shortId(id) { return String(id || '').split('-').pop(); }

  /* ---------- 저장된 값 ---------- */
  try {
    $('nameInput').value = localStorage.getItem(NS + ':name') || '';
    $('roomInput').value = localStorage.getItem(NS + ':room') || '';
  } catch (e) {}

  function setStatus(text) { $('statusLine').textContent = text; }

  function joinMsg(text, isError) {
    var el = $('joinMsg');
    el.textContent = text || '';
    el.className = 'msg' + (isError ? ' error' : '');
  }

  function beep(freq, ms) {
    try {
      if (!state.audioCtx) return;
      var osc = state.audioCtx.createOscillator();
      var gain = state.audioCtx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      osc.connect(gain).connect(state.audioCtx.destination);
      osc.start();
      osc.stop(state.audioCtx.currentTime + ms / 1000);
    } catch (e) {}
  }

  function randomId() {
    var s = '';
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }


  /* ---------- 마이크 게이트 ----------
   * PTT 를 트랙 on/off 로 하면, 꺼진 트랙으로 연결을 맺는 순간 한쪽 방향이
   * 아예 '받기 전용' 으로 굳어버리는 폰이 있다(주로 사파리). 그래서 트랙은 항상 살려두고
   * 소리 크기(gain)를 0/1 로 여닫는다. 덤으로 내 목소리 입력 레벨도 볼 수 있다.
   */
  function buildMicGate(stream) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return stream;
      if (!state.audioCtx) state.audioCtx = new AC();
      var ctx = state.audioCtx;
      if (ctx.resume) ctx.resume();

      var src = ctx.createMediaStreamSource(stream);
      var gain = ctx.createGain();
      gain.gain.value = 0;
      var dest = ctx.createMediaStreamDestination();
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 512;

      src.connect(analyser);
      src.connect(gain);
      gain.connect(dest);

      state.gate = gain;
      state.analyser = analyser;
      state.levelBuf = new Uint8Array(analyser.fftSize);

      if (!dest.stream.getAudioTracks().length) { state.gate = null; return stream; }
      return dest.stream;
    } catch (e) {
      log('게이트 생성 실패 → 트랙 방식으로 대체: ' + e);
      state.gate = null;
      return stream;
    }
  }

  function micLevel() {
    if (!state.analyser) return 0;
    state.analyser.getByteTimeDomainData(state.levelBuf);
    var sum = 0;
    for (var i = 0; i < state.levelBuf.length; i++) {
      var v = (state.levelBuf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / state.levelBuf.length) * 4);
  }

  /* ---------- 실제로 소리가 오가는지 확인 ---------- */
  function pollStats() {
    Object.keys(state.peers).forEach(function (id) {
      var p = state.peers[id];
      var pc = p.call && p.call.peerConnection;
      if (!pc || !pc.getStats) return;
      pc.getStats(null).then(function (report) {
        var sent = 0, recv = 0;
        report.forEach(function (r) {
          if (r.type === 'outbound-rtp' && (r.kind === 'audio' || r.mediaType === 'audio')) sent = r.bytesSent || 0;
          if (r.type === 'inbound-rtp' && (r.kind === 'audio' || r.mediaType === 'audio')) recv = r.bytesReceived || 0;
        });
        p.dSent = sent - (p.lastSent || 0);
        p.dRecv = recv - (p.lastRecv || 0);
        p.lastSent = sent;
        p.lastRecv = recv;
        if (p.dRecv > 0) p.everRecv = true;
        if (p.dSent > 0) p.everSent = true;
      }).catch(function () {});
    });
  }

  function renderMeter() {
    var bar = $('micBar');
    if (bar) {
      var lv = state.talking ? micLevel() : 0;
      bar.style.width = Math.round(lv * 100) + '%';
      bar.className = lv > 0.03 ? 'ok' : '';
    }
    var el = $('netStat');
    if (!el) return;
    var ids = Object.keys(state.peers).filter(function (id) { return state.peers[id].call; });
    if (!ids.length) { el.textContent = ''; return; }
    el.innerHTML = ids.map(function (id) {
      var p = state.peers[id];
      var name = p.name || shortId(id);
      var up = p.dSent > 0 ? '↑보냄' : '↑없음';
      var down = p.dRecv > 0 ? '↓받는중' : (p.everRecv ? '↓조용' : '↓안옴');
      var warn = (!p.everRecv && p.call) ? ' warn' : '';
      return '<span class="net' + warn + '">' + name + ' ' + up + ' ' + down + '</span>';
    }).join('');
  }

  /* ---------- 화면 ---------- */
  function renderMembers() {
    var ul = $('members');
    ul.innerHTML = '';

    var mine = document.createElement('li');
    mine.className = 'me' + (state.talking ? ' talking' : '');
    mine.textContent = (state.name || '나') + ' (나)' + (state.isHub ? ' ⭐' : '');
    ul.appendChild(mine);

    var ids = Object.keys(state.peers).filter(function (id) { return state.peers[id].call || state.peers[id].conn; });
    ids.forEach(function (id) {
      var p = state.peers[id];
      var li = document.createElement('li');
      li.className = (p.talking ? 'talking ' : '') + (p.call ? '' : 'half');
      li.textContent = (p.name || shortId(id)) + (p.call ? '' : ' (소리 연결 중…)');
      ul.appendChild(li);
    });

    var n = ids.length + 1;
    var waiting = Object.keys(state.roster).length - 1 - ids.length;
    setStatus(
      n > 1
        ? '연결됨 · ' + n + '명' + (waiting > 0 ? ' (' + waiting + '명 연결 중…)' : '')
        : (state.isHub ? '채널을 열었습니다. 상대를 기다리는 중…' : '채널에 들어왔습니다. 상대를 찾는 중…')
    );

    var talking = ids.filter(function (id) { return state.peers[id].talking; });
    $('nowTalking').textContent = talking.length
      ? '🔊 ' + talking.map(function (id) { return state.peers[id].name || shortId(id); }).join(', ') + ' 말하는 중'
      : ' ';
  }

  /* ---------- 오디오 ---------- */
  function attachStream(id, stream) {
    var p = state.peers[id];
    if (!p) return;
    var el = p.audio;
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      p.audio = el;
      $('audioSink').appendChild(el);
    }
    try { el.srcObject = stream; } catch (e) { log('오디오 붙이기 실패: ' + e); return; }
    el.volume = (state.talking && state.duplex) ? 0.15 : 1;
    var pr = el.play();
    if (pr && pr.catch) pr.catch(function () { log('자동 재생 차단 → 소리 켜기 버튼 표시'); showUnlock(); });
    log('소리 연결됨: ' + (p.name || shortId(id)));
  }

  var unlockBtn = null;
  function showUnlock() {
    if (unlockBtn) return;
    unlockBtn = document.createElement('button');
    unlockBtn.className = 'unlock';
    unlockBtn.textContent = '🔈 소리 켜기 (한 번 눌러주세요)';
    unlockBtn.onclick = function () {
      Object.keys(state.peers).forEach(function (id) {
        var a = state.peers[id].audio;
        if (a) { var pr = a.play(); if (pr && pr.catch) pr.catch(function () {}); }
      });
      if (state.audioCtx && state.audioCtx.resume) state.audioCtx.resume();
      unlockBtn.remove();
      unlockBtn = null;
    };
    $('talkView').appendChild(unlockBtn);
  }

  function duckRemotes(on) {
    var v = on ? 0.15 : 1;
    Object.keys(state.peers).forEach(function (id) {
      if (state.peers[id].audio) state.peers[id].audio.volume = v;
    });
  }

  /* ---------- 송신 ---------- */
  function setMicOpen(on) {
    if (state.gate) {
      if (state.audioCtx && state.audioCtx.state === 'suspended' && state.audioCtx.resume) state.audioCtx.resume();
      try {
        state.gate.gain.setTargetAtTime(on ? 1 : 0, state.audioCtx.currentTime, 0.01);
      } catch (e) { state.gate.gain.value = on ? 1 : 0; }
    } else if (state.micTrack) {
      state.micTrack.enabled = on;   // 게이트를 못 쓰는 환경 대비
    }
  }

  function startTalk() {
    if (state.talking || !state.micTrack) return;
    state.talking = true;
    setMicOpen(true);
    if (state.duplex) duckRemotes(true);
    $('pttBtn').classList.add('on');
    $('pttBtn').setAttribute('aria-pressed', 'true');
    $('pttBtn').querySelector('.pttText').textContent = '송신 중…';
    broadcast({ t: 'talk', on: true });
    beep(880, 90);
    renderMembers();
  }

  function stopTalk() {
    if (!state.talking) return;
    state.talking = false;
    setMicOpen(false);
    duckRemotes(false);
    $('pttBtn').classList.remove('on');
    $('pttBtn').setAttribute('aria-pressed', 'false');
    $('pttBtn').querySelector('.pttText').textContent = state.locked ? '눌러서 송신 시작' : '누르고 말하기';
    broadcast({ t: 'talk', on: false });
    beep(520, 70);
    renderMembers();
  }

  function broadcast(msg) {
    msg.name = state.name;
    Object.keys(state.peers).forEach(function (id) {
      var c = state.peers[id].conn;
      try { if (c && c.open) c.send(msg); } catch (e) {}
    });
  }

  /* ---------- 상대와의 직접 연결 ---------- */
  function getPeerRec(id) {
    if (!state.peers[id]) state.peers[id] = { name: state.roster[id] || '', tries: 0, seen: Date.now(), since: Date.now(), gen: 0, dir: '' };
    return state.peers[id];
  }

  // 지금 걸려 있는 연결(열렸든 아니든)을 버린다. 버린 연결의 이벤트는 gen 이 달라져서 무시된다.
  function abandon(p) {
    p.gen++;
    if (p.timer) { clearTimeout(p.timer); p.timer = null; }
    try { if (p.dc) p.dc.close(); } catch (e) {}
    try { if (p.mc) p.mc.close(); } catch (e) {}
    p.dc = p.mc = p.conn = p.call = null;
    p.dir = '';
  }

  // 이만큼 기다려도 소리가 안 붙으면 버리고 다음 시도를 기다린다
  function armTimeout(id) {
    var p = getPeerRec(id);
    if (p.timer) clearTimeout(p.timer);
    p.timer = setTimeout(function () {
      p.timer = null;
      if (!p.call) { log('응답 없음 → 다시 시도 예정: ' + shortId(id)); abandon(p); renderMembers(); }
    }, CONNECT_TIMEOUT);
  }

  function watchIce(call, id, live) {
    try {
      var pc = call.peerConnection;
      if (!pc) return;
      pc.oniceconnectionstatechange = function () {
        log('ICE(' + shortId(id) + '): ' + pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed' && live()) {
          log('→ 직접 연결 실패. 중계(TURN)까지 막힌 상태입니다.');
          dropPeer(id, '연결 실패');
        }
      };
    } catch (e) {}
  }

  function wirePeerConn(id, conn) {
    var p = getPeerRec(id), gen = p.gen;
    var live = function () { return state.peers[id] === p && p.gen === gen; };   // 버린 연결의 이벤트는 무시
    p.dc = conn;
    conn.on('open', function () {
      if (!live()) return;
      p.conn = conn;
      p.seen = Date.now();
      try { conn.send({ t: 'hi', name: state.name }); } catch (e) {}
      log('데이터 연결됨: ' + shortId(id));
      renderMembers();
    });
    conn.on('data', function (msg) {
      if (!live() || !msg || typeof msg !== 'object') return;
      p.seen = Date.now();
      if (msg.name) p.name = String(msg.name).slice(0, 12);
      if (msg.t === 'hi') { try { conn.send({ t: 'hi-ack', name: state.name }); } catch (e) {} }
      if (msg.t === 'talk') p.talking = !!msg.on;
      if (msg.t === 'bye') { dropPeer(id, '상대가 나감'); return; }
      renderMembers();
    });
    conn.on('close', function () { if (live()) dropPeer(id, '데이터 연결 끊김'); });
    conn.on('error', function (e) { log('데이터 오류(' + shortId(id) + '): ' + (e && e.type || e)); });
  }

  function wirePeerCall(id, call) {
    var p = getPeerRec(id), gen = p.gen;
    var live = function () { return state.peers[id] === p && p.gen === gen; };
    p.mc = call;
    watchIce(call, id, live);
    call.on('stream', function (stream) {
      if (!live()) return;
      p.call = call;
      p.seen = Date.now();
      if (p.timer) { clearTimeout(p.timer); p.timer = null; }
      attachStream(id, stream);
      renderMembers();
    });
    call.on('close', function () { if (live()) dropPeer(id, '소리 연결 끊김'); });
    call.on('error', function (e) { log('소리 오류(' + shortId(id) + '): ' + (e && e.type || e)); });
  }

  function dropPeer(id, why) {
    var p = state.peers[id];
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    if (p.audio) { try { p.audio.srcObject = null; } catch (e) {} p.audio.remove(); }
    try { if (p.dc) p.dc.close(); } catch (e) {}
    try { if (p.mc) p.mc.close(); } catch (e) {}
    delete state.peers[id];
    log('연결 정리(' + shortId(id) + '): ' + why);
    renderMembers();
  }

  // 명단에 실제로 있는 상대에게만 건다. 기본은 ID 사전순으로 작은 쪽이 걸고,
  // 큰 쪽은 한참 기다려도 안 걸려 오면 그때 건다. 시도를 다 쓰면 잠시 쉬었다가 처음부터 다시 건다.
  // (예전엔 작은 쪽이 시도를 다 쓰면 영영 안 걸고, 큰 쪽은 아예 안 걸어서 서로 기다리기만 했다)
  function connectPeer(id) {
    if (id === state.myId || !state.peer || state.peer.destroyed) return;
    var p = getPeerRec(id), now = Date.now();
    if (p.dc || p.mc || p.timer) return;      // 이미 걸려 있거나 걸리는 중
    if (state.myId > id && now - p.since < HIGHER_DIAL_MS) return;   // 반대쪽이 걸어온다
    if (p.tries >= MAX_TRIES) {
      if (now - p.lastTry < RETRY_REST_MS) return;
      p.tries = 0;
      log('잠시 쉬었다 처음부터 다시: ' + (p.name || shortId(id)));
    }

    p.tries++;
    p.lastTry = now;
    p.dir = 'out';
    log('연결 시도 ' + p.tries + '/' + MAX_TRIES + ' → ' + (p.name || shortId(id)));
    try {
      wirePeerConn(id, state.peer.connect(id, { reliable: true, metadata: { name: state.name } }));
      var call = state.peer.call(id, state.localStream, { metadata: { name: state.name } });
      if (call) wirePeerCall(id, call);
    } catch (e) {
      log('연결 시도 실패: ' + e);
    }
    armTimeout(id);
  }

  // 상대가 걸어온 연결을 받을지. 양쪽이 동시에 걸었으면 작은 ID 쪽이 건 연결만 남긴다.
  function acceptIncoming(id, kind) {
    var p = getPeerRec(id);
    if (p.dir === 'out' && (p.dc || p.mc || p.timer)) {
      if (state.myId < id) return false;   // 내가 건 게 우선. 상대가 건 건 닫는다
      log('양쪽이 동시에 걸었음 → 상대 쪽 연결을 남김: ' + shortId(id));
      abandon(p);
    } else if (p.dir === 'in' && kind === 'dc' && p.dc) {
      abandon(p);   // 상대가 새로 다시 걸었다. 들고 있던 옛 연결은 버린다
    }
    p.dir = 'in';
    if (!p.timer) armTimeout(id);
    return true;
  }

  /* ---------- 허브(명단 관리) ---------- */
  function hubBroadcastRoster() {
    var list = [{ id: state.myId, name: state.name }];
    Object.keys(state.hubMembers).forEach(function (id) {
      list.push({ id: id, name: state.hubMembers[id].name });
    });
    Object.keys(state.hubMembers).forEach(function (id) {
      var c = state.hubMembers[id].conn;
      try { if (c && c.open) c.send({ t: 'roster', list: list }); } catch (e) {}
    });
    applyRoster(list);
    log('명단 전파: ' + list.length + '명');
  }

  function claimHub() {
    if (state.isHub || state.hubPeer || !state.peer) return;   // 나간 뒤 늦게 도는 타이머
    log('허브 자리 확인 중…');
    var hp = new Peer(state.hubId, { config: ICE, debug: 0 });
    var settled = false;

    hp.on('open', function () {
      settled = true;
      state.hubPeer = hp;
      state.isHub = true;
      log('내가 허브가 되었습니다.');
      hp.on('connection', function (conn) {
        conn.on('open', function () {
          state.hubMembers[conn.peer] = { name: (conn.metadata && conn.metadata.name) || '', seen: Date.now(), conn: conn };
          log('허브: ' + shortId(conn.peer) + ' 참가');
          hubBroadcastRoster();
        });
        conn.on('data', function (msg) {
          var m = state.hubMembers[conn.peer];
          if (!m || !msg) return;
          m.seen = Date.now();
          if (msg.name) m.name = String(msg.name).slice(0, 12);
          try { conn.send({ t: 'keep-ack' }); } catch (e) {}
          if (msg.t === 'join') hubBroadcastRoster();
        });
        var gone = function () {
          if (!state.hubMembers[conn.peer]) return;
          delete state.hubMembers[conn.peer];
          log('허브: ' + shortId(conn.peer) + ' 퇴장');
          hubBroadcastRoster();
        };
        conn.on('close', gone);
        conn.on('error', gone);
      });
      hp.on('error', function (e) { log('허브 오류: ' + (e && e.type || e)); });
      renderMembers();
    });

    hp.on('error', function (err) {
      if (settled) return;
      settled = true;
      try { hp.destroy(); } catch (e) {}
      if (err && err.type === 'unavailable-id') {
        log('허브가 이미 있습니다 → 참가자로 접속');
        connectToHub();
      } else {
        log('허브 확인 실패(' + (err && err.type) + ') → 잠시 후 재시도');
        setTimeout(claimHub, 3000);
      }
    });
  }

  function connectToHub() {
    if (state.isHub || state.hubConn || !state.peer || state.peer.destroyed) return;   // 나간 뒤 늦게 도는 타이머
    var conn = state.peer.connect(state.hubId, { reliable: true, metadata: { name: state.name } });
    var opened = false;

    conn.on('open', function () {
      opened = true;
      state.hubConn = conn;
      state.hubSeen = Date.now();
      try { conn.send({ t: 'join', name: state.name }); } catch (e) {}
      log('허브에 연결됨');
    });
    conn.on('data', function (msg) {
      state.hubSeen = Date.now();
      if (msg && msg.t === 'roster') applyRoster(msg.list);
    });
    var lost = function () {
      if (state.hubConn !== conn && !opened) return;
      state.hubConn = null;
      log('허브 연결 끊김 → 허브 자리 이어받기 시도');
      setTimeout(function () { if (!state.hubConn && !state.isHub) claimHub(); }, 500 + Math.random() * 2500);
    };
    conn.on('close', lost);
    conn.on('error', function (e) { log('허브 연결 오류: ' + (e && e.type || e)); lost(); });

    // 허브 ID가 남아 있지만 실제로는 죽은 경우(앱 강제 종료 등)
    setTimeout(function () {
      if (!opened && !state.isHub) {
        log('허브가 응답하지 않습니다(유령 허브) → 자리 다시 확인');
        try { conn.close(); } catch (e) {}
        state.hubConn = null;
        claimHub();
      }
    }, 8000);
  }

  function applyRoster(list) {
    if (!list || !list.length) return;
    var next = {};
    list.forEach(function (m) {
      if (!m || !m.id) return;
      next[m.id] = m.name || '';
      if (m.id !== state.myId) {
        var p = getPeerRec(m.id);
        if (m.name) p.name = m.name;
      }
    });
    state.roster = next;
    Object.keys(next).forEach(function (id) { if (id !== state.myId) connectPeer(id); });
    renderMembers();
  }

  /* ---------- 주기 작업 ---------- */
  function tick() {
    if (state.hubConn && state.hubConn.open) {
      try { state.hubConn.send({ t: 'keep', name: state.name }); } catch (e) {}
      if (Date.now() - state.hubSeen > STALE_MS) {
        log('허브가 응답하지 않습니다 → 허브 자리 이어받기');
        try { state.hubConn.close(); } catch (e) {}
        state.hubConn = null;
        setTimeout(function () { if (!state.hubConn && !state.isHub) claimHub(); }, 300 + Math.random() * 2000);
      }
    }
    broadcast({ t: 'ping' });

    var now = Date.now();
    Object.keys(state.peers).forEach(function (id) {
      var p = state.peers[id];
      if ((p.conn || p.call) && now - p.seen > STALE_MS) dropPeer(id, '응답 없음');
    });

    if (state.isHub) {
      var changed = false;
      Object.keys(state.hubMembers).forEach(function (id) {
        if (now - state.hubMembers[id].seen > STALE_MS + KEEP_MS) {
          delete state.hubMembers[id];
          changed = true;
          log('허브: ' + shortId(id) + ' 응답 없음 → 명단에서 제거');
        }
      });
      if (changed) hubBroadcastRoster();
    }

    // 아직 못 붙은 상대 재시도
    Object.keys(state.roster).forEach(function (id) {
      if (id === state.myId) return;
      var p = state.peers[id];
      if (!p || (!p.call && !p.timer)) connectPeer(id);   // 끊겨서 정리된 상대도 다시 건다
    });

    renderMembers();
  }

  /* ---------- 화면 꺼짐 방지 ---------- */
  function keepAwake() {
    if (!navigator.wakeLock) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      state.wakeLock = lock;
      lock.addEventListener('release', function () { state.wakeLock = null; });
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      if (state.audioCtx && state.audioCtx.state === 'suspended' && state.audioCtx.resume) state.audioCtx.resume();
      if (state.peer && !state.wakeLock) keepAwake();
    }
  });

  /* ---------- 입장 / 퇴장 ---------- */
  function join() {
    var name = $('nameInput').value.trim().slice(0, 8);
    var room = $('roomInput').value.replace(/\D/g, '');
    if (!name) { joinMsg('이름을 넣어주세요.', true); return; }
    if (room.length !== 4) { joinMsg('채널 번호는 숫자 4자리입니다.', true); return; }

    state.name = name;
    state.room = room;
    state.hubId = NS + '-' + room + '-' + HUB_SUFFIX;
    state.myId = NS + '-' + room + '-' + randomId();
    try {
      localStorage.setItem(NS + ':name', name);
      localStorage.setItem(NS + ':room', room);
    } catch (e) {}

    // CDN 의 PeerJS 가 안 내려왔으면 마이크를 열기 전에 바로 알린다
    if (typeof Peer === 'undefined') {
      log('PeerJS 를 불러오지 못함');
      joinMsg('연결 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침하세요.', true);
      return;
    }

    joinMsg('마이크 권한을 확인하는 중…');
    $('joinBtn').disabled = true;
    log('입장 시도: 채널 ' + room + ' / 내 ID ' + shortId(state.myId));

    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { state.audioCtx = new AC(); if (state.audioCtx.resume) state.audioCtx.resume(); }
    } catch (e) {}

    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    }).then(function (stream) {
      state.rawStream = stream;
      state.localStream = buildMicGate(stream);
      state.micTrack = state.localStream.getAudioTracks()[0];
      setMicOpen(false);
      log('마이크 준비됨 (' + (state.gate ? '게이트 방식' : '트랙 방식') + ')');
      joinMsg('채널에 들어가는 중…');

      var peer = new Peer(state.myId, { config: ICE, debug: 0 });
      var opened = false;

      peer.on('open', function () {
        opened = true;
        state.peer = peer;
        log('브로커 접속됨');
        $('joinBtn').disabled = false;
        joinMsg('');
        $('chLabel').textContent = state.room;
        $('joinView').classList.add('hidden');
        $('talkView').classList.remove('hidden');
        keepAwake();

        peer.on('connection', function (conn) {
          if (!acceptIncoming(conn.peer, 'dc')) { try { conn.close(); } catch (e) {} return; }
          wirePeerConn(conn.peer, conn);
        });
        peer.on('call', function (call) {
          if (!acceptIncoming(call.peer, 'mc')) { try { call.close(); } catch (e) {} return; }
          if (call.metadata && call.metadata.name) getPeerRec(call.peer).name = call.metadata.name;
          call.answer(state.localStream);
          wirePeerCall(call.peer, call);
        });
        peer.on('disconnected', function () {
          log('브로커 연결 끊김 → 재접속');
          try { peer.reconnect(); } catch (e) {}
        });
        peer.on('error', function (e) {
          var type = e && e.type;
          if (type === 'peer-unavailable') { log('상대를 찾을 수 없음(이미 나갔을 수 있음)'); return; }
          log('오류: ' + type + ' ' + (e && e.message ? e.message : ''));
        });

        claimHub();
        state.timer = setInterval(tick, KEEP_MS);
        state.statsTimer = setInterval(function () { pollStats(); renderMeter(); }, 1000);
        renderMembers();
      });

      peer.on('error', function (err) {
        if (opened) return;
        $('joinBtn').disabled = false;
        log('접속 실패: ' + (err && err.type) + ' ' + (err && err.message ? err.message : ''));
        joinMsg('채널 접속에 실패했습니다 (' + (err && err.type) + '). 잠시 뒤 다시 시도해 주세요.', true);
        try { peer.destroy(); } catch (e) {}
      });
    }).catch(function (err) {
      $('joinBtn').disabled = false;
      log('마이크 실패: ' + (err && err.name));
      joinMsg('마이크를 쓸 수 없습니다: ' + (err && err.name ? err.name : '알 수 없는 오류') +
              '. 브라우저 설정에서 마이크 권한을 허용해 주세요.', true);
    });
  }

  function leave() {
    stopTalk();
    broadcast({ t: 'bye' });
    if (state.timer) clearInterval(state.timer);
    if (state.statsTimer) clearInterval(state.statsTimer);
    Object.keys(state.peers).forEach(function (id) { dropPeer(id, '내가 나감'); });
    if (state.hubPeer) { try { state.hubPeer.destroy(); } catch (e) {} }
    if (state.peer) { try { state.peer.destroy(); } catch (e) {} }
    if (state.rawStream) state.rawStream.getTracks().forEach(function (t) { t.stop(); });
    if (state.localStream) state.localStream.getTracks().forEach(function (t) { t.stop(); });
    if (state.wakeLock) { try { state.wakeLock.release(); } catch (e) {} }
    state.peer = null; state.hubPeer = null; state.hubConn = null; state.isHub = false;
    state.localStream = null; state.micTrack = null; state.wakeLock = null;
    state.peers = {}; state.roster = {}; state.hubMembers = {};
    $('talkView').classList.add('hidden');
    $('joinView').classList.remove('hidden');
    $('members').innerHTML = '';
    log('채널에서 나갔습니다.');
  }

  /* ---------- 입력 ---------- */
  $('joinBtn').addEventListener('click', join);
  $('roomInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') join(); });
  $('leaveBtn').addEventListener('click', leave);

  $('lockToggle').addEventListener('change', function (e) {
    state.locked = e.target.checked;
    if (!state.locked && state.talking) stopTalk();
    $('pttBtn').querySelector('.pttText').textContent = state.locked ? '눌러서 송신 시작' : '누르고 말하기';
  });
  $('duplexToggle').addEventListener('change', function (e) {
    state.duplex = e.target.checked;
    if (!state.duplex) duckRemotes(false);
  });

  var ptt = $('pttBtn');
  ptt.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  ptt.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try { if (e.pointerId != null) ptt.setPointerCapture(e.pointerId); } catch (_) {}
    if (state.locked) { if (state.talking) { stopTalk(); } else { startTalk(); } return; }
    startTalk();
  });
  // pointerleave 로 끊지 않는다. 버튼을 누른 채 손가락이 1mm 만 움직여도 송신이 끊겼다.
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    ptt.addEventListener(ev, function (e) {
      try { if (e.pointerId != null && ptt.hasPointerCapture(e.pointerId)) ptt.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!state.locked) stopTalk();
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && state.peer && !e.repeat && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault(); startTalk();
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.code === 'Space' && !state.locked) { e.preventDefault(); stopTalk(); }
  });

  $('copyLog').addEventListener('click', function () {
    var text = state.logs.join('\n');
    var done = function () { $('copyLog').textContent = '복사됨!'; setTimeout(function () { $('copyLog').textContent = '기록 복사'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); }
  });

  window.addEventListener('pagehide', function () { if (state.peer) leave(); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  log('앱 준비됨');
})();
