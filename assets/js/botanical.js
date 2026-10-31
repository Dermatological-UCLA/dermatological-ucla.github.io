/*
 * Fine-line botanical drawings for every <canvas data-botanical="..."> on the page.
 *
 *   garden  interactive ring garden; flowers grow, sway, bend from the pointer,
 *           and a click plants a new one (data-interactive). The ring is fitted
 *           to the element named by data-anchor.
 *   border  a row of small plants along the top of the footer.
 *   bloom   a single face-on flower, used for icons and placeholder portraits.
 *
 * Everything is drawn procedurally with seeded randomness (data-seed), so each
 * canvas looks the same on every visit. Respects prefers-reduced-motion.
 */
(() => {
  'use strict';

  const COLORS = {
    sage: '#A3B2A4', beige: '#E0C6AD', taupe: '#C1B2A2', sand: '#EFDBB2',
    charcoal: '#444444', paper: '#F7F1E6', ink: '#5E6B5C', rose: '#D9AE9F',
  };
  const PETAL_FILLS = [COLORS.rose, COLORS.beige, COLORS.sand, COLORS.rose, COLORS.taupe];
  const MAX_PLANTED = 18;
  const INTRO = 0.75; // timing scale for the hero gardens' opening growth
  const TAU = Math.PI * 2;

  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;

  // ---------- utilities ----------
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  const bez = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  };
  const bezD = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
  };
  const now = () => performance.now() / 1000;

  // ---------- flower model ----------
  const TYPE_WEIGHTS = { bloom: 0.46, cup: 0.2, bud: 0.19, sprig: 0.15 };

  function pickType(rng, weights = TYPE_WEIGHTS) {
    let r = rng();
    for (const [type, w] of Object.entries(weights)) {
      if ((r -= w) <= 0) return type;
    }
    return 'bloom';
  }

  function makeFlower(rng, place, opts = {}) {
    const leafCount = opts.leaves ?? 1 + Math.floor(rng() * 3);
    const leaves = [];
    let side = rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < leafCount; i++) {
      leaves.push({
        t: 0.2 + (i / Math.max(1, leafCount)) * 0.5 + rng() * 0.08,
        side,
        len: 0.13 + rng() * 0.09,
        spread: 0.55 + rng() * 0.4,
        phase: rng() * TAU,
      });
      side = -side;
    }
    return {
      place,
      type: opts.type || pickType(rng, opts.weights),
      lean: opts.lean ?? (rng() - 0.5) * 0.3,
      curve: (rng() - 0.5) * 0.35,
      leaves,
      petals: 5 + Math.floor(rng() * 3),
      petalRot: rng() * TAU,
      petalJitter: Array.from({ length: 8 }, () => 0.85 + rng() * 0.3),
      fill: opts.fill || pick(rng, PETAL_FILLS),
      amp: 0.018 + rng() * 0.02,
      speed: 0.55 + rng() * 0.5,
      phase: rng() * TAU,
      born: opts.born ?? null,
      delay: opts.delay ?? 0,
      dur: opts.dur ?? 2.4,
      bend: 0,
      dying: null,
    };
  }

  // ---------- drawing ----------
  function stemGeometry(f, pos, t) {
    const sway = reduced ? 0
      : Math.sin(t * f.speed + f.phase) * f.amp + Math.sin(t * f.speed * 0.53 + f.phase * 1.7) * f.amp * 0.45;
    const off = (sway + f.bend) * pos.h;
    const x0 = pos.x, y0 = pos.y;
    return {
      x: [x0, x0 + f.curve * pos.h * 0.4, x0 + (f.lean * 0.7 - f.curve * 0.3) * pos.h + off * 0.55, x0 + f.lean * pos.h + off],
      y: [y0, y0 - pos.h * 0.36, y0 - pos.h * 0.72, y0 - pos.h],
      sway,
    };
  }

  function drawFlower(ctx, f, pos, t, style) {
    if (f.born === null) return;
    const start = f.born + f.delay;
    const grow = reduced ? 1 : easeInOut(clamp((t - start) / f.dur));
    if (grow <= 0) return;
    const alpha = f.dying ? 1 - clamp((t - f.dying) / 0.9) : 1;
    const { x, y, sway } = stemGeometry(f, pos, t);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const steps = Math.max(2, Math.ceil(32 * grow));
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const s = (i / steps) * grow;
      const px = bez(x[0], x[1], x[2], x[3], s), py = bez(y[0], y[1], y[2], y[3], s);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = style.stem;
    ctx.stroke();

    for (const leaf of f.leaves) {
      const lg = easeOut(clamp((grow - leaf.t) / 0.22));
      if (lg <= 0) continue;
      const px = bez(x[0], x[1], x[2], x[3], leaf.t), py = bez(y[0], y[1], y[2], y[3], leaf.t);
      const ang = Math.atan2(bezD(y[0], y[1], y[2], y[3], leaf.t), bezD(x[0], x[1], x[2], x[3], leaf.t));
      const flutter = reduced ? 0 : Math.sin(t * 1.2 + leaf.phase) * 0.06;
      drawLeaf(ctx, px, py, ang + leaf.side * leaf.spread + flutter, Math.min(pos.h * leaf.len, style.leafMax) * lg, style);
    }

    const open = easeOut(clamp((grow - 0.72) / 0.28));
    if (open > 0) {
      const ang = Math.atan2(bezD(y[0], y[1], y[2], y[3], 1), bezD(x[0], x[1], x[2], x[3], 1));
      const size = clamp(pos.h * 0.07, style.headMin, style.headMax);
      ctx.save();
      ctx.translate(x[3], y[3]);
      ctx.rotate(ang + Math.PI / 2 + sway * 0.6);
      drawHead(ctx, f, size, open, style);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawHead(ctx, f, size, open, style) {
    if (f.type === 'bloom') drawBloom(ctx, f, size, open, style);
    else if (f.type === 'cup') drawCup(ctx, f, size * 1.15, open, style);
    else if (f.type === 'bud') drawBud(ctx, f, size * 0.95, open, style);
    else drawSprigHead(ctx, f, size, open, style);
  }

  function drawLeaf(ctx, x, y, ang, len, style) {
    const w = len * 0.34;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.25, -w, len * 0.7, -w * 0.9, len, 0);
    ctx.bezierCurveTo(len * 0.7, w * 0.9, len * 0.25, w, 0, 0);
    ctx.fillStyle = 'rgba(163, 178, 164, 0.32)';
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = style.line;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(len * 0.08, 0);
    ctx.quadraticCurveTo(len * 0.5, -w * 0.12, len * 0.82, 0);
    ctx.lineWidth = style.line * 0.6;
    ctx.stroke();
    ctx.restore();
  }

  function inkPetal(ctx, fill, len, w, vein, style) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-w, -len * 0.28, -w * 0.85, -len * 0.92, 0, -len);
    ctx.bezierCurveTo(w * 0.85, -len * 0.92, w, -len * 0.28, 0, 0);
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.62;
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.globalAlpha = a;
    ctx.strokeStyle = COLORS.charcoal;
    ctx.lineWidth = style.line * 0.9;
    ctx.stroke();
    if (vein) {
      ctx.beginPath();
      ctx.moveTo(0, -len * 0.18);
      ctx.lineTo(0, -len * 0.55);
      ctx.lineWidth = style.line * 0.55;
      ctx.stroke();
    }
  }

  function drawBloom(ctx, f, size, open, style) {
    const n = f.petals;
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate(f.petalRot + (i / n) * TAU + (1 - open) * 0.5);
      inkPetal(ctx, f.fill, size * open * f.petalJitter[i], size * 0.55 * open, true, style);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.2 * open, 0, TAU);
    ctx.fillStyle = COLORS.sand;
    ctx.fill();
    ctx.strokeStyle = COLORS.charcoal;
    ctx.lineWidth = style.line * 0.9;
    ctx.stroke();
    ctx.fillStyle = COLORS.charcoal;
    const dot = Math.max(0.5, size * 0.035);
    for (let i = 0; i < 6; i++) {
      const a = f.petalRot + (i / 6) * TAU;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * size * 0.3 * open, Math.sin(a) * size * 0.3 * open, dot, 0, TAU);
      ctx.fill();
    }
  }

  function drawCup(ctx, f, size, open, style) {
    const s = 0.35 + 0.65 * open;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * 0.38 * open);
      inkPetal(ctx, f.fill, size * s * 0.92, size * 0.42, false, style);
      ctx.restore();
    }
    inkPetal(ctx, f.fill, size * s, size * 0.48, true, style);
    drawSepals(ctx, size * 0.5, style);
  }

  function drawBud(ctx, f, size, open, style) {
    ctx.save();
    ctx.scale(0.4 + 0.6 * open, 0.4 + 0.6 * open);
    inkPetal(ctx, f.fill, size, size * 0.36, false, style);
    ctx.restore();
    drawSepals(ctx, size * 0.55 * (0.5 + 0.5 * open), style);
  }

  function drawSepals(ctx, len, style) {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * 0.7);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * len * 0.28, -len * 0.5, 0, -len);
      ctx.quadraticCurveTo(-side * len * 0.12, -len * 0.5, 0, 0);
      ctx.fillStyle = 'rgba(163, 178, 164, 0.45)';
      ctx.fill();
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = style.line * 0.8;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSprigHead(ctx, f, size, open, style) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.42;
      const len = size * (0.9 + f.petalJitter[i] * 0.5) * open;
      const ex = Math.cos(a) * len, ey = Math.sin(a) * len;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(ex * 0.3, ey * 0.7, ex, ey);
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = style.line * 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(1.2, size * 0.17) * open, 0, TAU);
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * 0.75;
      ctx.fillStyle = i % 2 ? COLORS.sand : f.fill;
      ctx.fill();
      ctx.globalAlpha = a0;
      ctx.strokeStyle = COLORS.charcoal;
      ctx.lineWidth = style.line * 0.7;
      ctx.stroke();
    }
  }

  function blobPath(ctx, rng, cx, cy, r) {
    const n = 9;
    const rot = rng() * TAU;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU;
      const rr = r * (0.9 + rng() * 0.16);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.86]);
    }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const start = mid(pts[n - 1], pts[0]);
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    ctx.closePath();
  }

  // ---------- scenes ----------
  const STYLE = {
    garden: { stem: 1.15, line: 1, leafMax: 44, headMin: 8, headMax: 30 },
    border: { stem: 1, line: 0.85, leafMax: 13, headMin: 3.5, headMax: 7 },
    bloom: { stem: 1, line: 1, leafMax: 30, headMin: 4, headMax: 200 },
  };

  class Scene {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.type = canvas.dataset.botanical;
      this.style = STYLE[this.type];
      this.seed = Number(canvas.dataset.seed) || 1;
      this.flowers = [];
      this.started = null;
      this.visible = false;
      this.pointer = null;
      this.w = 0;
      this.h = 0;
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = rect.width;
      this.h = rect.height;
      this.dpr = dpr;
      this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.layout();
    }

    start(t) {
      if (this.started !== null) return;
      this.started = t;
      for (const f of this.flowers) if (f.born === null) f.born = t;
    }

    layout() {}
    resolve(f) { return f.place; }
    backdrop() {}

    updateBend(dt, t) {
      if (!this.bends) return;
      const k = 1 - Math.pow(0.002, dt);
      for (const f of this.flowers) {
        let target = 0;
        if (this.pointer && !reduced) {
          const pos = this.resolve(f);
          const geo = stemGeometry(f, pos, t);
          const mx = bez(geo.x[0], geo.x[1], geo.x[2], geo.x[3], 0.7);
          const my = bez(geo.y[0], geo.y[1], geo.y[2], geo.y[3], 0.7);
          const R = Math.max(this.bendRadius, pos.h * 0.6);
          const dx = mx - this.pointer.x, dy = my - this.pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < R) target = Math.sign(dx || 1) * Math.pow(1 - d / R, 1.6) * 0.16;
        }
        f.bend += (target - f.bend) * k;
      }
    }

    frame(t, dt) {
      this.flowers = this.flowers.filter(f => !f.dying || t - f.dying < 0.9);
      this.updateBend(dt, t);
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.backdrop(ctx, t);
      for (const f of this.flowers) drawFlower(ctx, f, this.resolve(f), t, this.style);
    }
  }

  class GardenScene extends Scene {
    constructor(canvas) {
      super(canvas);
      this.bends = true;
      this.bendRadius = 90;
      this.anchor = document.querySelector(canvas.dataset.anchor) || canvas;
      this.interactive = canvas.hasAttribute('data-interactive');
      this.ring = { x: 0, y: 0, r: 0 };
      this.bg = document.createElement('canvas');
      const rng = mulberry32(this.seed);
      const n = Number(canvas.dataset.count) || 9;
      for (let i = 0; i < n; i++) {
        const a = -0.74 + (1.48 * i) / (n - 1) + (rng() - 0.5) * 0.1;
        const b = 0.6 + 0.32 * Math.sqrt(1 - a * a);
        const hs = Math.min(0.62 + 0.95 * (1 - Math.abs(a)) + rng() * 0.3, b + 0.78);
        this.flowers.push(makeFlower(rng, { mode: 'ring', a, b, hs }, {
          lean: -a * 0.28 + (rng() - 0.5) * 0.12,
          delay: (0.35 + i * 0.16 + rng() * 0.35) * INTRO,
          dur: (2.4 + rng() * 0.9) * INTRO,
        }));
      }
      this.flowers.sort((p, q) => q.place.hs - p.place.hs);
    }

    layout() {
      const c = this.canvas.getBoundingClientRect();
      const a = this.anchor.getBoundingClientRect();
      const r = Math.min(a.width, a.height) * 0.46;
      this.ring = { x: a.left - c.left + a.width / 2, y: a.top - c.top + a.height / 2 + r * 0.06, r };

      const bg = this.bg, g = bg.getContext('2d');
      bg.width = this.canvas.width;
      bg.height = this.canvas.height;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (this.canvas.hasAttribute('data-blobs')) {
        const rng = mulberry32(this.seed + 7);
        const { x, y } = this.ring;
        const blobs = [
          [x + r * 0.06, y + r * 0.04, r * 1.12, COLORS.sand, 0.42],
          [x - r * 0.82, y + r * 0.62, r * 0.42, COLORS.beige, 0.32],
          [x + r * 0.92, y - r * 0.86, r * 0.24, COLORS.sage, 0.18],
        ];
        for (const [bx, by, br, color, alpha] of blobs) {
          blobPath(g, rng, bx, by, br);
          g.globalAlpha = alpha;
          g.fillStyle = color;
          g.fill();
        }
        g.globalAlpha = 1;
      }
    }

    resolve(f) {
      const p = f.place, { x, y, r } = this.ring;
      if (p.mode === 'ring') return { x: x + p.a * r, y: y + p.b * r, h: p.hs * r };
      return { x: x + p.dx * r, y: y + p.dy * r, h: p.hs * r };
    }

    backdrop(ctx, t) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.bg, 0, 0);
      ctx.restore();
      const p = reduced ? 1 : easeInOut(clamp((t - (this.started ?? t)) / (2.8 * INTRO)));
      if (p <= 0) return;
      const start = -Math.PI / 2 + 0.55;
      ctx.beginPath();
      ctx.arc(this.ring.x, this.ring.y, this.ring.r, start, start + (TAU - 1.1) * p);
      ctx.strokeStyle = 'rgba(94, 107, 92, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Planted flowers are stored relative to the ring so they follow it on resize.
    plant(x, y) {
      const rng = mulberry32((Math.random() * 2 ** 32) >>> 0);
      const { r } = this.ring;
      const h = Math.max(36, Math.min(r * (0.45 + rng() * 0.45), y - 16));
      const f = makeFlower(rng, { mode: 'free', dx: (x - this.ring.x) / r, dy: (y - this.ring.y) / r, hs: h / r }, {
        born: now(), dur: 2.1 + rng() * 0.5,
      });
      this.flowers.push(f);
      const planted = this.flowers.filter(fl => fl.place.mode === 'free' && !fl.dying);
      if (planted.length > MAX_PLANTED) {
        if (reduced) this.flowers.splice(this.flowers.indexOf(planted[0]), 1);
        else planted[0].dying = now();
      }
    }
  }

  class BorderScene extends Scene {
    constructor(canvas) {
      super(canvas);
      this.bends = true;
      this.bendRadius = 50;
      this.builtFor = 0;
    }
    layout() {
      // Rebuild the row only when the width changes enough to need a different count.
      const count = Math.max(6, Math.floor(this.w / 30));
      if (count === this.builtFor) return;
      this.builtFor = count;
      const rng = mulberry32(this.seed);
      this.flowers = [];
      for (let i = 0; i < count; i++) {
        this.flowers.push(makeFlower(rng, { u: (i + 0.2 + rng() * 0.6) / count, hs: 0.3 + rng() * 0.62 }, {
          weights: { sprig: 0.34, bud: 0.3, bloom: 0.24, cup: 0.12 },
          leaves: Math.floor(rng() * 3),
          lean: (rng() - 0.5) * 0.4,
          delay: rng() * 1.4,
          dur: 1.6 + rng() * 0.8,
          born: this.started,
        }));
      }
    }
    resolve(f) { return { x: f.place.u * this.w, y: this.h, h: f.place.hs * (this.h - 8) }; }
  }

  class BloomScene extends Scene {
    constructor(canvas) {
      super(canvas);
      const rng = mulberry32(this.seed);
      this.flower = makeFlower(rng, {}, { type: 'bloom', fill: canvas.dataset.fill || pick(rng, PETAL_FILLS) });
      this.flower.petals = 5 + Math.floor(rng() * 2);
      this.leafAngles = [Math.PI * 0.72 + rng() * 0.2, Math.PI * 0.28 - rng() * 0.2];
    }
    frame(t) {
      const ctx = this.ctx, f = this.flower;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const open = reduced ? 1 : easeOut(clamp((t - this.started - 0.2) / 1.8));
      const size = Math.min(this.w, this.h) * 0.27;
      const breathe = reduced ? 0 : Math.sin(t * 0.6 + f.phase) * 0.05;
      ctx.save();
      ctx.translate(this.w / 2, this.h / 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const a of this.leafAngles) {
        drawLeaf(ctx, Math.cos(a) * size * 0.25, Math.sin(a) * size * 0.25, a + breathe, size * 1.25 * easeOut(clamp(open * 1.4)), this.style);
      }
      ctx.rotate(breathe);
      drawBloom(ctx, f, size, open, this.style);
      ctx.restore();
    }
  }

  const SCENES = { garden: GardenScene, border: BorderScene, bloom: BloomScene };

  // ---------- loop ----------
  const scenes = [];
  let rafId = 0;
  let last = now();

  function tick() {
    rafId = 0;
    const t = now();
    const dt = Math.min(0.05, t - last);
    last = t;
    let active = false;
    for (const s of scenes) {
      if (!s.visible) continue;
      s.frame(t, dt);
      active = true;
    }
    if (active && !reduced) rafId = requestAnimationFrame(tick);
  }

  function requestDraw() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function mount() {
    const observer = new IntersectionObserver(entries => {
      for (const e of entries) {
        const s = e.target.__scene;
        s.visible = e.isIntersecting;
        if (s.visible) s.start(now());
      }
      requestDraw();
    }, { threshold: 0.12 });

    document.querySelectorAll('canvas[data-botanical]').forEach(canvas => {
      const Type = SCENES[canvas.dataset.botanical];
      if (!Type) return;
      const s = new Type(canvas);
      canvas.__scene = s;
      s.resize();
      scenes.push(s);
      observer.observe(canvas);

      if (s.bends) {
        const target = canvas.parentElement;
        target.addEventListener('pointermove', e => {
          const r = canvas.getBoundingClientRect();
          s.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
        }, { passive: true });
        target.addEventListener('pointerleave', () => { s.pointer = null; });
        target.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') s.pointer = null; });
      }
      if (s.interactive) {
        canvas.addEventListener('click', e => {
          const r = canvas.getBoundingClientRect();
          s.plant(e.clientX - r.left, e.clientY - r.top);
          requestDraw();
        });
        canvas.addEventListener('keydown', e => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          const { x, y, r } = s.ring;
          s.plant(x + (Math.random() - 0.5) * 1.5 * r, y + (0.55 + Math.random() * 0.3) * r);
          requestDraw();
        });
      }
    });

    // Re-fit a canvas whenever its box (or a garden's anchor) changes size. Measuring
    // once at load is not enough: Safari can run this before styles apply, leaving
    // the canvas at the default 300x150 and stretched.
    const resizer = new ResizeObserver(entries => {
      const dirty = new Set();
      for (const e of entries) (e.target.__scenes || []).forEach(sc => dirty.add(sc));
      dirty.forEach(sc => sc.resize());
      if (dirty.size) requestDraw();
    });
    const watch = (el, sc) => {
      (el.__scenes ||= []).push(sc);
      resizer.observe(el);
    };
    scenes.forEach(sc => {
      watch(sc.canvas, sc);
      if (sc.anchor && sc.anchor !== sc.canvas) watch(sc.anchor, sc);
    });
    motionQuery.addEventListener('change', e => {
      reduced = e.matches;
      requestDraw();
    });
  }

  // A faint procedural paper grain behind the whole page.
  function paperGrain() {
    const size = 180;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const rng = mulberry32(2021);
    g.fillStyle = COLORS.charcoal;
    for (let i = 0; i < 140; i++) {
      g.globalAlpha = 0.03 + rng() * 0.04;
      g.fillRect(rng() * size, rng() * size, 1, 1);
    }
    document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`);
  }

  paperGrain();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
