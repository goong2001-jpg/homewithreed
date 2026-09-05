/* 집무전기 — 폰 마이크 + 스피커로 쓰는 PTT 무전기
 * 서버 없이 동작합니다. 신호 교환은 PeerJS 공개 브로커, 음성은 브라우저끼리 직접(P2P).
 * 채널 번호로 슬롯 6개(rw-<채널>-1 ~ -6)를 만들어 빈 자리를 차지하는 방식입니다.
 */
(function () {
  'use strict';

  var NS = 'hwr-wt';          // 다른 서비스와 ID가 겹치지 않게 하는 접두사
  var SLOTS = 6;              // 채널당 최대 인원
  var ICE = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // 무료 공개 TURN (LTE↔LTE 등 직접 연결이 막힐 때 중계). 불안정하면 자기 TURN으로 교체.
      {
        urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  };

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    name: '',
    room: '',
    slot: 0,
    peer: null,
    localStream: null,
    micTrack: null,
    talking: false,
    locked: false,
    duplex: true,            // 말하는 동안 상대 소리 줄이기
    calls: {},               // slot -> MediaConnection (연결 완료)
    conns: {},               // slot -> DataConnection (open 된 것만)
    pending: {},             // 'd3' / 'c3' -> 시도 중인 연결 (빈 슬롯이면 시간이 지나 버려진다)
    names: {},               // slot -> 이름
    talkers: {},             // slot -> true
    lastSeen: {},            // slot -> 마지막 신호 시각 (끊긴 사람 정리용)
    audios: {},              // slot -> HTMLAudioElement
    wakeLock: null,
    scanTimer: null,
    audioCtx: null
  };

  /* ---------- 저장된 값 ---------- */
  try {
    $('nameInput').value = localStorage.getItem(NS + ':name') || '';
    $('roomInput').value = localStorage.getItem(NS + ':room') || '';
  } catch (e) { /* 시크릿 모드 등 */ }

  /* ---------- 유틸 ---------- */
  function peerId(room, slot) { return NS + '-' + room + '-' + slot; }

  function setStatus(text) { $('statusLine').textContent = text; }

  function joinMsg(text, isError) {
    var el = $('joinMsg');
    el.textContent = text || '';
    el.className = 'msg' + (isError ? ' error' : '');
  }

  function beep(freq, ms) {
    try {
      if (!state.audioCtx) return;
      var ctx = state.audioCtx;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + ms / 1000);
    } catch (e) { /* 무시 */ }
  }

  /* ---------- 화면 갱신 ---------- */
  function renderMembers() {
    var ul = $('members');
    ul.innerHTML = '';
    var mine = document.createElement('li');
    mine.className = 'me' + (state.talking ? ' talking' : '');
    mine.textContent = (state.name || '나') + ' (나)';
    ul.appendChild(mine);

    var count = 1;
    Object.keys(state.conns).forEach(function (slot) {
      var li = document.createElement('li');
      li.className = state.talkers[slot] ? 'talking' : '';
      li.textContent = state.names[slot] || ('무전기 ' + slot);
      ul.appendChild(li);
      count++;
    });

    setStatus(count > 1 ? '연결됨 · ' + count + '명' : '혼자 있습니다. 상대가 같은 채널로 들어오면 연결됩니다.');

    var talking = Object.keys(state.talkers).filter(function (s) { return state.talkers[s]; });
    $('nowTalking').textContent = talking.length
      ? '🔊 ' + talking.map(function (s) { return state.names[s] || ('무전기 ' + s); }).join(', ') + ' 말하는 중'
      : ' ';
  }

  /* ---------- 오디오 ---------- */
  function attachStream(slot, stream) {
    var el = state.audios[slot];
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      state.audios[slot] = el;
      $('audioSink').appendChild(el);
    }
    try { el.srcObject = stream; } catch (e) { return; }
    el.volume = state.talking && state.duplex ? 0.15 : 1;
    var p = el.play();
    if (p && p.catch) p.catch(showUnlock);
  }

  var unlockBtn = null;
  function showUnlock() {
    if (unlockBtn) return;
    unlockBtn = document.createElement('button');
    unlockBtn.className = 'unlock';
    unlockBtn.textContent = '🔈 소리 켜기 (한 번 눌러주세요)';
    unlockBtn.onclick = function () {
      Object.keys(state.audios).forEach(function (s) {
        var p = state.audios[s].play();
        if (p && p.catch) p.catch(function () {});
      });
      if (state.audioCtx && state.audioCtx.resume) state.audioCtx.resume();
      unlockBtn.remove();
      unlockBtn = null;
    };
    $('talkView').appendChild(unlockBtn);
  }

  function duckRemotes(on) {
    var v = on ? 0.15 : 1;
    Object.keys(state.audios).forEach(function (s) { state.audios[s].volume = v; });
  }

  /* ---------- 송신 ---------- */
  function startTalk() {
    if (state.talking || !state.micTrack) return;
    state.talking = true;
    state.micTrack.enabled = true;
    if (state.duplex) duckRemotes(true);
    $('pttBtn').classList.add('on');
    $('pttBtn').querySelector('.pttText').textContent = '송신 중…';
    broadcast({ t: 'talk', on: true });
    beep(880, 90);
    renderMembers();
  }

  function stopTalk() {
    if (!state.talking) return;
    state.talking = false;
    if (state.micTrack) state.micTrack.enabled = false;
    duckRemotes(false);
    $('pttBtn').classList.remove('on');
    $('pttBtn').querySelector('.pttText').textContent = state.locked ? '눌러서 송신 시작' : '누르고 말하기';
    broadcast({ t: 'talk', on: false });
    beep(520, 70);
    renderMembers();
  }

  function broadcast(msg) {
    msg.name = state.name;
    Object.keys(state.conns).forEach(function (slot) {
      var c = state.conns[slot];
      try { if (c && c.open) c.send(msg); } catch (e) { /* 무시 */ }
    });
  }

  /* ---------- 연결 ---------- */
  function wireData(slot, conn) {
    var key = 'd' + slot;
    state.pending[key] = conn;
    // 빈 슬롯에 건 연결은 아무 신호도 오지 않는다. 일정 시간 뒤 버려서 다음 스캔 때 다시 걸게 한다.
    var giveUp = setTimeout(function () { if (state.pending[key] === conn) delete state.pending[key]; }, 6000);

    conn.on('open', function () {
      clearTimeout(giveUp);
      delete state.pending[key];
      state.conns[slot] = conn;
      state.lastSeen[slot] = Date.now();
      try { conn.send({ t: 'hi', name: state.name }); } catch (e) {}
      renderMembers();
    });
    var drop = function () {
      clearTimeout(giveUp);
      delete state.pending[key];
      delete state.conns[slot];
      delete state.talkers[slot];
      delete state.names[slot];
      delete state.lastSeen[slot];
      renderMembers();
    };

    conn.on('data', function (msg) {
      if (!msg || typeof msg !== 'object') return;
      if (msg.name) state.names[slot] = String(msg.name).slice(0, 12);
      // 'hi' 에는 'hi-ack' 으로만 답한다. 'hi' 로 답하면 서로 끝없이 주고받는다.
      if (msg.t === 'hi') { try { conn.send({ t: 'hi-ack', name: state.name }); } catch (e) {} }
      if (msg.t === 'talk') state.talkers[slot] = !!msg.on;
      state.lastSeen[slot] = Date.now();
      if (msg.t === 'bye') { drop(); return; }
      renderMembers();
    });
    conn.on('close', drop);
    conn.on('error', drop);
  }

  function wireCall(slot, call) {
    var key = 'c' + slot;
    state.pending[key] = call;
    var giveUp = setTimeout(function () { if (state.pending[key] === call) delete state.pending[key]; }, 6000);

    call.on('stream', function (stream) {
      clearTimeout(giveUp);
      delete state.pending[key];
      state.calls[slot] = call;
      attachStream(slot, stream);
    });
    var drop = function () {
      clearTimeout(giveUp);
      delete state.pending[key];
      delete state.calls[slot];
      if (state.audios[slot]) { state.audios[slot].srcObject = null; state.audios[slot].remove(); delete state.audios[slot]; }
    };
    call.on('close', drop);
    call.on('error', drop);
  }

  function connectSlot(slot) {
    if (slot === state.slot || !state.peer || state.peer.destroyed) return;
    var target = peerId(state.room, slot);
    var meta = { slot: state.slot, name: state.name };

    if (!state.conns[slot] && !state.pending['d' + slot]) {
      var conn = state.peer.connect(target, { reliable: true, metadata: meta });
      if (conn) wireData(slot, conn);
    }
    if (!state.calls[slot] && !state.pending['c' + slot] && state.localStream) {
      var call = state.peer.call(target, state.localStream, { metadata: meta });
      if (call) wireCall(slot, call);
    }
  }

  function slotOf(id) {
    var m = String(id || '').match(/-(\d+)$/);
    return m ? Number(m[1]) : 0;
  }

  function openPeerAtSlot(slot, done) {
    if (slot > SLOTS) { done(new Error('채널이 꽉 찼습니다 (최대 ' + SLOTS + '명).')); return; }
    var peer = new Peer(peerId(state.room, slot), { config: ICE, debug: 0 });
    var settled = false;

    peer.on('open', function () {
      if (settled) return;
      settled = true;
      state.peer = peer;
      state.slot = slot;
      done(null);
    });

    peer.on('error', function (err) {
      if (err && err.type === 'unavailable-id' && !settled) {
        settled = true;
        try { peer.destroy(); } catch (e) {}
        openPeerAtSlot(slot + 1, done);
        return;
      }
      if (!settled) {
        settled = true;
        try { peer.destroy(); } catch (e) {}
        done(err);
        return;
      }
      // 연결 후 발생하는 오류: 빈 슬롯 호출은 정상이므로 조용히 무시
      if (err && (err.type === 'peer-unavailable' || err.type === 'network')) return;
      console.warn('peer error', err && err.type, err);
    });
  }

  function afterOpen() {
    state.peer.on('connection', function (conn) {
      var s = slotOf(conn.peer);
      if (s) wireData(s, conn);
    });

    state.peer.on('call', function (call) {
      var s = slotOf(call.peer);
      call.answer(state.localStream);
      if (s) wireCall(s, call);
    });

    state.peer.on('disconnected', function () {
      setStatus('브로커 연결이 끊겼습니다. 다시 연결 중…');
      try { state.peer.reconnect(); } catch (e) {}
    });

    for (var s = 1; s <= SLOTS; s++) connectSlot(s);
    state.scanTimer = setInterval(function () {
      for (var s = 1; s <= SLOTS; s++) connectSlot(s);
      broadcast({ t: 'ping' });
      // 16초 넘게 소식이 없으면 끊긴 것으로 보고 목록에서 지운다 (앱이 강제 종료된 경우)
      var now = Date.now();
      Object.keys(state.conns).forEach(function (slot) {
        if (now - (state.lastSeen[slot] || 0) > 16000) {
          try { state.conns[slot].close(); } catch (e) {}
          delete state.conns[slot];
          delete state.talkers[slot];
          delete state.names[slot];
          delete state.lastSeen[slot];
        }
      });
      renderMembers();
    }, 5000);

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
    if (document.visibilityState === 'visible' && state.peer && !state.wakeLock) keepAwake();
  });

  /* ---------- 입장 / 퇴장 ---------- */
  function join() {
    var name = $('nameInput').value.trim().slice(0, 8);
    var room = $('roomInput').value.replace(/\D/g, '');
    if (!name) { joinMsg('이름을 넣어주세요.', true); return; }
    if (room.length !== 4) { joinMsg('채널 번호는 숫자 4자리입니다.', true); return; }

    state.name = name;
    state.room = room;
    try {
      localStorage.setItem(NS + ':name', name);
      localStorage.setItem(NS + ':room', room);
    } catch (e) {}

    joinMsg('마이크 권한을 확인하는 중…');
    $('joinBtn').disabled = true;

    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { state.audioCtx = new AC(); if (state.audioCtx.resume) state.audioCtx.resume(); }
    } catch (e) {}

    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    }).then(function (stream) {
      state.localStream = stream;
      state.micTrack = stream.getAudioTracks()[0];
      state.micTrack.enabled = false;             // 기본은 송신 꺼짐(PTT)
      joinMsg('채널에 들어가는 중…');
      openPeerAtSlot(1, function (err) {
        $('joinBtn').disabled = false;
        if (err) { joinMsg(err.message || '연결에 실패했습니다. 잠시 뒤 다시 시도해 주세요.', true); return; }
        joinMsg('');
        $('chLabel').textContent = state.room;
        $('joinView').classList.add('hidden');
        $('talkView').classList.remove('hidden');
        keepAwake();
        afterOpen();
      });
    }).catch(function (err) {
      $('joinBtn').disabled = false;
      joinMsg('마이크를 쓸 수 없습니다: ' + (err && err.name ? err.name : '알 수 없는 오류') +
              '. 브라우저 설정에서 마이크 권한을 허용해 주세요.', true);
    });
  }

  function leave() {
    stopTalk();
    broadcast({ t: 'bye' });
    if (state.scanTimer) clearInterval(state.scanTimer);
    Object.keys(state.audios).forEach(function (s) { state.audios[s].srcObject = null; state.audios[s].remove(); });
    if (state.peer) { try { state.peer.destroy(); } catch (e) {} }
    if (state.localStream) state.localStream.getTracks().forEach(function (t) { t.stop(); });
    if (state.wakeLock) { try { state.wakeLock.release(); } catch (e) {} }
    state.peer = null; state.localStream = null; state.micTrack = null; state.wakeLock = null;
    state.calls = {}; state.conns = {}; state.pending = {}; state.names = {}; state.talkers = {}; state.lastSeen = {}; state.audios = {};
    $('talkView').classList.add('hidden');
    $('joinView').classList.remove('hidden');
    $('members').innerHTML = '';
  }

  /* ---------- 입력 바인딩 ---------- */
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
    if (state.locked) { state.talking ? stopTalk() : startTalk(); return; }
    startTalk();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
    ptt.addEventListener(ev, function () { if (!state.locked) stopTalk(); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && state.peer && !e.repeat && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault(); startTalk();
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.code === 'Space' && !state.locked) { e.preventDefault(); stopTalk(); }
  });

  window.addEventListener('pagehide', function () { if (state.peer) leave(); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
