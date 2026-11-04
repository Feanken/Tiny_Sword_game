/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installMath = function ({math, session}) {
    math.seededRandom = function seededRandom(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};};

    math.nearest = function nearest(entity, candidates, limit = Infinity) {
      let target = null;
      for (const other of candidates) { if (other.hp <= 0) continue; const d = math.dist(entity, other); if (d < limit) { limit = d; target = other; } }
      return target;
    };

    math.segmentHit = function segmentHit(a, b, target, radius) {
      const dx=b.x-a.x,dy=b.y-a.y,ox=a.x-target.x,oy=a.y-target.y;
      const c=ox*ox+oy*oy-radius*radius;
      if(c<=0)return 0;
      const length=dx*dx+dy*dy;if(length===0)return Infinity;
      const projection=ox*dx+oy*dy,disc=projection*projection-length*c;
      if(disc<0)return Infinity;
      const t=(-projection-Math.sqrt(disc))/length;
      return t>=0&&t<=1?t:Infinity;
    };

    math.rand = (a, b) => a + session.gameRandom() * (b - a);

    math.clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    math.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    math.unitPath = (color, kind, action) => {
      const names = { Warrior: `Warrior_${action}`, Archer: `Archer_${action}`, Lancer: `Lancer_${action}`, Monk: action, Pawn: `Pawn_${action}` };
      return `Units/${color} Units/${kind}/${names[kind]}.png`;
    };

    math.terrain = p => `Terrain/${p}.png`;

    math.blue = (kind, action) => math.unitPath('Blue', kind, action);
  };
})(window.PenjagaModules = window.PenjagaModules || {});
