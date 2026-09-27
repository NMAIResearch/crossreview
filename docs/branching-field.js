// Purpose: irregular, bounded lineages with lasting junctions and fading offshoots.
"use strict";
(() => {
  class BranchingField {
    constructor(seed = 7349) {
      this.seed = seed >>> 0;
      this.nodes = [];
      this.branches = [];
      this.nextId = 0;
      this.maxNodes = 72;
      this.maxBranches = 240;
      this.time = -48000;
      this.addNode(.09, .94, 1, -48000, 6);
      this.addNode(.90, .66, -1, -48000, 3);
      this.addNode(.08, .36, 1, -48000, 9);
      for (let time = -47000; time <= 0; time += 1000) this.advance(time);
    }

    random() {
      this.seed = (1664525 * this.seed + 1013904223) >>> 0;
      return this.seed / 4294967296;
    }

    offspring() {
      const draw = this.random();
      if (draw < .34) return 0;
      if (draw < .65) return 1;
      if (draw < .93) return 2 + Math.floor(this.random() * 4);
      return 8 + Math.floor(this.random() * 13);
    }

    addNode(x, y, direction, born, count = this.offspring()) {
      const node = {id: this.nextId++, x, y, direction, born, count,
        remaining: count, nextAt: born + 2500 + this.random() * 7000,
        phase: this.random() * Math.PI * 2};
      this.nodes.push(node);
      return node;
    }

    sprout(parent, time, ambient = false) {
      if (this.branches.length >= this.maxBranches) return false;
      const spread = (this.random() - .5) * .18;
      const x = Math.max(.02, Math.min(.98, parent.x + parent.direction * (.025 + this.random() * .08) + spread));
      const y = Math.max(.018, parent.y - .015 - this.random() * .055);
      if (Math.abs(x - parent.x) < .004 || parent.y < .03) return false;
      const lasting = !ambient && this.nodes.length + this.branches.filter(b => b.lasting && !b.settled).length < this.maxNodes && this.random() < .40;
      this.branches.push({parentId: parent.id, x: parent.x, y: parent.y,
        endX: x, endY: y, born: time, duration: 2800 + this.random() * 6500,
        hold: 2000 + this.random() * 5000, fade: 3500 + this.random() * 5000,
        lasting, settled: false, direction: parent.direction,
        phase: this.random() * Math.PI * 2});
      return true;
    }

    advance(time) {
      if (!Number.isFinite(time) || time < this.time) return;
      this.time = time;
      for (const branch of this.branches) {
        if (branch.lasting && !branch.settled && time >= branch.born + branch.duration) {
          branch.settled = true;
          this.addNode(branch.endX, branch.endY, branch.direction, time);
        }
      }
      this.branches = this.branches.filter(b => b.lasting || time < b.born + b.duration + b.hold + b.fade);
      for (const node of this.nodes) {
        if (!node.count || time < node.nextAt) continue;
        const ambient = node.remaining === 0;
        if (this.sprout(node, time, ambient) && node.remaining > 0) node.remaining--;
        node.nextAt = time + (ambient ? 22000 : 2200) + this.random() * (ambient ? 45000 : 6000);
      }
    }

    draw(ctx, width, height, time) {
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const b of this.branches) {
        const age = time - b.born;
        const growth = Math.max(0, Math.min(1, age / b.duration));
        const fade = b.lasting ? 1 : Math.max(0, 1 - Math.max(0, age - b.duration - b.hold) / b.fade);
        const x = b.x * width, y = b.y * height;
        const endX = b.endX * width, endY = b.endY * height;
        const elbowY = y + (endY - y) * .6;
        const points = [[x, y], [x, elbowY], [endX, elbowY], [endX, endY]];
        const lengths = [Math.abs(elbowY-y), Math.abs(endX-x), Math.abs(endY-elbowY)];
        let remaining = lengths.reduce((a, v) => a + v, 0) * growth;
        ctx.strokeStyle = `rgba(128,184,159,${(b.lasting ? .35 : .30) * fade})`;
        ctx.lineWidth = b.lasting ? 1.1 : .7;
        ctx.beginPath();ctx.moveTo(x, y);
        let tipX = x, tipY = y;
        for (let i = 0; i < lengths.length; i++) {
          const fraction = lengths[i] ? Math.min(1, remaining / lengths[i]) : 1;
          tipX = points[i][0] + (points[i+1][0] - points[i][0]) * fraction;
          tipY = points[i][1] + (points[i+1][1] - points[i][1]) * fraction;
          ctx.lineTo(tipX, tipY);
          remaining = Math.max(0, remaining - lengths[i]);
          if (fraction < 1) break;
        }
        ctx.stroke();
        if (growth < 1 || !b.lasting) {
          ctx.fillStyle = `rgba(196,224,170,${.65 * fade})`;
          ctx.beginPath();ctx.arc(tipX, tipY, 1.25, 0, Math.PI*2);ctx.fill();
        }
      }
      for (const n of this.nodes) {
        const x = n.x * width, y = n.y * height;
        const pulse = .82 + .18 * Math.sin(time * .00035 + n.phase);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 13);
        glow.addColorStop(0, `rgba(214,243,154,${.42 * pulse})`);
        glow.addColorStop(1, "rgba(214,243,154,0)");
        ctx.fillStyle = glow;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();
        ctx.fillStyle = `rgba(220,245,184,${.82 * pulse})`;
        ctx.beginPath();ctx.arc(x,y,1.8,0,Math.PI*2);ctx.fill();
      }
    }
  }
  if (typeof module !== "undefined" && module.exports) module.exports = BranchingField;
  else window.CrossreviewBranchingField = BranchingField;
})();
