/* Pure authoring validation. No DOM, fetch, navigation, or game state. */
((root) => {
  'use strict';
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const finite = Number.isFinite;
  const list = value => Array.isArray(value) ? value : [];
  const collections = ['trees', 'goldNodes', 'sheep', 'buildings', 'rocks', 'bushes', 'villagers'];
  const defaults = { footRadius: 23, footSamples: 8, obstaclePadding: 10, overlapTolerance: .01 };
  const collision = map => ({ ...defaults, ...map.collision });
  function onLand(map, x, y) {
    if(map?.version===2)return root.PenjagaFloor.createFloor(map).contains(x,y);
    if (!finite(x) || !finite(y) || !map?.tileSize) return false;
    const b = map.landBounds, row = map.rows?.[Math.floor(y / map.tileSize)];
    return !!b && !!row && x > b.left && x < b.right && y > b.top && y < b.bottom && Math.floor(x / map.tileSize) >= row[0] && Math.floor(x / map.tileSize) <= row[1];
  }
  function canStand(map, x, y) {
    if(map?.version===2)return root.PenjagaFloor.createFloor(map).canStand(x,y);
    if (!onLand(map, x, y)) return false;
    const c = collision(map);
    if (!Number.isInteger(c.footSamples) || c.footSamples < 1 || c.footSamples > 64) return false;
    for (let i = 0; i < c.footSamples; i++) {
      const a = i * Math.PI * 2 / c.footSamples;
      if (!onLand(map, x + Math.cos(a) * c.footRadius, y + Math.sin(a) * c.footRadius)) return false;
    }
    return true;
  }
  function baselineObstacles(map) {
    return [
      ...list(map.trees).filter(object).map(t => ({ x: t.x, y: t.y - 4, radius: t.radius })),
      ...list(map.goldNodes).filter(object).map(n => ({ x: n.x, y: n.y, radius: n.radius })),
      ...list(map.buildings).filter(object).map(b => ({ x: b.x, y: b.cy, radius: b.radius })),
    ];
  }
  function positionFits(map, x, y) {
    if(map?.version===2)return root.PenjagaFloor.createFloor(map).positionFits(x,y,map.obstacles);
    const c = collision(map);
    return canStand(map, x, y) && (map.obstacles || baselineObstacles(map)).every(o => object(o) && Math.hypot(x - o.x, y - o.y) >= o.radius + c.obstaclePadding - c.overlapTolerance);
  }
  function validateMap(map) {
    if(map?.version===2)return validateCampaignMap(map);
    const errors = [];
    const fail = (code, at, message) => errors.push({ code, at, message });
    const shape = (ok, at, message) => { if (!ok) fail('INVALID_DATA', at, message); return !!ok; };
    if (!shape(object(map), '$', 'Map must be an object.')) return { valid: false, errors };
    const point = (p, at) => shape(object(p) && finite(p.x) && finite(p.y), at, 'Expected finite x/y.');
    const positive = (n, at) => shape(finite(n) && n > 0, at, 'Expected a positive finite number.');
    const string = (s, at) => shape(typeof s === 'string' && s.trim().length > 0, at, 'Expected a nonempty string.');
    const ids = new Set();
    const id = (s, at) => { if (string(s, at)) { if (ids.has(s)) fail('DUPLICATE_ID', at, `Duplicate identity: ${s}`); ids.add(s); } };
    shape(map.version === 1, 'version', 'Only version 1 is supported.');
    id(map.id, 'id'); string(map.name, 'name');
    for (const field of ['width', 'height', 'tileSize']) positive(map[field], field);
    const b = map.landBounds;
    shape(object(b) && ['left', 'right', 'top', 'bottom'].every(k => finite(b[k])) && b.left >= 0 && b.top >= 0 && b.left < b.right && b.top < b.bottom && b.right <= map.width && b.bottom <= map.height, 'landBounds', 'Expected ordered exclusive bounds inside the world.');
    if (shape(object(map.rows) && Object.keys(map.rows).length > 0, 'rows', 'Expected a nonempty row mask.')) {
      for (const [r, span] of Object.entries(map.rows)) {
        shape(/^(0|[1-9]\d*)$/.test(r) && Number(r) * map.tileSize < map.height && Array.isArray(span) && span.length === 2 && span.every(Number.isInteger) && span[0] >= 0 && span[0] <= span[1] && (span[1] + 1) * map.tileSize <= map.width, `rows.${r}`, 'Expected a valid inclusive tile-column range.');
      }
    }
    const c = collision(map);
    if (map.collision !== undefined) shape(object(map.collision), 'collision', 'Expected collision settings.');
    positive(c.footRadius, 'collision.footRadius');
    shape(Number.isInteger(c.footSamples) && c.footSamples >= 1 && c.footSamples <= 64, 'collision.footSamples', 'Expected 1–64 samples.');
    shape(finite(c.obstaclePadding) && c.obstaclePadding >= 0 && finite(c.overlapTolerance) && c.overlapTolerance >= 0 && c.overlapTolerance <= c.obstaclePadding, 'collision', 'Invalid padding or overlap tolerance.');
    for (const key of collections) shape(Array.isArray(map[key]), key, 'Expected an array.');
    // Avoid geometric loops until dimensions, row mask and collection shapes are safe.
    if (errors.length) return { valid: false, errors };
    const worldPoint = (p, at) => {
      if (!point(p, at)) return false;
      const ok = p.x >= 0 && p.x < map.width && p.y >= 0 && p.y < map.height;
      if (!ok) fail('OUTSIDE_WORLD', at, 'Anchor is outside the world.');
      return ok;
    };
    const landPoint = (p, at) => {
      if (!worldPoint(p, at)) return;
      if (!onLand(map, p.x, p.y)) fail('OUTSIDE_LAND', at, 'Anchor is outside the valid land mask/bounds.');
    };
    for (const key of collections) map[key].forEach((item, i) => {
      const at = `${key}[${i}]`, tuple = key === 'rocks' || key === 'bushes';
      if (!shape(tuple ? Array.isArray(item) && item.length === 3 : object(item), at, tuple ? 'Expected [x,y,variant].' : 'Expected an object.')) return;
      landPoint(tuple ? { x: item[0], y: item[1] } : item, at);
      if (tuple || key === 'trees' || key === 'goldNodes') shape(Number.isInteger(tuple ? item[2] : item.variant) && (tuple ? item[2] : item.variant) >= 1 && (tuple ? item[2] : item.variant) <= 4, `${at}.variant`, 'Expected variant 1–4.');
      if (['trees', 'goldNodes', 'buildings'].includes(key)) positive(item.radius, `${at}.radius`);
      if (key === 'trees') { positive(item.size, `${at}.size`); shape(finite(item.seed) && typeof item.resource === 'boolean', at, 'Tree needs seed and resource flag.'); }
      if (key === 'sheep') { landPoint({ x: item.originX, y: item.originY }, `${at}.origin`); shape(finite(item.seed) && finite(item.cooldown) && item.cooldown >= 0, at, 'Sheep needs seed and nonnegative initial cooldown.'); }
      if (key === 'buildings') { string(item.name, `${at}.name`); string(item.color, `${at}.color`); positive(item.width, `${at}.width`); landPoint({ x: item.x, y: item.cy }, `${at}.collider`); }
      if (key === 'villagers') { string(item.tool, `${at}.tool`); string(item.type, `${at}.type`); shape(item.facing === -1 || item.facing === 1, `${at}.facing`, 'Expected -1 or 1.'); }
    });
    const extended = map.layoutVersion !== undefined;
    const sources = new Map();
    if (extended) {
      shape(map.layoutVersion === 1, 'layoutVersion', 'Only layoutVersion 1 is supported.');
      if (shape(object(map.objectIds), 'objectIds', 'Expected sidecar identities.')) for (const key of collections) {
        const names = map.objectIds[key];
        if (shape(Array.isArray(names) && names.length === map[key].length, `objectIds.${key}`, 'IDs must align 1:1 with the baseline array.')) names.forEach((name, i) => { id(name, `objectIds.${key}[${i}]`); sources.set(name, { collection: key, index: i, value: map[key][i] }); });
      }
      for (const key of ['roads', 'paths', 'enemySpawns', 'decorations', 'obstacles', 'initialAllies']) {
        if (shape(Array.isArray(map[key]), key, 'Expected an array.')) map[key].forEach((item, i) => { if (shape(object(item), `${key}[${i}]`, 'Expected an object.')) id(item.id, `${key}[${i}].id`); });
      }
      if (shape(object(map.fortress), 'fortress', 'Expected a fortress reference.')) {
        id(map.fortress.id, 'fortress.id');
        if (sources.get(map.fortress.buildingId)?.collection !== 'buildings') fail('MISSING_REFERENCE', 'fortress.buildingId', 'Fortress must reference a building ID.');
      }
    }
    const obstacles = extended ? list(map.obstacles) : baselineObstacles(map);
    const collidableSources = new Set();
    obstacles.forEach((o, i) => {
      const at = `obstacles[${i}]`;
      if (!object(o)) return;
      landPoint(o, at); positive(o.radius, `${at}.radius`);
      if (o.sourceId !== undefined) {
        const source = sources.get(o.sourceId);
        if (!source) fail('MISSING_REFERENCE', `${at}.sourceId`, 'Unknown object identity.');
        else {
          const { collection: key, value: v } = source;
          if (!v || !['trees', 'goldNodes', 'buildings'].includes(key)) fail('INVALID_DATA', `${at}.sourceId`, 'Only trees, gold nodes and buildings supply baseline colliders.');
          else if (o.x !== v.x || o.y !== (key === 'trees' ? v.y - 4 : key === 'buildings' ? v.cy : v.y) || o.radius !== v.radius) fail('COLLIDER_MISMATCH', at, 'Collider differs from the source geometry.');
          if (collidableSources.has(o.sourceId)) fail('DUPLICATE_REFERENCE', `${at}.sourceId`, 'Object already has a collider.');
          collidableSources.add(o.sourceId);
        }
      }
    });
    if (extended) for (const key of ['trees', 'goldNodes', 'buildings']) for (const name of list(map.objectIds?.[key])) if (!collidableSources.has(name)) fail('MISSING_COLLIDER', `objectIds.${key}`, `Missing collider for ${name}.`);
    // Exact rectangle/mask and rectangle/circle checks cover every jitter value,
    // including the interior (checking just four corners misses obstacles).
    function landRect(rect) {
      if (!(rect.left > b.left && rect.right < b.right && rect.top > b.top && rect.bottom < b.bottom)) return false;
      for (let r = Math.floor(rect.top / map.tileSize); r <= Math.floor(rect.bottom / map.tileSize); r++) {
        const span = map.rows[r];
        if (!span || Math.floor(rect.left / map.tileSize) < span[0] || Math.floor(rect.right / map.tileSize) > span[1]) return false;
      }
      return true;
    }
    function standRegion(p, jitter, at) {
      if (!point(p, at)) return;
      if (!shape(object(jitter) && ['x', 'y'].every(k => Array.isArray(jitter[k]) && jitter[k].length === 2 && jitter[k].every(finite) && jitter[k][0] <= jitter[k][1]), `${at}.jitter`, 'Expected ordered finite x/y ranges.')) return;
      const rect = { left: p.x + jitter.x[0], right: p.x + jitter.x[1], top: p.y + jitter.y[0], bottom: p.y + jitter.y[1] };
      if (rect.left < 0 || rect.right >= map.width || rect.top < 0 || rect.bottom >= map.height) { fail('OUTSIDE_WORLD', at, 'Spawn region leaves the world.'); return; }
      let grounded = landRect(rect);
      for (let i = 0; grounded && i < c.footSamples; i++) {
        const angle = i * Math.PI * 2 / c.footSamples, dx = Math.cos(angle) * c.footRadius, dy = Math.sin(angle) * c.footRadius;
        grounded = landRect({ left: rect.left + dx, right: rect.right + dx, top: rect.top + dy, bottom: rect.bottom + dy });
      }
      if (!grounded) fail('OUTSIDE_LAND', at, 'Spawn region/footprint leaves walkable land.');
      if (obstacles.some(o => object(o) && Math.hypot(Math.max(rect.left, Math.min(rect.right, o.x)) - o.x, Math.max(rect.top, Math.min(rect.bottom, o.y)) - o.y) < o.radius + c.obstaclePadding - c.overlapTolerance)) fail('BLOCKED_POSITION', at, 'Spawn region intersects an obstacle.');
    }
    const zero = { x: [0, 0], y: [0, 0] };
    for (const key of ['heroSpawn', 'roadEntry', 'squadGuard']) standRegion(map[key], zero, key);
    standRegion(map.allySpawn, extended ? map.allySpawnJitter : zero, 'allySpawn');
    landPoint(map.castle, 'castle'); // Combat target; never a standing footprint.
    const home = map.allyHome;
    if (point(home, 'allyHome') && shape(finite(home.width) && home.width >= 0 && finite(home.height) && home.height >= 0, 'allyHome', 'Expected nonnegative width/height.')) standRegion(home, { x: [0, home.width], y: [0, home.height] }, 'allyHome');
    if (!extended) return { valid: errors.length === 0, errors };
    for (const key of ['heroFacing', 'allyFacing']) shape(map[key] === -1 || map[key] === 1, key, 'Expected -1 or 1.');
    list(map.initialAllies).forEach((a, i) => { if (object(a)) { shape(a.spawn === 'allySpawn', `initialAllies[${i}].spawn`, 'Only the allySpawn region is supported.'); string(a.kind, `initialAllies[${i}].kind`); shape(typeof a.free === 'boolean', `initialAllies[${i}].free`, 'Expected a boolean.'); } });
    const roads = new Map(list(map.roads).filter(object).map(r => [r.id, r]));
    list(map.roads).forEach((r, i) => {
      if (!object(r)) return;
      if (shape(Array.isArray(r.points) && r.points.length >= 2, `roads[${i}].points`, 'Road needs at least two points.')) r.points.forEach((p, j) => { if (shape(Array.isArray(p) && p.length === 2, `roads[${i}].points[${j}]`, 'Expected [x,y].')) worldPoint({ x: p[0], y: p[1] }, `roads[${i}].points[${j}]`); });
    });
    const paths = new Map(list(map.paths).filter(object).map(p => [p.id, p]));
    list(map.paths).forEach((p, i) => {
      if (!object(p)) return;
      const at = `paths[${i}]`;
      if (!roads.has(p.roadId)) fail('MISSING_REFERENCE', `${at}.roadId`, 'Unknown visual road.');
      if (shape(Array.isArray(p.points) && p.points.length >= 2, `${at}.points`, 'Path needs at least two points.')) p.points.forEach((v, j) => standRegion(v, zero, `${at}.points[${j}]`));
      point(p.entryLaneOffset, `${at}.entryLaneOffset`); point(p.exitLaneOffset, `${at}.exitLaneOffset`); positive(p.exitRadius, `${at}.exitRadius`);
    });
    list(map.enemySpawns).forEach((s, i) => {
      if (!object(s)) return;
      const at = `enemySpawns[${i}]`, p = paths.get(s.pathId);
      shape(s.role === 'wave' || s.role === 'boss', `${at}.role`, 'Expected wave or boss.');
      if (!p) { fail('MISSING_PATH', `${at}.pathId`, `Unknown path: ${s.pathId}`); standRegion(s, s.jitter, at); return; }
      if (!point(s, at) || !shape(Array.isArray(s.lanes) && s.lanes.length > 0 && s.lanes.every(Number.isInteger) && new Set(s.lanes).size === s.lanes.length, `${at}.lanes`, 'Expected unique integer lanes.')) return;
      if (!object(p.entryLaneOffset) || !object(p.exitLaneOffset) || !list(p.points).length) return;
      if (s.x !== p.points[0]?.x || s.y !== p.points[0]?.y) fail('ENTRY_MISMATCH', at, 'Spawn anchor must match the first path point.');
      for (const lane of s.lanes) {
        standRegion({ x: s.x + lane * p.entryLaneOffset.x, y: s.y + lane * p.entryLaneOffset.y }, s.jitter, `${at}.lane(${lane})`);
        const exit = p.points[p.points.length - 1];
        if (object(exit)) standRegion({ x: exit.x + lane * p.exitLaneOffset.x, y: exit.y + lane * p.exitLaneOffset.y }, zero, `${at}.exit(${lane})`);
      }
    });
    list(map.decorations).forEach((d, i) => {
      if (!object(d)) return;
      const at = `decorations[${i}]`;
      if (!shape(d.domain === 'land' || d.domain === 'world', `${at}.domain`, 'Expected land or world.')) return;
      (d.domain === 'land' ? landPoint : worldPoint)(d, at);
      shape(['image', 'duck', 'cloud', 'jetty'].includes(d.kind), `${at}.kind`, 'Unknown decoration kind.');
      if (d.kind !== 'jetty') { string(d.asset, `${at}.asset`); positive(d.width, `${at}.width`); }
    });
    return { valid: errors.length === 0, errors };
  }
  function validateCampaignMap(map) {
    const errors=[],fail=(code,at,message)=>errors.push({code,at,message});
    const check=(ok,at,message)=>{if(!ok)fail('INVALID_DATA',at,message);return !!ok;};
    const point=p=>object(p)&&finite(p.x)&&finite(p.y);
    const positive=n=>finite(n)&&n>0;
    const text=s=>typeof s==='string'&&s.trim().length>0;
    const ids=new Set();
    const identity=(id,at)=>{if(!text(id))fail('INVALID_DATA',at,'Expected a nonempty identity.');else if(ids.has(id))fail('DUPLICATE_ID',at,id);else ids.add(id);};
    identity(map.id,'id');check(text(map.name),'name','Expected name.');
    for(const key of ['width','height','tileSize'])check(positive(map[key])&&Number.isInteger(map[key]),key,'Expected positive integer.');
    const c=collision(map);
    if(map.collision!==undefined)check(object(map.collision),'collision','Expected collision profile object.');
    check(positive(c.footRadius)&&Number.isInteger(c.footSamples)&&c.footSamples>0&&c.footSamples<=64&&
      finite(c.obstaclePadding)&&c.obstaclePadding>=0&&finite(c.overlapTolerance)&&c.overlapTolerance>=0&&c.overlapTolerance<=c.obstaclePadding,
      'collision','Invalid footprint or obstacle padding.');
    check(!!root.PenjagaFloor,'geometry','Load maps/floor-geometry.js first.');
    check(Array.isArray(map.regions)&&map.regions.length>0,'regions','Expected regions.');
    const regions=new Map(list(map.regions).filter(object).map(r=>[r.id,r]));
    list(map.regions).forEach((r,i)=>{
      const at='regions['+i+']';if(!check(object(r),at,'Expected region.'))return;
      identity(r.id,at+'.id');
      if(r.kind==='island'){
        const b=r.localBounds,o=r.origin;
        check(point(o)&&o.x>=0&&o.y>=0&&o.x%map.tileSize===0&&o.y%map.tileSize===0,at+'.origin','Expected tile-aligned origin.');
        check(object(b)&&['left','right','top','bottom'].every(k=>finite(b[k]))&&b.left>=0&&b.top>=0&&
          b.left<b.right&&b.top<b.bottom&&point(o)&&o.x+b.right<=map.width&&o.y+b.bottom<=map.height,at+'.localBounds','Invalid clipping bounds.');
        if(check(object(r.maskRows)&&Object.keys(r.maskRows).length>0,at+'.maskRows','Expected row mask.')){
          for(const [row,spans] of Object.entries(r.maskRows)){
            let previous=-1;
            check(/^(0|[1-9]\d*)$/.test(row)&&Array.isArray(spans)&&spans.length>0,at+'.maskRows.'+row,'Invalid row.');
            for(const span of list(spans)){
              const valid=Array.isArray(span)&&span.length===2&&span.every(Number.isInteger)&&span[0]>=0&&span[0]<=span[1]&&span[0]>previous&&
                point(o)&&o.x+(span[1]+1)*map.tileSize<=map.width&&o.y+(Number(row)+1)*map.tileSize<=map.height;
              check(valid,at+'.maskRows.'+row,'Expected ordered, disjoint inclusive spans inside world.');
              if(valid)previous=span[1];
            }
          }
        }
      }else if(r.kind==='bridge'){
        check(positive(r.width),at+'.width','Expected positive width.');
        check(Array.isArray(r.connects)&&r.connects.length===2&&new Set(r.connects).size===2&&r.connects.every(id=>regions.get(id)?.kind==='island'),
          at+'.connects','Bridge must connect two islands.');
        if(check(Array.isArray(r.centerline)&&r.centerline.length>=2,at+'.centerline','Expected centerline.')){
          r.centerline.forEach((p,j)=>{
            check(point(p),at+'.centerline['+j+']','Expected point.');
            if(j&&point(p)&&point(r.centerline[j-1])){
              const a=r.centerline[j-1];
              check((a.x===p.x)!==(a.y===p.y),at+'.centerline['+j+']','Expected nonzero orthogonal segment.');
            }
            if(point(p))check(p.x-r.width/2>=0&&p.y-r.width/2>=0&&p.x+r.width/2<map.width&&p.y+r.width/2<map.height,
              at+'.centerline['+j+']','Bridge surface must stay inside world.');
          });
        }
      }else fail('INVALID_DATA',at+'.kind','Expected island or bridge.');
    });
    for(const key of [...collections,'roads','paths','enemySpawns','obstacles','decorations','initialAllies','gates','guardPoints'])
      check(Array.isArray(map[key]),key,'Expected array.');
    check(object(map.objectIds)&&object(map.objectRegions),'objectIds','Expected source identities and owners.');
    check(object(map.previewChapters),'previewChapters','Expected three preview conditions.');
    if(errors.length)return {valid:false,errors};
    const floor=root.PenjagaFloor.createFloor(map);
    const worldPoint=(p,at)=>{
      if(!check(point(p)&&p.x>=0&&p.x<map.width&&p.y>=0&&p.y<map.height,at,'Point outside world.'))return;
      if(!floor.contains(p.x,p.y))fail('OUTSIDE_LAND',at,'Point outside floor union.');
    };
    const sources=new Map();
    for(const key of collections){
      const names=map.objectIds[key];
      if(!check(Array.isArray(names)&&names.length===map[key].length,'objectIds.'+key,'IDs must align with collection.'))continue;
      map[key].forEach((item,i)=>{
        const at=key+'['+i+']',tuple=key==='rocks'||key==='bushes';
        identity(names[i],'objectIds.'+key+'['+i+']');
        sources.set(names[i],{key,item});
        check(regions.get(map.objectRegions[names[i]])?.kind==='island','objectRegions.'+names[i],'Unknown island owner.');
        if(!check(tuple?Array.isArray(item)&&item.length===3:object(item),at,'Invalid object.'))return;
        const p=tuple?{x:item[0],y:item[1]}:item;
        worldPoint(p,at);
        const owner=regions.get(map.objectRegions[names[i]]);
        if(owner?.kind==='island'&&!root.PenjagaFloor.createFloor(map,[owner.id]).contains(p.x,p.y))fail('OUTSIDE_REGION',at,'Source is outside its owner island.');
        if(tuple||key==='trees'||key==='goldNodes')check(Number.isInteger(tuple?item[2]:item.variant)&&(tuple?item[2]:item.variant)>=1&&(tuple?item[2]:item.variant)<=4,at+'.variant','Invalid variant.');
        if(['trees','goldNodes','buildings'].includes(key))check(positive(item.radius),at+'.radius','Invalid radius.');
        if(key==='trees')check(positive(item.size)&&finite(item.seed)&&typeof item.resource==='boolean',at,'Invalid tree.');
        if(key==='buildings'){check(text(item.name)&&text(item.color)&&positive(item.width),at,'Invalid building.');worldPoint({x:item.x,y:item.cy},at+'.collider');}
        if(key==='sheep'){worldPoint({x:item.originX,y:item.originY},at+'.origin');check(finite(item.seed)&&finite(item.cooldown)&&item.cooldown>=0,at,'Invalid sheep.');}
        if(key==='villagers')check(text(item.tool)&&text(item.type)&&[-1,1].includes(item.facing),at,'Invalid villager.');
      });
    }
    for(const key of ['roads','paths','enemySpawns','obstacles','decorations','initialAllies','gates','guardPoints'])
      map[key].forEach((item,i)=>{if(check(object(item),key+'['+i+']','Expected object.'))identity(item.id,key+'['+i+'].id');});
    if(errors.length)return {valid:false,errors};
    if(!check(object(map.fortress),'fortress','Expected fortress reference.'))return {valid:false,errors};
    identity(map.fortress.id,'fortress.id');
    check(sources.get(map.fortress.buildingId)?.key==='buildings','fortress.buildingId','Unknown fortress building.');
    const colliders=new Set();
    map.obstacles.forEach((o,i)=>{
      if(!object(o))return;
      const at='obstacles['+i+']',source=sources.get(o.sourceId);
      worldPoint(o,at);check(positive(o.radius),at+'.radius','Invalid radius.');
      if(!source||!['trees','goldNodes','buildings'].includes(source.key))fail('MISSING_REFERENCE',at+'.sourceId','Unknown collidable source.');
      else{
        const s=source.item;
        if(o.x!==s.x||o.y!==(source.key==='trees'?s.y-4:source.key==='buildings'?s.cy:s.y)||o.radius!==s.radius)fail('COLLIDER_MISMATCH',at,'Collider must match its visual source.');
        if(colliders.has(o.sourceId))fail('DUPLICATE_REFERENCE',at,'Source has two colliders.');
        colliders.add(o.sourceId);
      }
    });
    for(const [id,s] of sources)if(['trees','goldNodes','buildings'].includes(s.key)&&!colliders.has(id))fail('MISSING_COLLIDER',id,'Missing source collider.');
    if(errors.length)return {valid:false,errors};
    const stand=(f,obstacles,p,jitter,at)=>{
      if(!check(point(p)&&object(jitter)&&['x','y'].every(k=>Array.isArray(jitter[k])&&jitter[k].length===2&&jitter[k].every(finite)&&jitter[k][0]<=jitter[k][1]),at,'Invalid standing region.'))return;
      const box={left:p.x+jitter.x[0],right:p.x+jitter.x[1],top:p.y+jitter.y[0],bottom:p.y+jitter.y[1]};
      let grounded=f.coversRect(box);
      for(let i=0;grounded&&i<c.footSamples;i++){
        const a=i*Math.PI*2/c.footSamples,dx=Math.cos(a)*c.footRadius,dy=Math.sin(a)*c.footRadius;
        grounded=f.coversRect({left:box.left+dx,right:box.right+dx,top:box.top+dy,bottom:box.bottom+dy});
      }
      if(!grounded)fail('OUTSIDE_LAND',at,'Standing footprint leaves active floor.');
      if(obstacles.some(o=>Math.hypot(Math.max(box.left,Math.min(box.right,o.x))-o.x,Math.max(box.top,Math.min(box.bottom,o.y))-o.y)<o.radius+c.obstaclePadding-c.overlapTolerance))
        fail('BLOCKED_POSITION',at,'Standing region overlaps collider.');
    };
    const zero={x:[0,0],y:[0,0]};
    for(const key of ['heroSpawn','roadEntry','squadGuard'])stand(floor,map.obstacles,map[key],zero,key);
    stand(floor,map.obstacles,map.allySpawn,map.allySpawnJitter,'allySpawn');
    if(check(point(map.allyHome)&&finite(map.allyHome.width)&&map.allyHome.width>=0&&finite(map.allyHome.height)&&map.allyHome.height>=0,'allyHome','Invalid home.'))
      stand(floor,map.obstacles,map.allyHome,{x:[0,map.allyHome.width],y:[0,map.allyHome.height]},'allyHome');
    worldPoint(map.castle,'castle');
    for(const key of ['heroFacing','allyFacing'])check([-1,1].includes(map[key]),key,'Invalid facing.');
    map.initialAllies.forEach((a,i)=>check(a.spawn==='allySpawn'&&['Pawn','Warrior','Archer','Lancer','Monk'].includes(a.kind)&&typeof a.free==='boolean','initialAllies['+i+']','Invalid initial ally.'));
    const paths=new Map(map.paths.map(p=>[p.id,p])),roads=new Set(map.roads.map(r=>r.id)),guards=new Map(map.guardPoints.map(g=>[g.id,g])),gates=new Map(map.gates.map(g=>[g.id,g]));
    const required=(p,at)=>check(Array.isArray(p.requiredRegionIds)&&p.requiredRegionIds.length>0&&new Set(p.requiredRegionIds).size===p.requiredRegionIds.length&&p.requiredRegionIds.every(id=>regions.has(id)),at,'Unknown/duplicate required region.');
    map.guardPoints.forEach((g,i)=>{
      check(regions.has(g.regionId)&&text(g.label),'guardPoints['+i+']','Invalid guard point.');
      stand(floor,map.obstacles,g.position,zero,'guardPoints['+i+']');
      if(g.requiredRegionIds)required(g,'guardPoints['+i+'].requiredRegionIds');
    });
    check(guards.has(map.defaultGuardPointId),'defaultGuardPointId','Unknown default guard point.');
    map.gates.forEach((g,i)=>{
      check(regions.has(g.regionId)&&guards.has(g.guardPointId),'gates['+i+']','Unknown gate region/guard.');
      stand(floor,map.obstacles,g.position,zero,'gates['+i+']');
    });
    map.roads.forEach((r,i)=>check(Array.isArray(r.points)&&r.points.length>=2&&r.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(finite)),'roads['+i+']','Invalid visual road.'));
    map.paths.forEach((p,i)=>{
      const at='paths['+i+']';required(p,at+'.requiredRegionIds');
      check(roads.has(p.roadId)&&gates.has(p.gateId),at,'Unknown road/gate.');
      check(point(p.entryLaneOffset)&&point(p.exitLaneOffset)&&positive(p.exitRadius)&&text(p.warningLabel),at,'Invalid entry/exit profile.');
      if(check(Array.isArray(p.points)&&p.points.length>=2,at+'.points','Expected path.'))p.points.forEach((v,j)=>stand(floor,map.obstacles,v,zero,at+'.points['+j+']'));
      const end=Array.isArray(p.points)?p.points.at(-1):undefined,gate=gates.get(p.gateId);
      if(point(end)&&gate&&point(gate.position))check(end.x===gate.position.x&&end.y===gate.position.y,at+'.gateId','Gate must be at path endpoint.');
    });
    const spawnKeys=new Set();
    map.enemySpawns.forEach((s,i)=>{
      const at='enemySpawns['+i+']',p=paths.get(s.pathId),key=s.role+'/'+s.pathId;
      check(['wave','boss'].includes(s.role)&&!spawnKeys.has(key),at,'Duplicate/invalid role/path entry.');spawnKeys.add(key);
      if(!p){fail('MISSING_PATH',at,'Unknown path.');return;}
      check(point(s)&&s.x===p.points?.[0]?.x&&s.y===p.points?.[0]?.y,at,'Entry must match first waypoint.');
      check(Array.isArray(s.lanes)&&s.lanes.length>0&&s.lanes.every(Number.isInteger)&&new Set(s.lanes).size===s.lanes.length,at+'.lanes','Invalid lanes.');
    });
    for(const p of map.paths)for(const role of ['wave','boss'])check(spawnKeys.has(role+'/'+p.id),'enemySpawns','Missing '+role+' entry for '+p.id);
    const expected=[
      ['island-main'],
      ['island-main','island-north','bridge-north'],
      ['island-main','island-north','island-southwest','bridge-north','bridge-southwest']
    ];
    check(Object.keys(map.previewChapters).length===3,'previewChapters','Only the three cumulative conditions are supported.');
    check(regions.size===expected[2].length&&expected[2].every(id=>regions.has(id)),'regions','Expected exactly the five campaign regions.');
    expected.forEach((set,i)=>{
      const value=map.previewChapters['chapter-'+(i+1)];
      check(Array.isArray(value)&&value.length===set.length&&new Set(value).size===set.length&&set.every(id=>value.includes(id)),'previewChapters.chapter-'+(i+1),'Expected cumulative campaign region set.');
    });
    for(const r of map.regions.filter(r=>r.kind==='bridge')){
      const endpoints=[r.centerline[0],r.centerline.at(-1)];
      check(r.connects.every(id=>endpoints.some(p=>root.PenjagaFloor.createFloor(map,[id]).canStand(p.x,p.y))),'regions.'+r.id,'Bridge ends must overlap both island footprints.');
    }
    if(errors.length)return {valid:false,errors};
    for(const [chapter,openIds] of Object.entries(map.previewChapters)){
      const f=root.PenjagaFloor.createFloor(map,openIds),open=new Set(openIds);
      const obstacles=map.obstacles.filter(o=>open.has(map.objectRegions[o.sourceId]));
      for(const key of ['heroSpawn','squadGuard'])stand(f,obstacles,map[key],zero,chapter+'.'+key);
      stand(f,obstacles,map.allySpawn,map.allySpawnJitter,chapter+'.allySpawn');
      stand(f,obstacles,map.allyHome,{x:[0,map.allyHome.width],y:[0,map.allyHome.height]},chapter+'.allyHome');
      const fits=(x,y)=>f.positionFits(x,y,obstacles);
      const clear=(a,b)=>f.segmentFits(a,b,obstacles);
      // Reachability uses the same 32px nodes and four-neighbour edges as runtime.
      const cols=Math.ceil(map.width/32),rows=Math.ceil(map.height/32);
      const nodes=Array.from({length:cols*rows},(_,i)=>({x:i%cols*32+16,y:Math.floor(i/cols)*32+16}));
      const walk=nodes.map(p=>fits(p.x,p.y)),seen=new Set(),queue=[];
      const link=p=>nodes.findIndex((n,i)=>walk[i]&&Math.hypot(n.x-p.x,n.y-p.y)<=48&&clear(p,n));
      const start=link(map.heroSpawn);
      if(start>=0){seen.add(start);queue.push(start);}
      for(let head=0;head<queue.length;head++){
        const i=queue[head];
        for(const j of [i-cols,i+cols,i%cols?i-1:-1,i%cols<cols-1?i+1:-1])
          if(j>=0&&j<nodes.length&&walk[j]&&!seen.has(j)&&clear(nodes[i],nodes[j])){seen.add(j);queue.push(j);}
      }
      const reachable=p=>{const i=link(p);return i>=0&&seen.has(i);};
      check(start>=0&&reachable(map.squadGuard)&&Math.hypot(map.squadGuard.x-map.castle.x,map.squadGuard.y-map.castle.y)<100,chapter,'Castle approach is unreachable.');
      for(const g of map.guardPoints)if(open.has(g.regionId)&&(g.requiredRegionIds||[]).every(id=>open.has(id)))check(reachable(g.position),chapter+'.'+g.id,'Guard point is unreachable.');
      for(const s of map.enemySpawns){
        const p=paths.get(s.pathId);if(!p.requiredRegionIds.every(id=>open.has(id)))continue;
        for(const lane of s.lanes){
          const points=p.points.map((v,j)=>({x:v.x+lane*(j===0?p.entryLaneOffset.x:j===p.points.length-1?p.exitLaneOffset.x:0),y:v.y+lane*(j===0?p.entryLaneOffset.y:j===p.points.length-1?p.exitLaneOffset.y:0)}));
          stand(f,obstacles,points[0],s.jitter,chapter+'.'+s.id+'.lane('+lane+')');
          stand(f,obstacles,points.at(-1),zero,chapter+'.'+s.id+'.exit('+lane+')');
          for(let j=1;j<points.length;j++)check(clear(points[j-1],points[j]),chapter+'.'+s.id+'.segment('+j+','+lane+')','Waypoint segment crosses water/collider.');
          check(reachable(points[0]),chapter+'.'+s.id,'No route to castle approach.');
        }
      }
    }
    return {valid:errors.length===0,errors};
  }
  function assertValidMap(map) {
    const report = validateMap(map);
    if (!report.valid) {
      const error = new Error(report.errors.map(e => `${e.code} ${e.at}: ${e.message}`).join('\n'));
      error.name = 'MapValidationError'; error.errors = report.errors;
      throw error;
    }
    return map;
  }
  root.PenjagaMapValidation = Object.freeze({ validateMap, assertValidMap, onLand, canStand, positionFits });
})(typeof window === 'object' ? window : globalThis);
