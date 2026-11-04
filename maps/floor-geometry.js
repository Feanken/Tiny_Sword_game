/* Shared floor geometry for authoring, collision, navigation and rendering. */
((root) => {
  'use strict';
  const defaults = Object.freeze({footRadius:23, footSamples:8, obstaclePadding:10, overlapTolerance:.01});
  function createFloor(map, regionIds = map.regions?.map(r => r.id)) {
    const active = new Set(regionIds);
    const rectangles = [], bounds = new Map();
    const add = (x,y,width,height,regionId,kind) => {
      if (width > 0 && height > 0) rectangles.push(Object.freeze({x,y,width,height,regionId,kind}));
    };
    const islands = map.version === 2 ? map.regions : [{
      id:'legacy-land',kind:'island',origin:{x:0,y:0},localBounds:map.landBounds,
      maskRows:Object.fromEntries(Object.entries(map.rows).map(([r,span]) => [r,[span]]))
    }];
    for (const region of islands) {
      if (map.version === 2 && !active.has(region.id)) continue;
      if (region.kind === 'island') {
        const o = region.origin, b = region.localBounds, size = map.tileSize;
        bounds.set(region.id, {left:o.x+b.left,right:o.x+b.right,top:o.y+b.top,bottom:o.y+b.bottom});
        for (const [row,spans] of Object.entries(region.maskRows)) for (const [left,right] of spans) {
          const x = Math.max(left*size,b.left), y = Math.max(Number(row)*size,b.top);
          add(o.x+x,o.y+y,Math.min((right+1)*size,b.right)-x,
            Math.min((Number(row)+1)*size,b.bottom)-y,region.id,'island');
        }
      } else {
        const half = region.width/2;
        for (let i=1;i<region.centerline.length;i++) {
          const a=region.centerline[i-1], b=region.centerline[i];
          add(Math.min(a.x,b.x)-half,Math.min(a.y,b.y)-half,
            Math.abs(b.x-a.x)+region.width,Math.abs(b.y-a.y)+region.width,region.id,'bridge');
        }
      }
    }
    // Row buckets keep footprint queries independent of total map height.
    const buckets = new Map();
    for (const rect of rectangles) {
      for(let row=Math.floor(rect.y/map.tileSize);row<=Math.floor((rect.y+rect.height)/map.tileSize);row++) {
        if(!buckets.has(row)) buckets.set(row,[]);
        buckets.get(row).push(rect);
      }
    }
    function contains(x,y) {
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=map.width||y>=map.height)return false;
      return (buckets.get(Math.floor(y/map.tileSize))||[]).some(r => {
        if(!(x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height))return false;
        const b=bounds.get(r.regionId);
        return !b || x>b.left&&x<b.right&&y>b.top&&y<b.bottom;
      });
    }
    const profile = Object.freeze({...defaults,...map.collision});
    function canStand(x,y) {
      if(!contains(x,y))return false;
      for(let i=0;i<profile.footSamples;i++) {
        const a=i*Math.PI*2/profile.footSamples;
        if(!contains(x+Math.cos(a)*profile.footRadius,y+Math.sin(a)*profile.footRadius))return false;
      }
      return true;
    }
    function positionFits(x,y,obstacles=[],entity) {
      return canStand(x,y)&&obstacles.every(o => {
        const distance=Math.hypot(x-o.x,y-o.y);
        return distance>=o.radius+profile.obstaclePadding-profile.overlapTolerance ||
          !!entity&&distance>Math.hypot(entity.x-o.x,entity.y-o.y)+.001;
      });
    }
    // Continuous line coverage: split at every floor edge, inspect each interval.
    // Unlike fixed-distance sampling, this also catches a grazing circle or a
    // narrow water gap between two otherwise valid endpoints.
    function segmentFits(a,b,obstacles=[]) {
      if(!canStand(a.x,a.y)||!canStand(b.x,b.y))return false;
      const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy,pad=profile.footRadius;
      const nearby=rectangles.filter(r=>r.x<=Math.max(a.x,b.x)+pad&&r.x+r.width>=Math.min(a.x,b.x)-pad&&
        r.y<=Math.max(a.y,b.y)+pad&&r.y+r.height>=Math.min(a.y,b.y)-pad);
      function covered(ox,oy){
        const cuts=new Set([0,1]),x=a.x+ox,y=a.y+oy;
        for(const r of nearby){
          if(dx)for(const edge of [r.x,r.x+r.width]){const t=(edge-x)/dx;if(t>0&&t<1)cuts.add(t);}
          if(dy)for(const edge of [r.y,r.y+r.height]){const t=(edge-y)/dy;if(t>0&&t<1)cuts.add(t);}
        }
        const times=[...cuts].sort((v,w)=>v-w);
        for(let i=0;i<times.length;i++){
          const t=times[i];
          if(!contains(x+dx*t,y+dy*t))return false;
          if(i&& !contains(x+dx*(t+times[i-1])/2,y+dy*(t+times[i-1])/2))return false;
        }
        return true;
      }
      if(!covered(0,0))return false;
      for(let i=0;i<profile.footSamples;i++){
        const angle=i*Math.PI*2/profile.footSamples;
        if(!covered(Math.cos(angle)*pad,Math.sin(angle)*pad))return false;
      }
      return obstacles.every(o=>{
        const t=length?Math.max(0,Math.min(1,((o.x-a.x)*dx+(o.y-a.y)*dy)/length)):0;
        return Math.hypot(a.x+dx*t-o.x,a.y+dy*t-o.y)>=o.radius+profile.obstaclePadding-profile.overlapTolerance;
      });
    }
    // Exact rectangle-union coverage, including narrow gaps and jitter interiors.
    function coversRect(rect) {
      const {left,right,top,bottom}=rect;
      if(![left,right,top,bottom].every(Number.isFinite)||left>right||top>bottom)return false;
      const ys=new Set([top,bottom]);
      for(const r of rectangles) for(const y of [r.y,r.y+r.height]) if(y>top&&y<bottom)ys.add(y);
      const cuts=[...ys].sort((a,b)=>a-b), samples=[...cuts];
      for(let i=1;i<cuts.length;i++)samples.push((cuts[i-1]+cuts[i])/2);
      for(const y of samples) {
        if(!contains(left,y)||!contains(right,y))return false;
        let reached=left;
        const spans=rectangles.filter(r=>y>=r.y&&y<r.y+r.height)
          .map(r=>[r.x,r.x+r.width]).sort((a,b)=>a[0]-b[0]);
        for(const [a,b] of spans){if(a>reached)break;if(b>reached)reached=b;}
        if(reached<right)return false;
      }
      return true;
    }
    return Object.freeze({rectangles:Object.freeze(rectangles),contains,canStand,positionFits,segmentFits,coversRect,collision:profile});
  }
  root.PenjagaFloor=Object.freeze({createFloor,defaults});
})(typeof window==='object'?window:globalThis);
