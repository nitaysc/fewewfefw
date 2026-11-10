/* Board view: squares, pieces, tap and drag input, arrows, move badges. */
(function (g) {
  const RW = (g.RW = g.RW || {});
  const U = RW.U;
  const NS = 'http://www.w3.org/2000/svg';

  class Board {
    constructor(el) {
      this.el = el;
      this.orient = 'w';
      this.pos = new Array(64).fill(null);
      this.sel = null;
      this.targets = [];
      this.interactive = false;
      this.getMoves = null; // (square) => verbose legal moves
      this.onMove = null; // (from, to, promotion, dragged)
      this.onIllegal = null; // () => void, when a dragged piece is dropped on a square it cannot go to
      el.innerHTML = '<div class="sqs"></div><svg class="arrows" viewBox="0 0 8 8"></svg><div class="pieces"></div><div class="badges"></div><div class="promo" hidden></div>';
      this.sqs = el.querySelector('.sqs');
      this.arrowsEl = el.querySelector('.arrows');
      this.piecesEl = el.querySelector('.pieces');
      this.badgesEl = el.querySelector('.badges');
      this.promoEl = el.querySelector('.promo');
      this._buildSquares();
      el.addEventListener('pointerdown', (e) => this._down(e));
      el.addEventListener('pointermove', (e) => this._moveEv(e));
      el.addEventListener('pointerup', (e) => this._up(e));
      el.addEventListener('pointercancel', () => this._cancelDrag());
    }
    xy(sq) {
      const i = U.idx(sq), f = i & 7, r = i >> 3;
      return this.orient === 'w' ? [f, r] : [7 - f, 7 - r];
    }
    _buildSquares() {
      let h = '';
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const f = this.orient === 'w' ? x : 7 - x, r = this.orient === 'w' ? y : 7 - y;
        const name = U.FILES[f] + (8 - r);
        h += '<div class="sq ' + ((f + r) % 2 ? 'dk' : 'lt') + '" data-sq="' + name + '">' +
          (x === 0 ? '<i class="rk">' + (8 - r) + '</i>' : '') + (y === 7 ? '<i class="fl">' + U.FILES[f] + '</i>' : '') + '</div>';
      }
      this.sqs.innerHTML = h;
      this.sqEl = {};
      this.sqs.querySelectorAll('.sq').forEach((d) => (this.sqEl[d.dataset.sq] = d));
    }
    setOrientation(c) {
      if (c === this.orient) return;
      this.orient = c;
      this._buildSquares();
      this._renderPieces();
      this._marks();
      this.setArrows(this.arrows || []);
      this.setBadge(this.badge);
    }
    /* chess: a Chess instance. move: the verbose move that led here (for highlight/animation). */
    setPosition(chess, move, animate) {
      this.pos = U.flat(chess);
      this.last = move ? { from: move.from, to: move.to } : null;
      this.check = null;
      if (chess.in_check()) {
        const t = chess.turn();
        const k = this.pos.findIndex((p) => p && p.type === 'k' && p.color === t);
        if (k >= 0) this.check = U.sqName(k);
      }
      this.sel = null;
      this.targets = [];
      this.hint = null;
      this.warn = null;
      this.drag = null;
      this.promoEl.hidden = true;
      this._renderPieces(animate && move ? move : null);
      this._marks();
    }
    _renderPieces(anim) {
      const frag = document.createDocumentFragment();
      const slides = [];
      if (anim) {
        slides.push([anim.from, anim.to]);
        if (anim.flags && anim.flags.includes('k')) slides.push(anim.color === 'w' ? ['h1', 'f1'] : ['h8', 'f8']);
        if (anim.flags && anim.flags.includes('q')) slides.push(anim.color === 'w' ? ['a1', 'd1'] : ['a8', 'd8']);
      }
      const later = [];
      for (let i = 0; i < 64; i++) {
        const p = this.pos[i];
        if (!p) continue;
        const sq = U.sqName(i);
        const d = document.createElement('div');
        d.className = 'pc ' + p.color + p.type;
        d.dataset.sq = sq;
        const s = slides.find((x) => x[1] === sq);
        const [x, y] = this.xy(s ? s[0] : sq);
        d.style.transform = 'translate(' + x * 100 + '%,' + y * 100 + '%)';
        if (s) { d.classList.add('slide'); later.push([d, sq]); }
        frag.appendChild(d);
      }
      this.piecesEl.replaceChildren(frag);
      if (later.length) {
        void this.piecesEl.offsetWidth;
        requestAnimationFrame(() => later.forEach(([d, sq]) => {
          const [x, y] = this.xy(sq);
          d.style.transform = 'translate(' + x * 100 + '%,' + y * 100 + '%)';
        }));
      }
    }
    _marks() {
      for (const k in this.sqEl) {
        const d = this.sqEl[k];
        d.classList.toggle('last', !!this.last && (this.last.from === k || this.last.to === k));
        d.classList.toggle('sel', this.sel === k);
        d.classList.toggle('chk', this.check === k);
        d.classList.toggle('hint', this.hint === k);
        d.classList.toggle('warn', this.warn === k);
        const t = this.targets.find((m) => m.to === k);
        d.classList.toggle('dot', !!t && !t.captured);
        d.classList.toggle('ring', !!t && !!t.captured);
      }
    }
    setHint(sq) { this.hint = sq; this._marks(); }
    setWarn(sq) { this.warn = sq; this._marks(); }
    /* Turn input on or off; `outline` marks the board as waiting for a move (used in review). */
    setInteractive(on, outline) {
      this.interactive = !!on;
      this.el.classList.toggle('live', !!on && !!outline);
      if (!on) { this.sel = null; this.targets = []; this._marks(); }
    }
    setArrows(list) {
      this.arrows = list || [];
      let h = '';
      for (const a of this.arrows) {
        const [x1, y1] = this.xy(a.from), [x2, y2] = this.xy(a.to);
        const ax = x1 + 0.5, ay = y1 + 0.5, bx = x2 + 0.5, by = y2 + 0.5;
        const len = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / len, uy = (by - ay) / len;
        const hx = bx - ux * 0.34, hy = by - uy * 0.34;
        const px = -uy, py = ux;
        h += '<g class="arrow ' + (a.kind || '') + '"><line x1="' + (ax + ux * 0.22) + '" y1="' + (ay + uy * 0.22) + '" x2="' + hx + '" y2="' + hy + '" stroke-width="0.17" stroke-linecap="round"/>' +
          '<polygon points="' + bx + ',' + by + ' ' + (hx + px * 0.24) + ',' + (hy + py * 0.24) + ' ' + (hx - px * 0.24) + ',' + (hy - py * 0.24) + '"/></g>';
      }
      this.arrowsEl.innerHTML = h;
    }
    setBadge(b) {
      this.badge = b || null;
      if (!b) { this.badgesEl.innerHTML = ''; return; }
      const [x, y] = this.xy(b.sq);
      const cls = RW.Review.CLS[b.cls];
      this.badgesEl.innerHTML = '<span class="badge c-' + b.cls + '" style="left:' + (x + 1) * 12.5 + '%;top:' + y * 12.5 + '%">' + cls.sym + '</span>';
    }
    _sqAt(e) {
      const r = this.el.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * 8), y = Math.floor(((e.clientY - r.top) / r.height) * 8);
      if (x < 0 || x > 7 || y < 0 || y > 7) return null;
      const f = this.orient === 'w' ? x : 7 - x, rr = this.orient === 'w' ? y : 7 - y;
      return U.FILES[f] + (8 - rr);
    }
    _select(sq) {
      this.sel = sq;
      this.targets = sq ? this.getMoves(sq) : [];
      if (sq && !this.targets.length) this.sel = null;
      this._marks();
    }
    _down(e) {
      if (!this.interactive || !this.promoEl.hidden) return;
      const sq = this._sqAt(e);
      if (!sq) return;
      e.preventDefault();
      if (this.sel && this.targets.some((m) => m.to === sq)) { this._try(this.sel, sq, false); return; }
      const had = this.sel;
      this._select(sq);
      if (!this.sel) return;
      const el = this.piecesEl.querySelector('.pc[data-sq="' + sq + '"]');
      this.drag = { sq, el, x: e.clientX, y: e.clientY, moved: false, wasSel: had === sq };
      try { this.el.setPointerCapture(e.pointerId); } catch (err) {}
    }
    _moveEv(e) {
      const d = this.drag;
      if (!d || !d.el) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 7) return;
      d.moved = true;
      const r = this.el.getBoundingClientRect(), s = r.width / 8;
      d.el.classList.add('drag');
      d.el.style.transform = 'translate(' + (e.clientX - r.left - s / 2) + 'px,' + (e.clientY - r.top - s * 0.85) + 'px) scale(1.5)';
      const over = this._sqAt(e);
      for (const k in this.sqEl) this.sqEl[k].classList.toggle('over', k === over && this.targets.some((m) => m.to === k));
    }
    _up(e) {
      const d = this.drag;
      this.drag = null;
      if (!d) return;
      for (const k in this.sqEl) this.sqEl[k].classList.remove('over');
      if (!d.moved) { if (d.wasSel) this._select(null); return; }
      const sq = this._sqAt(e);
      if (sq && this.targets.some((m) => m.to === sq)) { this._try(d.sq, sq, true); return; }
      this._snap(d);
      if (sq && sq !== d.sq && this.onIllegal) this.onIllegal();
    }
    _snap(d) {
      if (!d.el) return;
      d.el.classList.remove('drag');
      const [x, y] = this.xy(d.sq);
      d.el.style.transform = 'translate(' + x * 100 + '%,' + y * 100 + '%)';
    }
    _cancelDrag() { if (this.drag) { this._snap(this.drag); this.drag = null; } }
    _try(from, to, dragged) {
      const opts = this.targets.filter((m) => m.to === to);
      if (opts.some((m) => m.promotion)) {
        const color = opts[0].color;
        this.promoEl.innerHTML = ['q', 'r', 'b', 'n'].map((p) => '<button class="pc ' + color + p + '" data-p="' + p + '" aria-label="Promote to ' + U.NAME[p] + '"></button>').join('');
        this.promoEl.hidden = false;
        this.promoEl.onclick = (e) => {
          const p = e.target.dataset && e.target.dataset.p;
          this.promoEl.hidden = true;
          if (p) this.onMove(from, to, p, dragged); else { this._select(null); this._renderPieces(); }
        };
        return;
      }
      this.onMove(from, to, undefined, dragged);
    }
  }
  RW.Board = Board;
})(window);
