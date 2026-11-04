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
    if (!finite(x) || !finite(y) || !map?.tileSize) return false;
    const b = map.landBounds, row = map.rows?.[Math.floor(y / map.tileSize)];
    return !!b && !!row && x > b.left && x < b.right && y > b.top && y < b.bottom && Math.floor(x / map.tileSize) >= row[0] && Math.floor(x / map.tileSize) <= row[1];
  }
  function canStand(map, x, y) {
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
    const c = collision(map);
    return canStand(map, x, y) && (map.obstacles || baselineObstacles(map)).every(o => object(o) && Math.hypot(x - o.x, y - o.y) >= o.radius + c.obstaclePadding - c.overlapTolerance);
  }
  function validateMap(map) {
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
