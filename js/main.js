/* =========================================================
   ALCHEMY — UI / 인터랙션
   ========================================================= */
(function () {
  'use strict';
  var C = window.ALCHEMY_CONFIG || {};
  var A = window.AlchemyAudio;
  var Jam = A.Jam;
  var L = C.links || {};
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var INK = '#111', BLUE = '#1d5cc8', BLUE_SOFT = '#a9c3ea', BLUE_PALE = '#e9f0fb', GRAY = '#8a8a8a';
  var PIXF = '"DotGothic16", ui-monospace, monospace', SANS = '"Pretendard", system-ui, sans-serif';
  var NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function noteName(m) { return NN[m % 12] + (Math.floor(m / 12) - 1); }

  /* ---------- 날짜 (테스트용 ?now= 지원) ---------- */
  var NOW = (function () {
    var q = new URLSearchParams(location.search).get('now');
    var d = q ? new Date(q.length <= 10 ? q + 'T12:00:00+09:00' : q) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  })();
  function kstDay(d) { return Math.floor((d.getTime() + 9 * 3600000) / 86400000); }

  /* ---------- 픽셀 아이콘 ---------- */
  var PIX = {
    guitar: ['........##', '.......##.', '......##..', '.....##...', '..##.#....', '.####.....', '#####.....', '####......', '.##.......'],
    bass:   ['.........#', '........##', '.......#..', '......#...', '.....#....', '...##.....', '..###.....', '.####.....', '..##......'],
    drums:  ['##......##', '.#......#.', '..######..', '.#......#.', '.#.####.#.', '.#.#..#.#.', '.#.####.#.', '..######..', '.#......#.'],
    keys:   ['##########', '#.#.##.#.#', '#.#.##.#.#', '#.#.##.#.#', '#..#..#..#', '#..#..#..#', '##########'],
    vocal:  ['...####...', '..#....#..', '..#.##.#..', '..#....#..', '...####...', '....##....', '.#..##..#.', '..#.##.#..', '...####...', '....##....'],
    camera: ['..###.....', '##########', '#...##...#', '#..#..#..#', '#..#..#..#', '#...##...#', '##########'],
    tent:   ['....#.....', '...###....', '..##.##...', '.##...##..', '##..#..##.', '#...#...##'],
    note:   ['...######', '...#....#', '...#....#', '...#....#', '.###..###', '####.####', '.##...##.']
  };
  function pixSVG(name) {
    var rows = PIX[name]; if (!rows) return '';
    var h = rows.length, w = rows[0].length, r = '';
    rows.forEach(function (row, y) { for (var x = 0; x < w; x++) if (row[x] === '#') r += '<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02"/>'; });
    return '<svg class="pix" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true" shape-rendering="crispEdges">' + r + '</svg>';
  }
  $$('[data-pix]').forEach(function (el) { el.innerHTML = pixSVG(el.getAttribute('data-pix')); });

  /* ---------- 로고 이미지 교체 (옵션) ---------- */
  if (C.logoSrc) $$('.logo').forEach(function (el) {
    el.innerHTML = '<img src="' + C.logoSrc + '" alt="アルケミ ALCHEMY 로고">'; el.classList.add('logo-img');
  });

  /* ---------- 링크 ---------- */
  $$('[data-link]').forEach(function (a) {
    var u = L[a.getAttribute('data-link')];
    if (u) a.href = u; else a.hidden = true;
  });

  /* ---------- 오디오 언락 / 사운드 버튼 ---------- */
  document.addEventListener('pointerdown', function () { A.ensure(); }, { capture: true, passive: true });
  document.addEventListener('keydown', function () { A.ensure(); }, { capture: true });
  var soundBtn = $('#soundBtn');
  soundBtn.addEventListener('click', function () {
    var m = !A.isMuted(); A.setMuted(m);
    soundBtn.setAttribute('aria-pressed', String(!m));
    soundBtn.querySelector('.sb-t').textContent = m ? 'SOUND OFF' : 'SOUND ON';
  });

  /* ---------- 악기별 음량 슬라이더 ---------- */
  function paintVol(el) {
    var pct = Math.round(parseFloat(el.value) * 100);
    el.style.setProperty('--vp', pct + '%');
  }
  $$('.vol').forEach(function (el) {
    paintVol(el);
    el.addEventListener('input', function () {
      A.ensure();
      A.setLevel(el.getAttribute('data-vol'), parseFloat(el.value));
      paintVol(el);
    });
    el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  });

  /* ---------- 연주 진행도 ---------- */
  var played = new Set();
  var heroDone = $('#heroDone');
  function markPlayed(part) {
    if (played.has(part)) return;
    played.add(part);
    var inst = $('.inst-' + part); if (inst) inst.classList.add('played');
    $('#progCount').textContent = played.size;
    $$('.prog-dots li').forEach(function (li) { li.classList.toggle('on', played.has(li.getAttribute('data-part'))); });
    $$('[data-played-badge]').forEach(function (el) { el.classList.toggle('on', played.has(el.getAttribute('data-played-badge'))); });
    $$('.tab').forEach(function (t) { t.classList.toggle('done', played.has(t.getAttribute('data-tab'))); });
    if (played.size === 4 && heroDone.hidden) { heroDone.hidden = false; }
  }

  /* =========================================================
     현악기 (기타 / 베이스) — canvas
     ========================================================= */
  var SHAPES = { G: [3, 2, 0, 0, 0, 3], C: [-1, 3, 2, 0, 1, 0], D: [-1, -1, 0, 2, 3, 2], Em: [0, 2, 2, 0, 0, 0], Bm: [-1, 2, 4, 4, 3, 2], Am: [-1, 0, 2, 2, 1, 0] };
  var GOPEN = [40, 45, 50, 55, 59, 64];
  var CHORDS = {};
  Object.keys(SHAPES).forEach(function (k) { CHORDS[k] = SHAPES[k].map(function (f, i) { return f < 0 ? null : GOPEN[i] + f; }); });

  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function StringInst(canvas, opt) {
    var self = this;
    this.cv = canvas; this.g = canvas.getContext('2d'); this.o = opt; this.n = opt.strings.length;
    this.amp = new Float32Array(this.n); this.ph = new Float32Array(this.n);
    this.handles = []; this.lastHit = []; this.flashes = [];
    this.down = false; this.lastY = 0; this.lastT = 0; this.chord = null; this.chordName = null; this.hintPC = null;
    this.w = 0; this.h = 0; this.ys = null; this.dirty = true;
    this.resize();
    if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(canvas.parentElement);
    else window.addEventListener('resize', function () { self.resize(); });
    canvas.addEventListener('pointerdown', function (e) { self.onDown(e); });
    canvas.addEventListener('pointermove', function (e) { self.onMove(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { canvas.addEventListener(t, function () { self.down = false; }); });
  }
  StringInst.prototype.resize = function () {
    var r = this.cv.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout(); this.draw();
  };
  StringInst.prototype.layout = function () {
    var o = this.o, w = this.w, h = this.h, top = h * 0.17, bot = h * 0.83, i, k;
    this.ys = []; for (i = 0; i < this.n; i++) this.ys.push(top + ((bot - top) * i) / (this.n - 1));
    this.gap = (bot - top) / (this.n - 1);
    this.x0 = Math.max(28, w * 0.075); this.x1 = w * o.neckEnd;
    var ws = [], tot = 0; for (k = 0; k < o.frets; k++) { ws.push(Math.pow(0.94, k)); tot += ws[k]; }
    this.fx = [this.x0]; var acc = this.x0;
    for (k = 0; k < o.frets; k++) { acc += ((this.x1 - this.x0) * ws[k]) / tot; this.fx.push(acc); }
    this.bridge = w - Math.max(30, (w - this.x1) * 0.2);
  };
  StringInst.prototype.pos = function (e) { var r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  StringInst.prototype.nearest = function (y) {
    var best = -1, bd = 1e9;
    this.ys.forEach(function (sy, i) { var d = Math.abs(sy - y); if (d < bd) { bd = d; best = i; } });
    return bd <= this.gap * 0.5 ? best : -1;
  };
  StringInst.prototype.fretAt = function (x) {
    if (x == null || !this.fx || x <= this.x0 || x >= this.fx[this.fx.length - 1]) return 0;
    for (var f = 1; f < this.fx.length; f++) if (x <= this.fx[f]) return f;
    return 0;
  };
  StringInst.prototype.onDown = function (e) {
    e.preventDefault(); A.ensure(); this.down = true;
    try { this.cv.setPointerCapture(e.pointerId); } catch (err) {}
    var p = this.pos(e); this.lastY = p.y; this.lastT = performance.now();
    var i = this.nearest(p.y); if (i >= 0) this.pluck(i, 0.85, p.x);
  };
  StringInst.prototype.onMove = function (e) {
    if (!this.down || !this.ys) return;
    var p = this.pos(e), now = performance.now(), dy = p.y - this.lastY, self = this;
    if (dy === 0) return;
    var dt = Math.max(1, now - this.lastT);
    var vel = Math.min(1, Math.max(0.4, 0.4 + (Math.abs(dy) / dt) * 0.35));
    var idx = [];
    this.ys.forEach(function (sy, i) { if ((self.lastY < sy && p.y >= sy) || (self.lastY > sy && p.y <= sy)) idx.push(i); });
    if (dy < 0) idx.reverse();
    idx.forEach(function (i) { self.pluck(i, vel, p.x); });
    this.lastY = p.y; this.lastT = now;
  };
  StringInst.prototype.pluck = function (i, vel, x) {
    var now = performance.now();
    if (now - (this.lastHit[i] || 0) < 45) return;
    this.lastHit[i] = now;
    var o = this.o, midi, label;
    if (o.type === 'guitar') midi = this.chord ? this.chord[i] : o.strings[i];
    else midi = o.strings[i] + this.fretAt(x);
    if (this.handles[i]) this.handles[i].stop();
    if (midi == null) { this.handles[i] = A.mute(o.strings[i], vel); label = 'x'; }
    else { this.handles[i] = o.type === 'guitar' ? A.guitar(midi, vel) : A.bass(midi, vel); label = noteName(midi); }
    if (this.ys) {
      this.amp[i] = midi == null ? 1.2 : Math.min(this.gap * 0.32, 2.5 + 5 * vel);
      this.ph[i] = Math.random() * 6.28;
      var fxp = x == null ? (this.x1 + this.bridge) / 2 : Math.min(Math.max(x, 20), this.w - 20);
      this.flashes.push({ t: label, x: fxp, y: this.ys[i] - 9, life: 1 });
      if (this.flashes.length > 8) this.flashes.shift();
    }
    if (o.onPlay) o.onPlay(i, midi);
  };
  StringInst.prototype.strum = function (down, vel) {
    var self = this, order = [];
    for (var i = 0; i < this.n; i++) order.push(i);
    if (down === false) order.reverse();
    order.forEach(function (i, k) { setTimeout(function () { self.pluck(i, vel || 0.75); }, k * 14); });
  };
  StringInst.prototype.setChord = function (name) { this.chord = CHORDS[name]; this.chordName = name; this.dirty = true; };
  StringInst.prototype.setHint = function (pc) { this.hintPC = pc; this.dirty = true; };
  StringInst.prototype.frame = function () {
    var active = false;
    for (var i = 0; i < this.n; i++) {
      if (this.amp[i] > 0.05) { this.amp[i] *= this.o.damp; this.ph[i] += 2.3; active = true; } else this.amp[i] = 0;
    }
    if (this.flashes.length) {
      this.flashes.forEach(function (f) { f.life -= 0.025; });
      this.flashes = this.flashes.filter(function (f) { return f.life > 0; });
      active = true;
    }
    if (active || this.dirty) { this.draw(); this.dirty = false; }
  };
  StringInst.prototype.draw = function () {
    var g = this.g, w = this.w, h = this.h, o = this.o, self = this, i, f;
    if (!w || !this.ys) return;
    g.clearRect(0, 0, w, h);
    var top = this.ys[0] - 14, bot = this.ys[this.n - 1] + 14;
    // body
    g.lineWidth = 2; g.strokeStyle = INK;
    rr(g, this.x1 - 4, 6, w - this.x1 - 2, h - 12, Math.min(28, h * 0.16)); g.fillStyle = BLUE_PALE; g.fill(); g.stroke();
    if (o.type === 'guitar') {
      var cx = this.x1 + (this.bridge - this.x1) * 0.45, r = Math.max(8, Math.min(h * 0.27, (this.bridge - this.x1) * 0.3));
      g.beginPath(); g.arc(cx, h / 2, r, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.stroke();
      g.beginPath(); g.arc(cx, h / 2, r + 5, 0, Math.PI * 2); g.strokeStyle = BLUE; g.lineWidth = 1.5; g.stroke();
    } else {
      var px = this.x1 + (this.bridge - this.x1) * 0.45;
      rr(g, px - 9, top + 2, 18, bot - top - 4, 6); g.fillStyle = INK; g.fill();
    }
    g.fillStyle = INK; g.fillRect(this.bridge - 3, top + 4, 6, bot - top - 8);
    // neck
    g.beginPath(); g.rect(4, top, this.x1 - 4, bot - top); g.fillStyle = '#fff'; g.fill();
    g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
    g.strokeStyle = '#a0a0a0'; g.lineWidth = 1.5;
    for (f = 1; f < this.fx.length; f++) { g.beginPath(); g.moveTo(this.fx[f], top); g.lineTo(this.fx[f], bot); g.stroke(); }
    g.fillStyle = BLUE_SOFT;
    [3, 5, 7].forEach(function (k) { if (k < self.fx.length) { g.beginPath(); g.arc((self.fx[k - 1] + self.fx[k]) / 2, (top + bot) / 2, 4, 0, 7); g.fill(); } });
    g.fillStyle = INK; g.fillRect(this.x0 - 3, top, 6, bot - top);
    // strings
    for (i = 0; i < this.n; i++) {
      var y = this.ys[i], a = this.amp[i];
      var dead = o.type === 'guitar' && this.chord && this.chord[i] == null;
      g.lineWidth = o.thick[i]; g.strokeStyle = a > 0.6 ? BLUE : (dead ? '#b5b5b5' : '#222');
      g.beginPath();
      if (a <= 0.05) { g.moveTo(this.x0, y); g.lineTo(this.bridge, y); }
      else {
        var Ls = this.bridge - this.x0, s = Math.sin(this.ph[i]) * a;
        for (var k = 0; k <= 32; k++) { var u = k / 32, xx = this.x0 + Ls * u, yy = y + s * Math.sin(Math.PI * u); if (k) g.lineTo(xx, yy); else g.moveTo(xx, yy); }
      }
      g.stroke();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // chord shape / root hints
    if (o.type === 'guitar' && this.chordName) {
      SHAPES[this.chordName].forEach(function (fr, si) {
        var yy = self.ys[si];
        if (fr > 0) { g.beginPath(); g.arc((self.fx[fr - 1] + self.fx[fr]) / 2, yy, Math.min(8, self.gap * 0.33), 0, 7); g.fillStyle = BLUE; g.fill(); }
        g.font = '700 11px ' + SANS; g.fillStyle = fr < 0 ? '#c0392b' : GRAY;
        g.fillText(fr < 0 ? '×' : (fr === 0 ? '○' : ''), self.x0 - 14, yy);
      });
      g.font = '900 13px ' + SANS; g.fillStyle = BLUE; g.textAlign = 'left';
      g.fillText(this.chordName, 10, Math.max(10, top - 9)); g.textAlign = 'center';
    }
    if (o.type === 'bass') {
      g.font = '11px ' + PIXF; g.fillStyle = GRAY;
      for (i = 0; i < this.n; i++) g.fillText(o.labels[i], this.x0 - 14, this.ys[i]);
      if (this.hintPC != null) {
        g.strokeStyle = BLUE; g.lineWidth = 2.5;
        for (i = 0; i < this.n; i++) for (f = 0; f < this.fx.length; f++) {
          if ((o.strings[i] + f) % 12 === this.hintPC) {
            var hx = f === 0 ? this.x0 - 14 : (this.fx[f - 1] + this.fx[f]) / 2;
            g.beginPath(); g.arc(hx, this.ys[i], Math.min(9, this.gap * 0.34), 0, 7); g.stroke();
          }
        }
      }
    }
    // key labels
    g.font = '10px ' + PIXF; g.fillStyle = GRAY;
    var kx = (this.bridge + w - 4) / 2;
    for (i = 0; i < this.n; i++) g.fillText(o.keys[i], kx, this.ys[i]);
    // flashes
    this.flashes.forEach(function (fl) {
      g.globalAlpha = Math.max(0, fl.life); g.fillStyle = BLUE; g.font = '800 12px ' + SANS;
      g.fillText(fl.t, fl.x, fl.y - (1 - fl.life) * 14);
    });
    g.globalAlpha = 1;
  };

  var guitar = new StringInst($('#guitarCanvas'), {
    type: 'guitar', strings: GOPEN, labels: ['E', 'A', 'D', 'G', 'B', 'E'], keys: ['1', '2', '3', '4', '5', '6'],
    thick: [3.2, 2.7, 2.2, 1.6, 1.25, 1], frets: 5, neckEnd: 0.56, damp: 0.955,
    onPlay: function () { markPlayed('guitar'); }
  });
  var bass = new StringInst($('#bassCanvas'), {
    type: 'bass', strings: [28, 33, 38, 43], labels: ['E', 'A', 'D', 'G'], keys: ['7', '8', '9', '0'],
    thick: [4.4, 3.8, 3.1, 2.5], frets: 7, neckEnd: 0.78, damp: 0.965,
    onPlay: function () { markPlayed('bass'); }
  });
  var loopers = [guitar, bass];
  (function loop() { loopers.forEach(function (l) { l.frame(); }); requestAnimationFrame(loop); })();

  // 코드 버튼
  var chordBox = $('#chords');
  ['G', 'C', 'D', 'Em', 'Bm', 'Am'].forEach(function (n) {
    var b = mk('button', 'chip'); b.type = 'button'; b.textContent = n; b.setAttribute('data-chord', n);
    b.addEventListener('click', function () { setGuitarChord(n); guitar.strum(true, 0.7); });
    chordBox.appendChild(b);
  });
  function setGuitarChord(n) {
    guitar.setChord(n);
    $$('#chords .chip').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-chord') === n); });
  }
  setGuitarChord('G');
  var driveBtn = $('#driveBtn');
  driveBtn.addEventListener('click', function () {
    A.drive = !A.drive; driveBtn.setAttribute('aria-pressed', String(A.drive));
    guitar.strum(true, 0.7);
  });

  /* =========================================================
     드럼
     ========================================================= */
  var KIT = [
    { id: 'crash', label: 'CRASH',  key: 'KeyM', k: 'M', cls: 'cym',  x: 70, y: 2,  w: 28 },
    { id: 'hihat', label: 'HI-HAT', key: 'KeyC', k: 'C', cls: 'cym',  x: 1,  y: 24, w: 25 },
    { id: 'tom1',  label: 'TOM 1',  key: 'KeyV', k: 'V', cls: 'drum', x: 29, y: 12, w: 19 },
    { id: 'tom2',  label: 'TOM 2',  key: 'KeyB', k: 'B', cls: 'drum', x: 51, y: 12, w: 19 },
    { id: 'kick',  label: 'KICK',   key: 'KeyZ', k: 'Z', cls: 'kick', x: 35, y: 40, w: 32 },
    { id: 'snare', label: 'SNARE',  key: 'KeyX', k: 'X', cls: 'drum', x: 15, y: 53, w: 22 },
    { id: 'floor', label: 'FLOOR',  key: 'KeyN', k: 'N', cls: 'drum', x: 73, y: 47, w: 23 }
  ];
  var kit = $('#kit'), kitEls = {};
  KIT.forEach(function (p) {
    var b = mk('button', 'pc ' + p.cls);
    b.type = 'button'; b.setAttribute('aria-label', p.label + ' (' + p.k + ')');
    b.style.left = p.x + '%'; b.style.top = p.y + '%'; b.style.width = p.w + '%';
    b.innerHTML = (p.id === 'kick' ? '<span class="kick-logo">アルケミ<small>ALCHEMY</small></span>' : '') +
      '<span class="lb">' + p.label + '</span><span class="kb">' + p.k + '</span>';
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); hitDrum(p.id); });
    b.addEventListener('click', function (e) { if (e.detail === 0) hitDrum(p.id); });
    kit.appendChild(b); kitEls[p.id] = b;
  });
  function anim(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function hitDrum(id) { A.drum(id); anim(kitEls[id], 'hit'); markPlayed('drums'); }

  /* =========================================================
     건반
     ========================================================= */
  var WHITE = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76];
  var BLACK = [[61, 0], [63, 1], [66, 3], [68, 4], [70, 5], [73, 7], [75, 8]];
  var KEYMAP = { KeyA: 60, KeyW: 61, KeyS: 62, KeyE: 63, KeyD: 64, KeyF: 65, KeyT: 66, KeyG: 67, KeyY: 68, KeyH: 69, KeyU: 70, KeyJ: 71, KeyK: 72, KeyO: 73, KeyL: 74, KeyP: 75, Semicolon: 76 };
  var KEYLABEL = {}; Object.keys(KEYMAP).forEach(function (c) { KEYLABEL[KEYMAP[c]] = c === 'Semicolon' ? ';' : c.slice(3); });
  var keysBox = $('#keys'), keyEls = [], keyElByMidi = {}, activeKeys = {}, keyPointerDown = false;
  function addKey(m, cls, left, width) {
    var b = mk('button', cls); b.type = 'button'; b.tabIndex = -1;
    b.style.left = left + '%'; b.style.width = width + '%';
    b.setAttribute('aria-label', noteName(m));
    b.innerHTML = (m % 12 === 0 ? '<span class="kn">' + noteName(m) + '</span>' : '') + '<span class="kl">' + KEYLABEL[m] + '</span>';
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault(); keyPointerDown = true;
      try { b.releasePointerCapture(e.pointerId); } catch (err) {}
      keyOn(m);
    });
    b.addEventListener('pointerenter', function () { if (keyPointerDown) keyOn(m); });
    b.addEventListener('pointerleave', function () { keyOff(m); });
    b.addEventListener('pointerup', function () { keyOff(m); });
    keysBox.appendChild(b); keyEls.push({ m: m, el: b }); keyElByMidi[m] = b;
  }
  WHITE.forEach(function (m, i) { addKey(m, 'wk', i * 10, 10); });
  BLACK.forEach(function (p) { addKey(p[0], 'bk', (p[1] + 1) * 10 - 3, 6); });
  ['pointerup', 'pointercancel'].forEach(function (t) { window.addEventListener(t, function () { keyPointerDown = false; }); });
  function keyOn(m) {
    if (activeKeys[m]) return;
    activeKeys[m] = A.key(m, 0.65) || true;
    keyElByMidi[m].classList.add('down'); markPlayed('keys');
  }
  function keyOff(m) {
    var h = activeKeys[m];
    if (h && h.release) h.release();
    delete activeKeys[m];
    keyElByMidi[m].classList.remove('down');
  }

  /* ---------- 모바일 탭 ---------- */
  var stage = $('#stage');
  $$('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      stage.setAttribute('data-active', t.getAttribute('data-tab'));
      $$('.tab').forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
    });
  });

  /* ---------- 키보드 입력 ---------- */
  var heroVisible = true, heldKeys = {};
  var GKEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'], BKEYS = ['Digit7', 'Digit8', 'Digit9', 'Digit0'];
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || !heroVisible) return;
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    var c = e.code;
    if (KEYMAP[c] != null) { e.preventDefault(); if (e.repeat || heldKeys[c]) return; heldKeys[c] = true; keyOn(KEYMAP[c]); return; }
    if (e.repeat) return;
    for (var i = 0; i < KIT.length; i++) if (KIT[i].key === c) { e.preventDefault(); hitDrum(KIT[i].id); return; }
    var gi = GKEYS.indexOf(c); if (gi >= 0) { guitar.pluck(gi, 0.8); return; }
    if (c === 'KeyQ') { guitar.strum(true, 0.75); return; }
    var bi = BKEYS.indexOf(c); if (bi >= 0) { bass.pluck(bi, 0.85, null); return; }
  });
  document.addEventListener('keyup', function (e) {
    var c = e.code;
    if (KEYMAP[c] != null && heldKeys[c]) { heldKeys[c] = false; keyOff(KEYMAP[c]); }
  });
  window.addEventListener('blur', function () {
    Object.keys(heldKeys).forEach(function (c) { if (heldKeys[c]) { heldKeys[c] = false; keyOff(KEYMAP[c]); } });
  });

  /* =========================================================
     (JAM 패널은 제거됨 — Identity 섹션의 믹스 기능에서만 Jam 엔진 사용)
     ========================================================= */

  /* =========================================================
     04 IDENTITY — 파트 섞기
     ========================================================= */
  var idSec = $('#identity'), flask = $('#flask'), mixBtn = $('#mixBtn'), LAYER = 30;
  var mixOrder = [];
  function mixParts() { var m = {}; mixOrder.forEach(function (p) { m[p] = true; }); return m; }
  function idPlaying() { return Jam.playing && Jam.owner === 'identity'; }
  function renderMix() {
    $$('.part-chip').forEach(function (b) { b.setAttribute('aria-pressed', String(mixOrder.indexOf(b.getAttribute('data-part')) >= 0)); });
    $$('#flask .layer').forEach(function (g) {
      var k = mixOrder.indexOf(g.getAttribute('data-part'));
      g.style.transform = k >= 0 ? 'translateY(' + (-k * LAYER) + 'px)' : 'translateY(' + (LAYER + 30) + 'px)';
    });
    $('#mixCount').textContent = mixOrder.length;
    idSec.classList.toggle('complete', mixOrder.length === 5);
    idSec.classList.toggle('playing', idPlaying());
    mixBtn.textContent = idPlaying() ? '■ 정지' : (mixOrder.length ? '▶ 재생' : '▶ 전부 섞어보기');
  }
  $$('.part-chip').forEach(function (b) {
    b.addEventListener('click', function () {
      A.ensure();
      var id = b.getAttribute('data-part'), i = mixOrder.indexOf(id);
      if (i >= 0) mixOrder.splice(i, 1); else mixOrder.push(id);
      if (!mixOrder.length) { if (idPlaying()) Jam.stop(); }
      else if (idPlaying()) Jam.setParts(mixParts());
      else Jam.start(mixParts(), 'identity');
      renderMix();
    });
  });
  mixBtn.addEventListener('click', function () {
    if (idPlaying()) { Jam.stop(); return; }
    if (!mixOrder.length) mixOrder = ['drums', 'bass', 'guitar', 'keys', 'vocal'];
    Jam.start(mixParts(), 'identity'); renderMix();
  });
  $('#mixReset').addEventListener('click', function () { mixOrder = []; if (idPlaying()) Jam.stop(); renderMix(); });
  renderMix();

  Jam.on(function (ev) {
    if (ev.type === 'state') {
      renderMix();
    } else if (ev.type === 'step') {
      if (!Jam.playing || ev.owner !== Jam.owner) return;
      if (ev.owner === 'identity' && ev.st % 2 === 0) {
        anim(flask, 'beat');
      }
    }
  });

  /* ---------- 화면 밖으로 나가면 JAM 정지 / 키보드 입력 범위 ---------- */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { heroVisible = e.intersectionRatio > 0.2; });
    }, { threshold: [0, 0.2, 0.5] }).observe($('#play'));
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting && Jam.owner === 'identity') Jam.stop(); });
    }, { threshold: 0 }).observe(idSec);
  }

  /* =========================================================
     03 ACTIVITY — 사진 / 이벤트
     ========================================================= */
  function strumAt(name, t, vel, drive) {
    CHORDS[name].filter(function (m) { return m != null; }).forEach(function (m, i) { A.guitar(m, vel, t + i * 0.012, 1.4, drive); });
  }

  var photos = $('#photos');
  (C.photos || []).forEach(function (p, i) {
    var fig = mk('figure', 'photo reveal');
    fig.innerHTML = '<span class="tape" aria-hidden="true"></span><div class="ph-frame"><img src="' + p.src + '" alt="' + (p.alt || 'ALCHEMY 활동 사진') + '" loading="lazy"></div>' +
      '<figcaption>' + String(i + 1).padStart(2, '0') + ' — ' + (p.caption || '') + '</figcaption>';
    var img = fig.querySelector('img');
    img.addEventListener('error', function () {
      fig.classList.add('ph-empty');
      fig.querySelector('.ph-frame').innerHTML = '<div class="ph-ph">' + pixSVG('camera') + '<span>PHOTO ' + String(i + 1).padStart(2, '0') + '</span><small>' + p.src + '</small></div>';
    });
    photos.appendChild(fig);
  });

  var evBox = $('#eventCard');
  var upcoming = (C.events || []).filter(function (ev) { return new Date(ev.date + 'T23:59:59+09:00') >= NOW; });
  if (upcoming.length) {
    var ev = upcoming[0];
    evBox.innerHTML = '<span class="ev-k">NEXT STAGE</span><b class="ev-name">' + ev.name + '</b><span class="ev-date">' + ev.dateLabel + ' · ' + ev.place + '</span>' +
      (ev.teams && ev.teams.length ? '<span class="ev-teams">ALCHEMY 출연 팀 — ' + ev.teams.join(' · ') + '</span>' : '');
    evBox.hidden = false;
  } else evBox.hidden = true;

  /* =========================================================
     05 JOIN — 모집 상태
     ========================================================= */
  var R = C.recruit || {}, DL = new Date(R.applyDeadline), IE = new Date(R.interviewEnd);
  var status = NOW < DL ? 'open' : (NOW < IE ? 'interview' : 'closed');
  document.body.setAttribute('data-recruit', status);
  var dd = kstDay(DL) - kstDay(NOW);
  var ST = {
    open: { badge: '모집 중 · ' + (dd <= 0 ? 'D-DAY' : 'D-' + dd), msg: '지원 마감은 9월 4일(금) 20시입니다. 아래 지원 방법을 확인하고 지원해 주세요.' },
    interview: { badge: '지원 마감 · 면접 진행 중', msg: '지원이 마감되었고, 면접(9월 4일~11일)이 진행 중입니다. 문의는 카카오톡 오픈채팅 또는 Instagram DM으로 해주세요.' },
    closed: { badge: '2026-2 모집 마감', msg: '2026년 2학기 신입부원 모집은 마감되었습니다. 모집·활동 소식은 ALCHEMY 공식 Instagram에서 확인하세요.' }
  };
  $('#recruitStatus').textContent = ST[status].badge;
  $('#ctaMsg').textContent = ST[status].msg;
  var tlState = { open: ['now', 'next'], interview: ['done', 'now'], closed: ['done', 'done'] }[status];
  var TLW = { now: '진행 중', next: '예정', done: '종료' };
  $$('.tl-item').forEach(function (it, i) {
    it.classList.add(tlState[i]);
    var s = it.querySelector('.tl-state'); if (s) s.textContent = TLW[tlState[i]];
  });
  var applyBtn = $('#applyBtn'), igBtn = $('#igBtn');
  if (status === 'open') {
    if (L.googleForm) { applyBtn.href = L.googleForm; applyBtn.querySelector('span').textContent = '지원서 작성하기 (구글폼)'; }
    else { applyBtn.href = L.instagram; applyBtn.querySelector('span').textContent = '지원서 링크 보기 (Instagram 모집글)'; }
  } else {
    applyBtn.hidden = true;
    igBtn.classList.add('btn-blue');
  }

  // 모집 분야 — 누르면 해당 파트 소리
  function demo(part) {
    if (!A.ensure()) return;
    var t = A.now() + 0.03;
    if (part === 'vocal') { A.voice(71, t, 0.35, 0.5); A.voice(74, t + 0.38, 0.6, 0.5); }
    else if (part === 'guitar') strumAt('G', t, 0.7, true);
    else if (part === 'bass') { A.bass(31, 0.9, t, 0.3); A.bass(43, 0.8, t + 0.3, 0.5); }
    else if (part === 'keys') [67, 71, 74, 79].forEach(function (m, i) { A.key(m, 0.5, t + i * 0.09, 0.8); });
    else if (part === 'drums') { A.drum('kick', t); A.drum('snare', t + 0.25); A.drum('kick', t + 0.5); A.drum('crash', t + 0.5); }
  }
  $$('.field').forEach(function (b) { b.addEventListener('click', function () { demo(b.getAttribute('data-field')); anim(b, 'hit'); }); });

  /* =========================================================
     공통 — 리빌 / 내비 / 헤더
     ========================================================= */
  (function initReveal() {
    var els = $$('.reveal');
    if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    els.forEach(function (e) { io.observe(e); });
  })();
  if ('IntersectionObserver' in window) {
    var navLinks = $$('.nav a');
    var secIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) navLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['play', 'about', 'activity', 'identity', 'join'].forEach(function (id) { var el = document.getElementById(id); if (el) secIO.observe(el); });
  }
  var hdr = $('.site-header');
  window.addEventListener('scroll', function () { hdr.classList.toggle('scrolled', window.scrollY > 8); }, { passive: true });
})();
