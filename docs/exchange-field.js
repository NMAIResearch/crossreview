// Purpose: the background of the exchange. Quiet points stand for people and their work. Every few seconds a light
// carries a review along a curved thread from one point to another, and a reply comes back along the mirrored curve:
// give one, get one. The two arcs leave a faint lens that fades, so recent exchanges form a soft web.
// Same interface as the earlier branching field: advance(time), draw(ctx, width, height, time), setPointer(x, y),
// clearInteraction(), pulse(x, y). Positions are fractions of the canvas, which covers the viewport.
"use strict";
(() => {
  class ExchangeField {
    constructor(seed = 20261010) {
      this.seed = seed >>> 0;
      this.nodes = [];
      this.exchanges = [];
      this.pulses = [];
      this.pointer = null;
      this.maxExchanges = 7;
      this.time = -14000;
      this.nextAt = -14000;
      // A jittered grid keeps the points spread evenly without looking regular.
      const cols = 7, rows = 5;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (this.random() < .18) continue;
          this.nodes.push({ id: this.nodes.length, x: (c + .2 + this.random() * .6) / cols, y: (r + .2 + this.random() * .6) / rows,
            given: 0, received: 0, phase: this.random() * Math.PI * 2, lastPulse: -1e9 });
        }
      }
      // Start mid-conversation so the first frame is not empty.
      for (let t = -14000; t < 0; t += 500) this.advance(t);
    }

    random() {
      this.seed = (1664525 * this.seed + 1013904223) >>> 0;
      return this.seed / 4294967296;
    }

    setPointer(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      this.pointer = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    }

    clearInteraction() {
      this.pointer = null;
      this.pulses = [];
    }

    // A click starts an exchange from the nearest point.
    pulse(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      this.pulses.push({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), born: this.time });
      this.pulses = this.pulses.slice(-6);
      let nearest = null, best = Infinity;
      for (const n of this.nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < best) { best = d; nearest = n; }
      }
      if (nearest) this.start(this.time, nearest);
    }

    partnerFor(from) {
      const options = this.nodes.filter(n => n !== from && Math.hypot(n.x - from.x, n.y - from.y) > .14 && Math.hypot(n.x - from.x, n.y - from.y) < .6);
      return options.length ? options[Math.floor(this.random() * options.length)] : null;
    }

    start(time, from = null) {
      if (this.exchanges.length >= this.maxExchanges) this.exchanges.shift();
      const a = from || this.nodes[Math.floor(this.random() * this.nodes.length)];
      const b = this.partnerFor(a);
      if (!b) return false;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const travel = 1900 + length * 2600 + this.random() * 500;
      this.exchanges.push({ a: a.id, b: b.id, born: time, travel, pause: 450 + this.random() * 400,
        bend: (.18 + this.random() * .1) * (this.random() < .5 ? -1 : 1), hold: 2600, fade: 5200, arrivedB: false, arrivedA: false });
      return true;
    }

    // Phase times of one exchange: out, pause, back, hold, fade.
    phases(e) {
      const out = e.born + e.travel, back = out + e.pause, home = back + e.travel;
      return { out, back, home, end: home + e.hold + e.fade };
    }

    advance(time) {
      if (!Number.isFinite(time) || time < this.time) return;
      this.time = time;
      this.pulses = this.pulses.filter(p => time - p.born <= 1400);
      for (const e of this.exchanges) {
        const p = this.phases(e);
        if (!e.arrivedB && time >= p.out) { e.arrivedB = true; const n = this.nodes[e.b]; n.received++; n.lastPulse = p.out; }
        if (!e.arrivedA && time >= p.home) { e.arrivedA = true; const n = this.nodes[e.a]; n.given++; n.lastPulse = p.home; }
      }
      this.exchanges = this.exchanges.filter(e => time < this.phases(e).end);
      if (time >= this.nextAt) {
        this.start(time);
        this.nextAt = time + 1500 + this.random() * 1700;
      }
    }

    // Point at fraction t along the quadratic curve from p to q, bowed by `bend` of the chord length.
    static curve(px, py, qx, qy, bend, t) {
      const mx = (px + qx) / 2, my = (py + qy) / 2, dx = qx - px, dy = qy - py;
      const cx = mx - dy * bend, cy = my + dx * bend, u = 1 - t;
      return [u * u * px + 2 * u * t * cx + t * t * qx, u * u * py + 2 * u * t * cy + t * t * qy];
    }

    near(x, y, width, height) {
      if (!this.pointer) return 0;
      const d = Math.hypot(this.pointer.x * width - x, this.pointer.y * height - y);
      return Math.max(0, 1 - d / 190);
    }

    thread(ctx, px, py, qx, qy, bend, from, to, alpha, width) {
      ctx.strokeStyle = `rgba(148,204,168,${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      const steps = 28;
      for (let i = 0; i <= steps; i++) {
        const t = from + (to - from) * i / steps;
        const [x, y] = ExchangeField.curve(px, py, qx, qy, bend, t);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    light(ctx, px, py, qx, qy, bend, t) {
      const ease = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const [x, y] = ExchangeField.curve(px, py, qx, qy, bend, ease);
      this.thread(ctx, px, py, qx, qy, bend, Math.max(0, ease - .14), ease, .55, 1.3);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 14);
      glow.addColorStop(0, "rgba(214,243,154,.55)");
      glow.addColorStop(1, "rgba(214,243,154,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(232,250,200,.95)";
      ctx.beginPath(); ctx.arc(x, y, 2.1, 0, Math.PI * 2); ctx.fill();
      return ease;
    }

    draw(ctx, width, height, time) {
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (this.pointer) {
        const x = this.pointer.x * width, y = this.pointer.y * height;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 190);
        glow.addColorStop(0, "rgba(175,224,145,.09)");
        glow.addColorStop(1, "rgba(106,169,150,0)");
        ctx.fillStyle = glow; ctx.fillRect(x - 190, y - 190, 380, 380);
      }
      for (const e of this.exchanges) {
        const a = this.nodes[e.a], b = this.nodes[e.b], p = this.phases(e);
        const ax = a.x * width, ay = a.y * height, bx = b.x * width, by = b.y * height;
        const fade = time < p.home + e.hold ? 1 : Math.max(0, 1 - (time - p.home - e.hold) / e.fade);
        const lift = this.near((ax + bx) / 2, (ay + by) / 2, width, height) * .25;
        const base = (.2 + lift) * fade;
        // Out: the review travels from a to b.
        if (time < p.out) this.light(ctx, ax, ay, bx, by, e.bend, (time - e.born) / e.travel);
        const outDrawn = Math.min(1, Math.max(0, (time - e.born) / e.travel));
        const outEase = outDrawn < .5 ? 2 * outDrawn * outDrawn : 1 - Math.pow(-2 * outDrawn + 2, 2) / 2;
        if (outEase > 0) this.thread(ctx, ax, ay, bx, by, e.bend, 0, outEase, base, .9);
        // Back: the reply returns along the mirrored curve.
        if (time >= p.back) {
          const t = Math.min(1, (time - p.back) / e.travel);
          const ease = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          this.thread(ctx, bx, by, ax, ay, e.bend, 0, ease, base, .9);
          if (t < 1) this.light(ctx, bx, by, ax, ay, e.bend, t);
        }
      }
      for (const n of this.nodes) {
        const x = n.x * width, y = n.y * height;
        const breath = .85 + .15 * Math.sin(time * .0004 + n.phase);
        const near = this.near(x, y, width, height);
        const seasoned = Math.min(1, (n.given + n.received) / 6);
        ctx.fillStyle = `rgba(220,245,184,${(.32 + .25 * seasoned + .4 * near) * breath})`;
        ctx.beginPath(); ctx.arc(x, y, 1.6 + near * 1.4, 0, Math.PI * 2); ctx.fill();
        const age = (time - n.lastPulse) / 1600;
        if (age >= 0 && age <= 1) {
          ctx.strokeStyle = `rgba(214,243,154,${(1 - age) * .5})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, 3 + 18 * age, 0, Math.PI * 2); ctx.stroke();
        }
      }
      for (const pulse of this.pulses) {
        const age = (time - pulse.born) / 1400;
        if (age < 0 || age > 1) continue;
        ctx.strokeStyle = `rgba(214,243,154,${(1 - age) * .45})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(pulse.x * width, pulse.y * height, 6 + 60 * age, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
  if (typeof module !== "undefined" && module.exports) module.exports = ExchangeField;
  else window.CrossreviewExchangeField = ExchangeField;
})();
