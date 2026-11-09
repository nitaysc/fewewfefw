/* Stockfish (WASM, in a Web Worker) behind a small promise queue. */
(function (g) {
  const RW = (g.RW = g.RW || {});

  class Engine {
    constructor(path) {
      this.q = [];
      this.cur = null;
      this.ready = false;
      this.failed = false;
      this.readyP = new Promise((res) => (this._ready = res));
      try {
        this.w = new Worker(path);
        this.w.onmessage = (e) => this._line(typeof e.data === 'string' ? e.data : String(e.data));
        this.w.onerror = () => this._fail();
        this.w.postMessage('uci');
      } catch (e) {
        this._fail();
      }
    }
    _fail() {
      this.failed = true;
      this._ready(false);
      if (this.cur) this.cur.res(null);
      this.q.forEach((j) => j.res(null));
      this.q = [];
      this.cur = null;
    }
    _post(s) { this.w.postMessage(s); }
    _line(l) {
      if (l === 'uciok') {
        this._post('setoption name Hash value 32');
        this._post('isready');
      } else if (l === 'readyok' && !this.ready) {
        this.ready = true;
        this._ready(true);
        this._next();
      } else if (this.cur) {
        const j = this.cur;
        if (l.startsWith('info ') && l.includes(' pv ')) {
          if (/ (upper|lower)bound /.test(l) && j.lines[+(/ multipv (\d+)/.exec(l) || [0, 1])[1]]) return;
          const sc = / score (cp|mate) (-?\d+)/.exec(l);
          if (!sc) return;
          const mpv = +(/ multipv (\d+)/.exec(l) || [0, 1])[1];
          const line = { depth: +(/ depth (\d+)/.exec(l) || [0, 0])[1], pv: l.split(' pv ')[1].trim().split(/\s+/) };
          if (sc[1] === 'cp') line.cp = +sc[2]; else line.mate = +sc[2];
          j.lines[mpv] = line;
        } else if (l.startsWith('bestmove')) {
          this.cur = null;
          const best = l.split(' ')[1];
          const lines = Object.keys(j.lines).sort((a, b) => a - b).map((k) => j.lines[k]);
          j.res(j.cancelled ? null : { best: best && best !== '(none)' ? best : null, lines });
          this._next();
        }
      }
    }
    _next() {
      if (!this.ready || this.cur || !this.q.length) return;
      const j = (this.cur = this.q.shift());
      const o = j.o;
      this._post('setoption name MultiPV value ' + (o.multipv || 1));
      this._post('position fen ' + j.fen);
      this._post('go' + (o.depth ? ' depth ' + o.depth : '') + (o.movetime ? ' movetime ' + o.movetime : ''));
    }
    /* Search a position. Resolves {best, lines:[{cp|mate, pv, depth}]} with scores
       from the side to move, or null if cancelled or the engine is unavailable. */
    analyse(fen, o) {
      if (this.failed) return Promise.resolve(null);
      return new Promise((res) => {
        this.q.push({ fen, o: o || {}, res, lines: {} });
        this._next();
      });
    }
    cancelAll() {
      this.q.forEach((j) => j.res(null));
      this.q = [];
      if (this.cur) {
        this.cur.cancelled = true;
        this._post('stop');
      }
    }
  }

  RW.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
