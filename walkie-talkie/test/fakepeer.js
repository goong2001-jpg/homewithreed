/* 테스트용 가짜 PeerJS: 같은 브라우저 안의 탭끼리 BroadcastChannel 로 브로커를 흉내낸다. */
(function () {
  var REG = 'fakepeer:reg';
  function reg() { try { return JSON.parse(localStorage.getItem(REG) || '{}'); } catch (e) { return {}; } }
  function claim(id) { var r = reg(); if (r[id]) return false; r[id] = 1; localStorage.setItem(REG, JSON.stringify(r)); return true; }
  function release(id) { var r = reg(); delete r[id]; localStorage.setItem(REG, JSON.stringify(r)); }

  function E() { this._h = {}; }
  E.prototype.on = function (e, f) { (this._h[e] = this._h[e] || []).push(f); return this; };
  E.prototype._emit = function (e) { var a = [].slice.call(arguments, 1); (this._h[e] || []).forEach(function (f) { f.apply(null, a); }); };

  function Conn(me, remote, kind) {
    E.call(this);
    var self = this;
    this.peer = remote; this.open = false; this._me = me;
    this._ch = new BroadcastChannel(kind + ':' + [me, remote].sort().join('|'));
    this._ch.onmessage = function (ev) {
      var d = ev.data;
      if (d.from === me) return;
      if (d.t === 'hello' || d.t === 'hello-ack') {
        if (!self.open) { self.open = true; self._emit('open'); }
        if (d.t === 'hello') self._ch.postMessage({ from: me, t: 'hello-ack' });
      } else if (d.t === 'msg') { self._emit('data', d.payload); }
    };
  }
  Conn.prototype = Object.create(E.prototype);
  Conn.prototype._hello = function () { this._ch.postMessage({ from: this._me, t: 'hello' }); };
  Conn.prototype.send = function (p) { this._ch.postMessage({ from: this._me, t: 'msg', payload: p }); };
  Conn.prototype.close = function () { this._emit('close'); };

  function Peer(id) {
    E.call(this);
    var self = this;
    this.id = id; this.destroyed = false;
    setTimeout(function () {
      if (!claim(id)) { self._emit('error', { type: 'unavailable-id' }); return; }
      self._bus = new BroadcastChannel('fakepeer');
      self._bus.onmessage = function (ev) {
        var d = ev.data;
        if (d.to !== self.id) return;
        if (d.t === 'connect') { var c = new Conn(self.id, d.from, 'dc'); self._emit('connection', c); c._hello(); }
        if (d.t === 'call') {
          var m = new Conn(self.id, d.from, 'mc');
          m.answer = function (s) { m._hello(); setTimeout(function () { m._emit('stream', s || {}); }, 10); };
          self._emit('call', m);
        }
      };
      window.addEventListener('pagehide', function () { release(id); });
      self._emit('open', id);
    }, 20);
  }
  Peer.prototype = Object.create(E.prototype);
  Peer.prototype.connect = function (target) {
    var self = this, live = !!reg()[target], c = new Conn(this.id, target, 'dc');
    if (!live) { setTimeout(function () { self._emit('error', { type: 'peer-unavailable' }); }, 10); return c; }
    new BroadcastChannel('fakepeer').postMessage({ to: target, from: this.id, t: 'connect' });
    setTimeout(function () { c._hello(); }, 30);
    return c;
  };
  Peer.prototype.call = function (target, stream) {
    var self = this, live = !!reg()[target], c = new Conn(this.id, target, 'mc');
    if (!live) { setTimeout(function () { self._emit('error', { type: 'peer-unavailable' }); }, 10); return c; }
    new BroadcastChannel('fakepeer').postMessage({ to: target, from: this.id, t: 'call' });
    setTimeout(function () { c._hello(); c._emit('stream', stream); }, 40);
    return c;
  };
  Peer.prototype.destroy = function () { this.destroyed = true; release(this.id); };
  Peer.prototype.reconnect = function () {};
  window.Peer = Peer;
})();
