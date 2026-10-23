/* 테스트용 가짜 PeerJS: 같은 브라우저 안의 탭끼리 BroadcastChannel 로 브로커를 흉내낸다. */
(function () {
  var REG = 'fakepeer:reg';
  function reg() { try { return JSON.parse(localStorage.getItem(REG) || '{}'); } catch (e) { return {}; } }
  function claim(id) { var r = reg(); if (r[id]) return false; r[id] = 1; localStorage.setItem(REG, JSON.stringify(r)); return true; }
  function release(id) { var r = reg(); delete r[id]; localStorage.setItem(REG, JSON.stringify(r)); }

  function E() { this._h = {}; }
  E.prototype.on = function (e, f) { (this._h[e] = this._h[e] || []).push(f); return this; };
  E.prototype._emit = function (e) { var a = [].slice.call(arguments, 1); (this._h[e] || []).forEach(function (f) { f.apply(null, a); }); };

  var openConns = {};   // peerId -> [Conn]

  // 연결마다 고유 채널(cid)을 쓴다. 예전엔 두 사람 사이 모든 연결이 한 채널을 같이 써서,
  // 양쪽이 동시에 걸면 hello/closed 가 서로 섞여 엉뚱한 연결이 열리고 닫혔다.
  function Conn(me, remote, kind, cid) {
    E.call(this);
    (openConns[me] = openConns[me] || []).push(this);
    var self = this;
    this.peer = remote; this.open = false; this._me = me;
    this._ch = new BroadcastChannel(kind + ':' + cid);
    this._ch.onmessage = function (ev) {
      var d = ev.data;
      if (d.from === me || self._closed) return;
      if (d.t === 'hello' || d.t === 'hello-ack') {
        if (!self.open) { self.open = true; self._emit('open'); }
        if (d.t === 'hello') self._ch.postMessage({ from: me, t: 'hello-ack' });
      } else if (d.t === 'msg') { self._emit('data', d.payload); }
      else if (d.t === 'closed') { self._closed = true; self.open = false; self._emit('close'); try { self._ch.close(); } catch (e) {} }
    };
  }
  Conn.prototype = Object.create(E.prototype);
  Conn.prototype._hello = function () { this._ch.postMessage({ from: this._me, t: 'hello' }); };
  Conn.prototype.send = function (p) { this._ch.postMessage({ from: this._me, t: 'msg', payload: p }); };
  // 한 번 닫힌 연결은 더 듣지 않는다 — 상대가 되돌려 보내는 closed 로 close 가 또 나가는 핑퐁을 막는다
  Conn.prototype.close = function () {
    if (this._closed) return;
    this._closed = true;
    try { this._ch.postMessage({ from: this._me, t: 'closed' }); } catch (e) {}
    this.open = false;
    this._emit('close');
    try { this._ch.close(); } catch (e) {}
  };

  function Peer(id) {
    E.call(this);
    var self = this;
    this.id = id; this.destroyed = false; this._claimed = false;
    setTimeout(function () {
      if (!claim(id)) { self._emit('error', { type: 'unavailable-id' }); return; }
      self._claimed = true;
      self._bus = new BroadcastChannel('fakepeer');
      self._bus.onmessage = function (ev) {
        var d = ev.data;
        if (d.to !== self.id) return;
        if (d.t === 'connect') { var c = new Conn(self.id, d.from, 'dc', d.cid); c.metadata = d.meta; self._emit('connection', c); c._hello(); }
        if (d.t === 'call') {
          var m = new Conn(self.id, d.from, 'mc', d.cid);
          m.metadata = d.meta;
          m.answer = function (s) { m._hello(); setTimeout(function () { m._emit('stream', s || {}); }, 10); };
          self._emit('call', m);
        }
      };
      window.addEventListener('pagehide', function () { if (self._claimed) release(id); });
      self._emit('open', id);
    }, 20);
  }
  Peer.prototype = Object.create(E.prototype);
  function newCid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  Peer.prototype.connect = function (target, opts) {
    var self = this, live = !!reg()[target], cid = newCid(), c = new Conn(this.id, target, 'dc', cid);
    if (!live) { setTimeout(function () { self._emit('error', { type: 'peer-unavailable' }); }, 10); return c; }
    new BroadcastChannel('fakepeer').postMessage({ to: target, from: this.id, t: 'connect', meta: opts && opts.metadata, cid: cid });
    setTimeout(function () { c._hello(); }, 30);
    return c;
  };
  Peer.prototype.call = function (target, stream, opts) {
    var self = this, live = !!reg()[target], cid = newCid(), c = new Conn(this.id, target, 'mc', cid);
    if (!live) { setTimeout(function () { self._emit('error', { type: 'peer-unavailable' }); }, 10); return c; }
    new BroadcastChannel('fakepeer').postMessage({ to: target, from: this.id, t: 'call', meta: opts && opts.metadata, cid: cid });
    setTimeout(function () { c._hello(); c._emit('stream', stream); }, 40);
    return c;
  };
  Peer.prototype.destroy = function () {
    this.destroyed = true;
    (openConns[this.id] || []).forEach(function (c) { try { c.close(); } catch (e) {} });
    openConns[this.id] = [];
    if (this._claimed) { release(this.id); this._claimed = false; }   // 남이 차지한 ID를 지우면 안 된다
  };
  Peer.prototype.reconnect = function () {};
  window.Peer = Peer;
})();
