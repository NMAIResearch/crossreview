// Purpose: verify lasting lineages, fading offshoots and bounded long-running state.
const test = require('node:test');
const assert = require('node:assert/strict');
const Field = require('../docs/branching-field.js');

test('established junctions persist while new generations appear', () => {
  const f = new Field();
  const initial = f.nodes.map(n => ({id:n.id,x:n.x,y:n.y}));
  for(let t=1000;t<=180000;t+=1000)f.advance(t);
  assert.ok(f.nodes.length > initial.length);
  for(const n of initial){
    const found=f.nodes.find(v=>v.id===n.id);
    assert.ok(found);assert.equal(found.x,n.x);assert.equal(found.y,n.y);
  }
});

test('transient offshoots expire without removing their established parent', () => {
  const f=new Field();const branch=f.branches.find(b=>!b.lasting);
  assert.ok(branch);
  const end=branch.born+branch.duration+branch.hold+branch.fade;
  f.advance(Math.max(f.time,end+1));
  assert.ok(!f.branches.includes(branch));
  assert.ok(f.nodes.some(n=>n.id===branch.parentId));
});

test('offspring counts include zero and occasional large families', () => {
  const f=new Field();const counts=Array.from({length:2000},()=>f.offspring());
  assert.ok(counts.includes(0));assert.ok(counts.includes(20));
  assert.ok(new Set(counts).size>5);
  assert.ok(counts.every(n=>Number.isInteger(n)&&n>=0&&n<=20));
});

test('hours of growth stay within storage bounds', () => {
  for(const seed of [1,7349,98217]){
    const f=new Field(seed);
    for(let t=1000;t<=7200000;t+=1000){
      f.advance(t);
      assert.ok(f.nodes.length<=f.maxNodes);
      assert.ok(f.branches.length<=f.maxBranches);
    }
    assert.equal(new Set(f.nodes.map(n=>n.id)).size,f.nodes.length);
  }
});

test('dense growth reserves capacity for future lasting junctions', () => {
  const f=new Field();f.nodes=[];f.branches=[];
  f.offspring=()=>20;f.random=()=>.3;
  f.addNode(.15,.9,1,0,20);
  for(let t=1000;t<=600000;t+=1000){
    f.advance(t);
    assert.ok(f.nodes.length<=f.maxNodes);
    assert.ok(f.branches.length<=f.maxBranches);
  }
  assert.equal(f.nodes.length,f.maxNodes);
});

test('lasting connections remain after transient lifetimes expire', () => {
  const f=new Field();const lasting=f.branches.filter(b=>b.lasting);
  assert.ok(lasting.length>0);
  for(let t=1000;t<=120000;t+=1000)f.advance(t);
  assert.ok(lasting.every(b=>f.branches.includes(b)));
});

test('invalid or reversed time does not rewrite the lineage', () => {
  const f=new Field();f.advance(1000);const before=JSON.stringify(f);
  f.advance(NaN);f.advance(Infinity);f.advance(-1);
  assert.equal(JSON.stringify(f),before);
});

test('five starting trees each establish a lasting branch', () => {
  for(const seed of [1,7349,98217]){
    const f=new Field(seed);const roots=f.nodes.filter(n=>n.born===f.origin);
    assert.equal(roots.length,5);
    for(let t=1000;t<=120000;t+=1000)f.advance(t);
    for(const root of roots)assert.ok(f.branches.some(b=>b.parentId===root.id&&b.lasting));
  }
});

test('growth is balanced between left and right rather than leaning one way', () => {
  for(const seed of [1,7349,98217]){
    const f=new Field(seed);const seen=new Set();let right=0;
    for(let t=1000;t<=600000;t+=1000){
      f.advance(t);
      for(const b of f.branches){if(seen.has(b))continue;seen.add(b);if(b.endX>b.x)right++;}
    }
    const share=right/seen.size;
    assert.ok(share>.40&&share<.60,`rightward share ${share}`);
  }
});
