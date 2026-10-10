// Purpose: verify that exchanges make the full round trip, stay bounded, react to clicks and draw without errors.
const test = require('node:test');
const assert = require('node:assert/strict');
const Field = require('../docs/exchange-field.js');

function recorder() {
  const calls = [];
  const gradient = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient') return () => gradient;
      return (...args) => { calls.push(key); return undefined; };
    },
    set() { return true; }
  });
}

test('the first frame already shows exchanges in progress', () => {
  const f = new Field();
  assert.ok(f.nodes.length >= 20);
  f.advance(0);
  assert.ok(f.exchanges.length > 0);
});

test('a review goes out and a reply comes back, in that order', () => {
  const f = new Field(5);
  f.advance(0);
  const e = f.exchanges[f.exchanges.length - 1];
  const p = f.phases(e);
  const a = f.nodes[e.a], b = f.nodes[e.b];
  const before = { given: a.given, received: b.received };
  f.advance(Math.max(f.time, p.out - 1));
  assert.equal(e.arrivedB, false);
  f.advance(p.out);
  assert.equal(e.arrivedB, true);
  assert.equal(e.arrivedA, false);
  assert.equal(b.received, before.received + 1);
  f.advance(p.home);
  assert.equal(e.arrivedA, true);
  assert.equal(a.given, before.given + 1);
  f.advance(p.end + 1);
  assert.ok(!f.exchanges.includes(e));
});

test('partners are neither neighbours nor across the whole screen', () => {
  const f = new Field(9);
  for (let t = 0; t <= 600000; t += 500) {
    f.advance(t);
    for (const e of f.exchanges) {
      const a = f.nodes[e.a], b = f.nodes[e.b];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(d > .14 && d < .6, `distance ${d}`);
    }
  }
});

test('hours of exchanges stay within bounds', () => {
  for (const seed of [1, 20261010, 98217]) {
    const f = new Field(seed);
    let seen = 0;
    for (let t = 0; t <= 7200000; t += 1000) {
      f.advance(t);
      assert.ok(f.exchanges.length <= f.maxExchanges);
      seen += f.exchanges.length > 0 ? 1 : 0;
    }
    assert.ok(seen > 7000, 'exchanges keep happening');
  }
});

test('a click starts an exchange from the nearest point', () => {
  const f = new Field(3);
  f.advance(1000);
  const target = f.nodes[4];
  f.pulse(target.x + .001, target.y + .001);
  const e = f.exchanges[f.exchanges.length - 1];
  assert.equal(e.a, target.id);
  assert.equal(e.born, 1000);
  f.pulse(NaN, .5);
  assert.equal(f.pulses.length, 1);
});

test('time never runs backwards and bad values are ignored', () => {
  const f = new Field();
  f.advance(5000);
  const n = f.exchanges.length;
  f.advance(4000);
  f.advance(Infinity);
  assert.equal(f.time, 5000);
  assert.equal(f.exchanges.length, n);
});

test('curves start and end on their points', () => {
  assert.deepEqual(Field.curve(1, 2, 9, 7, .2, 0), [1, 2]);
  assert.deepEqual(Field.curve(1, 2, 9, 7, .2, 1), [9, 7]);
  const [mx, my] = Field.curve(0, 0, 10, 0, .25, .5);
  assert.equal(mx, 5);
  assert.ok(Math.abs(my - 1.25) < 1e-9);
});

test('drawing runs with and without a pointer', () => {
  const f = new Field();
  for (const t of [0, 1200, 4800, 9000]) {
    f.advance(t);
    const ctx = recorder();
    f.draw(ctx, 1280, 900, t);
    f.setPointer(.5, .5);
    f.draw(ctx, 1280, 900, t);
    f.clearInteraction();
    assert.ok(ctx.calls.includes('stroke'));
    assert.ok(ctx.calls.includes('arc'));
  }
});
