/* =========================================================
   ALCHEMY — Web Audio 신스 엔진 (음원 파일 없이 실시간 합성)
   guitar/bass: Karplus-Strong 현 모델링 · drums/keys/vocal: 합성
   ========================================================= */
(function () {
  'use strict';
  var A = {};
  var ctx = null, master = null, comp = null, noiseBuf = null, driveIn = null, bassTone = null;
  var muted = false;
  var LEVELS = { guitar: 0.55, bass: 0.95, drums: 0.8, keys: 0.5, vocal: 0.42 };
  var bus = {};
  var ksCache = new Map();
  A.bus = bus;
  A.drive = false;

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  A.mtof = mtof;
  function hold(p, s) { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(s); else p.cancelScheduledValues(s); }
  function makeCurve(k) {
    var n = 2048, c = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = (i * 2) / n - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return c;
  }

  A.ensure = function () {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.25;
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85;
      comp.connect(master); master.connect(ctx.destination);
      Object.keys(LEVELS).forEach(function (k) {
        var g = ctx.createGain(); g.gain.value = LEVELS[k]; g.connect(comp); bus[k] = g;
      });
      driveIn = ctx.createGain(); driveIn.gain.value = 1.6;
      var sh = ctx.createWaveShaper(); sh.curve = makeCurve(40); sh.oversample = '4x';
      var tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3400; tone.Q.value = 0.8;
      var out = ctx.createGain(); out.gain.value = 0.32;
      driveIn.connect(sh); sh.connect(tone); tone.connect(out); out.connect(bus.guitar);
      bassTone = ctx.createBiquadFilter(); bassTone.type = 'lowpass'; bassTone.frequency.value = 1300; bassTone.Q.value = 0.6;
      bassTone.connect(bus.bass);
      var len = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var nd = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  A.now = function () { return ctx ? ctx.currentTime : 0; };
  A.isMuted = function () { return muted; };
  A.setMuted = function (m) {
    muted = !!m;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.03);
  };
  A.setLevel = function (part, v) {
    LEVELS[part] = v;
    if (bus[part]) bus[part].gain.setTargetAtTime(v, (ctx || { currentTime: 0 }).currentTime, 0.02);
  };

  /* ---------- Karplus-Strong ---------- */
  var KS = {
    g: { dur: 2.8, bright: 0.65, decay: 0.9965 },
    b: { dur: 2.4, bright: 0.25, decay: 0.998 },
    m: { dur: 0.14, bright: 0.5, decay: 0.93 }
  };
  function ks(freq, type) {
    var key = type + freq.toFixed(2);
    var hit = ksCache.get(key); if (hit) return hit;
    var o = KS[type], sr = ctx.sampleRate, N = Math.floor(sr * o.dur);
    var P = Math.max(3, Math.round(sr / freq + 0.5));
    var ring = new Float32Array(P), lp = 0, mean = 0, i;
    for (i = 0; i < P; i++) { lp += o.bright * ((Math.random() * 2 - 1) - lp); ring[i] = lp; mean += lp; }
    mean /= P; for (i = 0; i < P; i++) ring[i] -= mean;
    var buf = ctx.createBuffer(1, N, sr), d = buf.getChannelData(0);
    var idx = 0, peak = 0, pk = sr * 0.1;
    for (i = 0; i < N; i++) {
      var nx = idx + 1 === P ? 0 : idx + 1, v = ring[idx];
      d[i] = v;
      ring[idx] = o.decay * 0.5 * (v + ring[nx]);
      idx = nx;
      if (i < pk) { var a = v < 0 ? -v : v; if (a > peak) peak = a; }
    }
    var norm = peak > 0 ? 0.8 / peak : 1, fade = Math.floor(sr * 0.08);
    for (i = 0; i < N; i++) { var gg = norm; if (i > N - fade) gg *= (N - i) / fade; d[i] *= gg; }
    hit = { buf: buf, rate: freq / (sr / (P - 0.5)) };
    ksCache.set(key, hit);
    return hit;
  }
  function pluckBuf(type, midi, vel, when, dest, len) {
    var t = when != null ? when : ctx.currentTime;
    var k = ks(mtof(midi), type);
    var src = ctx.createBufferSource(); src.buffer = k.buf; src.playbackRate.value = k.rate;
    var g = ctx.createGain(); g.gain.setValueAtTime(vel, t);
    src.connect(g); g.connect(dest);
    src.start(t);
    if (len != null) { g.gain.setTargetAtTime(0, t + len, 0.03); src.stop(t + len + 0.3); }
    else src.stop(t + k.buf.duration / k.rate + 0.05);
    return {
      stop: function (at) {
        var s = Math.max(at != null ? at : ctx.currentTime, t);
        try { hold(g.gain, s); g.gain.setTargetAtTime(0, s, 0.025); src.stop(s + 0.25); } catch (e) {}
      }
    };
  }
  A.guitar = function (midi, vel, when, len, drive) {
    if (!A.ensure()) return null;
    var dr = drive != null ? drive : A.drive;
    return pluckBuf('g', midi, (vel == null ? 0.8 : vel) * (dr ? 1 : 0.9), when, dr ? driveIn : bus.guitar, len);
  };
  A.mute = function (midi, vel, when) {
    if (!A.ensure()) return null;
    return pluckBuf('m', midi, (vel == null ? 0.5 : vel) * 0.6, when, A.drive ? driveIn : bus.guitar);
  };
  A.bass = function (midi, vel, when, len) {
    if (!A.ensure()) return null;
    vel = vel == null ? 0.8 : vel;
    var t = when != null ? when : ctx.currentTime, L = len || 1.6;
    var h = pluckBuf('b', midi, vel, t, bassTone, len);
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(midi);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.45, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + L);
    o.connect(g); g.connect(bus.bass); o.start(t); o.stop(t + L + 0.1);
    var s0 = h.stop;
    h.stop = function (at) {
      s0(at);
      var s = Math.max(at != null ? at : ctx.currentTime, t);
      try { hold(g.gain, s); g.gain.setTargetAtTime(0, s, 0.02); o.stop(s + 0.2); } catch (e) {}
    };
    return h;
  };

  /* ---------- Drums ---------- */
  function noise(t, type, freq, q, peak, decay, dest) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    var g = ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + decay + 0.05);
  }
  function tone(t, type, f0, f1, sweep, peak, decay, dest) {
    var o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    var g = ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + decay + 0.05);
  }
  A.drum = function (type, when, vel) {
    if (!A.ensure()) return;
    var t = when != null ? when : ctx.currentTime, d = bus.drums, v = Math.max(0.05, vel == null ? 1 : vel);
    switch (type) {
      case 'kick':
        // 어택: 짧은 하이패스 노이즈 클릭
        noise(t, 'highpass', 3200, 0, 0.42 * v, 0.018, d);
        // 바디: 톤 스윕 (피치가 빠르게 떨어지며 두터운 바디)
        tone(t, 'sine', 210, 48, 0.09, 1.4 * v, 0.55, d);
        // 서브: 저역을 살리는 서브 톤
        tone(t, 'sine', 85, 38, 0.14, 0.7 * v, 0.5, d);
        // 바디 보강: 트라이앵글로 중저역 하모닉스
        tone(t, 'triangle', 150, 45, 0.1, 0.4 * v, 0.35, d);
        break;
      case 'snare':
        noise(t, 'highpass', 1500, 0, 0.78 * v, 0.2, d);
        noise(t, 'bandpass', 3800, 0.8, 0.36 * v, 0.14, d);
        tone(t, 'triangle', 220, 160, 0.06, 0.6 * v, 0.11, d);
        break;
      case 'hihat':
        noise(t, 'highpass', 8200, 0, 0.36 * v, 0.05, d);
        noise(t, 'bandpass', 10000, 1.2, 0.14 * v, 0.045, d);
        break;
      case 'crash':
        noise(t, 'highpass', 4200, 0, 0.42 * v, 1.6, d);
        noise(t, 'bandpass', 6000, 0.6, 0.24 * v, 0.9, d);
        break;
      case 'tom1':  tone(t, 'sine', 280, 170, 0.18, 0.9 * v, 0.36, d); noise(t, 'bandpass', 1200, 1, 0.1 * v, 0.08, d); break;
      case 'tom2':  tone(t, 'sine', 210, 125, 0.2, 0.9 * v, 0.42, d); noise(t, 'bandpass', 900, 1, 0.1 * v, 0.09, d); break;
      case 'floor': tone(t, 'sine', 145, 78, 0.26, 1.0 * v, 0.6, d); noise(t, 'bandpass', 650, 1, 0.1 * v, 0.1, d); break;
    }
  };

  /* ---------- Keys (EP 계열) ---------- */
  A.key = function (midi, vel, when, len) {
    if (!A.ensure()) return null;
    vel = vel == null ? 0.6 : vel;
    var t = when != null ? when : ctx.currentTime, f = mtof(midi);
    var out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vel * 0.55, t + 0.006);
    out.gain.exponentialRampToValueAtTime(vel * 0.22, t + 0.6);
    out.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(1800, t + 1.2);
    var o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
    var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2; o2.detune.value = 4;
    var o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = f * 4;
    var g2 = ctx.createGain(); g2.gain.setValueAtTime(0.3, t); g2.gain.exponentialRampToValueAtTime(0.02, t + 0.8);
    var g3 = ctx.createGain(); g3.gain.setValueAtTime(0.12, t); g3.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o1.connect(lp); o2.connect(g2); g2.connect(lp); o3.connect(g3); g3.connect(lp);
    lp.connect(out); out.connect(bus.keys);
    [o1, o2, o3].forEach(function (o) { o.start(t); o.stop(t + 4.6); });
    var h = {
      release: function (at) {
        var s = Math.max(at != null ? at : ctx.currentTime, t + 0.02);
        try { hold(out.gain, s); out.gain.setTargetAtTime(0, s, 0.09); [o1, o2, o3].forEach(function (o) { o.stop(s + 0.6); }); } catch (e) {}
      }
    };
    h.stop = h.release;
    if (len != null) h.release(t + len);
    return h;
  };

  /* ---------- Vocal (포먼트 '아') ---------- */
  A.voice = function (midi, when, len, vel) {
    if (!A.ensure()) return null;
    len = len || 0.5; vel = vel == null ? 0.5 : vel;
    var t = when != null ? when : ctx.currentTime, f = mtof(midi);
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
    var lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.35, len));
    lfo.connect(lg); lg.connect(o.frequency);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.05);
    g.gain.setValueAtTime(vel, t + Math.max(0.06, len - 0.06));
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.08);
    var sum = ctx.createGain();
    [[730, 9, 1], [1090, 11, 0.6], [2440, 14, 0.25]].forEach(function (p) {
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = p[0]; bp.Q.value = p[1];
      var ag = ctx.createGain(); ag.gain.value = p[2] * 6;
      o.connect(bp); bp.connect(ag); ag.connect(sum);
    });
    sum.connect(g); g.connect(bus.vocal);
    o.start(t); lfo.start(t); o.stop(t + len + 0.15); lfo.stop(t + len + 0.15);
  };

  /* ---------- JAM 시퀀서 (J-POP 王道進行 IV–V–iii–vi in G : C–D–Bm–Em) ---------- */
  var CH = {
    C:  [null, 48, 52, 55, 60, 64],
    D:  [null, null, 50, 57, 62, 66],
    Bm: [null, 47, 54, 59, 62, 66],
    Em: [40, 47, 52, 55, 59, 64]
  };
  var PROG = [
    { name: 'C',  bass: 36, keys: [60, 64, 67], pc: [0, 4, 7] },
    { name: 'D',  bass: 38, keys: [62, 66, 69], pc: [2, 6, 9] },
    { name: 'Bm', bass: 35, keys: [59, 62, 66], pc: [11, 2, 6] },
    { name: 'Em', bass: 40, keys: [59, 64, 67], pc: [4, 7, 11] }
  ];
  var MEL = [
    [[71, 0, 1.5], [72, 1.5, 0.5], [71, 2, 1], [67, 3, 1]],
    [[69, 0, 1.5], [71, 1.5, 0.5], [69, 2, 1], [66, 3, 1]],
    [[66, 0, 1], [69, 1, 1], [71, 2, 1], [74, 3, 1]],
    [[71, 0, 2.5], [67, 2.5, 0.5], [64, 3, 1]]
  ];
  var Jam = { bpm: 100, playing: false, owner: null, parts: {}, step: 0, next: 0, timer: null, PROG: PROG };
  var listeners = [], held = [], lastStrum = [];
  function emit(ev) { listeners.forEach(function (fn) { try { fn(ev); } catch (e) { console.error(e); } }); }
  function keep(h) { if (!h) return; held.push(h); if (held.length > 24) held.shift(); }
  Jam.on = function (fn) { listeners.push(fn); };
  Jam.start = function (parts, owner) {
    if (!A.ensure()) return;
    Jam.parts = Object.assign({}, parts);
    var prev = Jam.owner; Jam.owner = owner;
    if (!Jam.playing) {
      Jam.playing = true; Jam.step = 0; Jam.next = ctx.currentTime + 0.08;
      Jam.timer = setInterval(tick, 25); tick();
    }
    emit({ type: 'state', playing: true, owner: owner, prevOwner: prev });
  };
  Jam.setParts = function (parts) { Jam.parts = Object.assign({}, parts); };
  Jam.stop = function () {
    if (!Jam.playing) return;
    clearInterval(Jam.timer); Jam.timer = null; Jam.playing = false;
    held.forEach(function (h) { if (h && h.stop) h.stop(); }); held = [];
    lastStrum.forEach(function (h) { if (h) h.stop(); }); lastStrum = [];
    var prev = Jam.owner; Jam.owner = null;
    emit({ type: 'state', playing: false, owner: null, prevOwner: prev });
  };
  function tick() {
    var e = 60 / Jam.bpm / 2;
    if (Jam.next < ctx.currentTime - 0.05) Jam.next = ctx.currentTime + 0.05;
    while (Jam.next < ctx.currentTime + 0.12) { sched(Jam.step, Jam.next, e); Jam.step++; Jam.next += e; }
  }
  function sched(s, t, e) {
    var st = s % 8, bar = Math.floor(s / 8) % 4, ch = PROG[bar], p = Jam.parts, hits = [], owner = Jam.owner;
    if (p.drums) {
      A.drum('hihat', t, st % 2 ? 0.45 : 0.8); hits.push('hihat');
      if (st === 0 || st === 4 || st === 5) { A.drum('kick', t, st === 5 ? 0.75 : 1); hits.push('kick'); }
      if (st === 2 || st === 6) { A.drum('snare', t, 0.9); hits.push('snare'); }
      if (s % 32 === 0) { A.drum('crash', t, 0.55); hits.push('crash'); }
    }
    if (p.bass) {
      var off = [0, 0, 12, 0, 0, 0, 7, 0][st];
      keep(A.bass(ch.bass + off, st % 2 ? 0.6 : 0.8, t, e * 0.85));
    }
    if (p.guitar && (st === 0 || st === 3 || st === 4 || st === 6)) {
      var up = st === 3 || st === 6;
      lastStrum.forEach(function (h) { if (h) h.stop(t); }); lastStrum = [];
      var notes = CH[ch.name].filter(function (m) { return m != null; });
      if (up) notes = notes.slice().reverse().slice(0, 4);
      notes.forEach(function (m, i) { lastStrum.push(A.guitar(m, up ? 0.36 : 0.52, t + i * 0.011, null, false)); });
    }
    if (p.keys && st === 0) ch.keys.forEach(function (m) { keep(A.key(m, 0.3, t, e * 7.6)); });
    if (p.keys && st === 4) keep(A.key(ch.keys[2] + 12, 0.16, t, e * 3.6));
    if (p.vocal) MEL[bar].forEach(function (n) { if (n[1] * 2 === st) A.voice(n[0], t, n[2] * 2 * e * 0.92, 0.42); });
    var delay = Math.max(0, (t - ctx.currentTime) * 1000);
    setTimeout(function () { emit({ type: 'step', step: s, st: st, bar: bar, chord: ch, hits: hits, owner: owner }); }, delay);
  }
  A.Jam = Jam;
  window.AlchemyAudio = A;
})();
