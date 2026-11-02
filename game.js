/* Penjaga Pulau — plain Canvas 2D, no dependencies or network services. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = 1280, H = 704, TILE = 64;
  const images = new Map();
  const manifest = new Map(window.TINY_ASSETS.map(a => [a.path, a]));
  const keys = new Set();
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const unitPath = (color, kind, action) => {
    const names = { Warrior: `Warrior_${action}`, Archer: `Archer_${action}`, Lancer: `Lancer_${action}`, Monk: action, Pawn: `Pawn_${action}` };
    return `Units/${color} Units/${kind}/${names[kind]}.png`;
  };
  const terrain = p => `Terrain/${p}.png`;
  const blue = (kind, action) => unitPath('Blue', kind, action);
  const castle = { x: 845, y: 310, hp: 500, maxHp: 500 };
  const hero = { x: 788, y: 370, hp: 100, maxHp: 100, facing: 1, attack: 0, cooldown: 0, invuln: 0, moving: false, hitFlash: 0, stagger: 0, knockX: 0, knockY: 0 };
  const waves = [
    { name: 'Tamu tak diundang', color: 'Red', count: 7, interval: 1.7, types: ['Warrior', 'Warrior', 'Pawn'] },
    { name: 'Hujan panah', color: 'Purple', count: 10, interval: 1.65, types: ['Warrior', 'Archer', 'Lancer'] },
    { name: 'Pasukan matahari', color: 'Yellow', count: 13, interval: 1.5, types: ['Lancer', 'Warrior', 'Archer', 'Monk'] },
    { name: 'Bayangan di dermaga', color: 'Black', count: 16, interval: 1.35, types: ['Warrior', 'Lancer', 'Archer', 'Monk'] },
    { name: 'Pertahanan terakhir', color: 'Black', count: 22, interval: 1.1, types: ['Warrior', 'Lancer', 'Archer', 'Monk', 'Pawn'] },
  ];
  let state = 'loading', phase = 'prepare', waveIndex = 0, waveTimer = 22, spawned = 0, spawnTimer = 0;
  let gold = 80, wood = 40, food = 3, score = 0, kills = 0, recruitIndex = 0;
  let elapsed = 0, animTime = 0, gatherCooldown = 0, passiveTimer = 0, uiTimer = 0, announcementTimer = 0, toastTimer = 0, shake = 0;
  let enemies = [], allies = [], effects = [], floaters = [], drops = [], projectiles = [], impacts = [];
  let hitStop = 0;
  let damageDealt = 0, damageTaken = 0;
  let best = 0, terrainCanvas, lastTime = 0, pausedForDialog = false, initialized = false;
  let scale = 1, cameraX = 0, cameraY = 0, viewW = W, viewH = H, pointerAttack = false;
  let soundOn = false, audio, melodyTimer = 0;
  try { best = Number(localStorage.getItem('penjaga-pulau-best')) || 0; } catch { /* private/file contexts may deny storage */ }
  $('bestScore').textContent = String(best).padStart(4, '0');

  // A hand-placed island: its shore and collision use the same tile mask.
  const rows = { 1: [6, 14], 2: [3, 17], 3: [2, 18], 4: [2, 18], 5: [1, 18], 6: [1, 18], 7: [2, 18], 8: [2, 17], 9: [4, 16] };
  const land = (c, r) => !!rows[r] && c >= rows[r][0] && c <= rows[r][1];
  const onLand = (x, y) => land(Math.floor(x / TILE), Math.floor(y / TILE)) && x > 80 && x < 1195 && y > 80 && y < 630;
  function canStand(x, y) {
    // Stay inside the visible grass edge, including diagonal shore corners.
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      if (!onLand(x + Math.cos(angle) * 23, y + Math.sin(angle) * 23)) return false;
    }
    return onLand(x, y);
  }
  function translateEntity(entity, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
    for (let i = 0; i < steps; i++) {
      if (canStand(entity.x + dx / steps, entity.y)) entity.x += dx / steps;
      if (canStand(entity.x, entity.y + dy / steps)) entity.y += dy / steps;
    }
  }
  function keepOnLand(entity) {
    if (canStand(entity.x, entity.y)) return;
    for (let radius = 4; radius <= 320; radius += 4) for (let i = 0; i < 24; i++) {
      const x = entity.x + Math.cos(i * Math.PI / 12) * radius, y = entity.y + Math.sin(i * Math.PI / 12) * radius;
      if (canStand(x, y)) { entity.x = x; entity.y = y; return; }
    }
    entity.x = 788; entity.y = 370;
  }
  const trees = [
    [200, 330, 1], [153, 488, 2], [222, 505, 3], [292, 554, 4], [349, 589, 1],
    [420, 185, 3], [484, 173, 4], [551, 184, 1], [621, 181, 2],
    [1155, 329, 1], [1157, 414, 2], [1133, 543, 4], [1067, 590, 1], [1001, 613, 2],
    [421, 604, 3], [487, 613, 4], [554, 613, 1], [629, 608, 2],
    [278, 322, 3], [346, 317, 2], [291, 472, 4],
  ].map(([x, y, variant], i) => ({ x, y, variant, seed: i * .71, radius: variant < 3 ? 14 : 12, size: variant < 3 ? 166 : 150, resource: i < 5 || i >= 18 }));
  const roadEntry = { x: 110, y: 405 };
  const goldNodes = [[571, 534, 1], [610, 563, 3], [646, 531, 4]].map(([x, y, variant]) => ({ x, y, variant, radius: 13 }));
  const sheep = [[1014, 298], [1063, 316], [1010, 342]].map(([x, y], i) => ({ x, y, originX: x, originY: y, seed: i * 2, cooldown: 0 }));
  const buildings = [
    { x: 845, y: 307, color: 'Blue', name: 'Castle', width: 208, radius: 54, cy: 250 },
    { x: 733, y: 225, color: 'Blue', name: 'Tower', width: 70, radius: 18, cy: 207 },
    { x: 1005, y: 225, color: 'Blue', name: 'Archery', width: 115, radius: 32, cy: 205 },
    { x: 1070, y: 423, color: 'Blue', name: 'House1', width: 68, radius: 22, cy: 399 },
    { x: 983, y: 502, color: 'Blue', name: 'Barracks', width: 122, radius: 38, cy: 479 },
    { x: 1090, y: 505, color: 'Blue', name: 'Monastery', width: 99, radius: 29, cy: 481 },
    { x: 910, y: 571, color: 'Blue', name: 'House2', width: 76, radius: 25, cy: 552 },
    { x: 755, y: 570, color: 'Blue', name: 'House3', width: 80, radius: 25, cy: 550 },
    { x: 245, y: 270, color: 'Red', name: 'House2', width: 77, radius: 25, cy: 249 },
    { x: 350, y: 226, color: 'Purple', name: 'Tower', width: 61, radius: 17, cy: 208 },
    { x: 697, y: 157, color: 'Yellow', name: 'House3', width: 70, radius: 20, cy: 139 },
    { x: 223, y: 545, color: 'Black', name: 'House1', width: 65, radius: 21, cy: 522 },
  ];
  const rocks = [[140, 473, 1], [384, 202, 3], [469, 576, 2], [687, 591, 4], [1098, 266, 2], [1150, 454, 3]];
  const bushes = [[299, 216, 1], [372, 323, 2], [464, 191, 3], [670, 183, 4], [1044, 243, 1], [1120, 405, 2], [836, 575, 3], [550, 582, 4], [176, 423, 1]];
  const villagers = [{ x: 704, y: 414, tool: 'Axe', type: 'wood', facing: -1 }, { x: 619, y: 493, tool: 'Pickaxe', type: 'gold', facing: -1 }];
  const obstacleList = [...trees.map(t => ({ x: t.x, y: t.y - 4, radius: t.radius })), ...goldNodes, ...buildings.map(b => ({ x: b.x, y: b.cy, radius: b.radius }))];

  function loadImage(path) {
    if (images.has(path)) return images.get(path).promise;
    const image = new Image();
    const record = { image, loaded: false };
    record.promise = new Promise((resolve, reject) => {
      image.onload = () => { record.loaded = true; resolve(image); };
      image.onerror = () => { images.delete(path); reject(new Error(path)); };
    });
    images.set(path, record);
    image.src = path;
    return record.promise;
  }
  function img(path) { const r = images.get(path); return r?.loaded ? r.image : null; }
  async function preload() {
    const paths = new Set();
    for (const color of ['Blue', 'Red', 'Purple', 'Yellow', 'Black']) {
      for (const kind of ['Warrior', 'Archer', 'Lancer', 'Monk', 'Pawn']) {
        for (const action of ['Idle', 'Run']) paths.add(unitPath(color, kind, action));
        if (kind === 'Warrior') paths.add(unitPath(color, kind, 'Attack1'));
        if (kind === 'Archer') { paths.add(unitPath(color, kind, 'Shoot')); paths.add(`Units/${color} Units/Archer/Arrow.png`); }
        if (kind === 'Lancer') paths.add(unitPath(color, kind, 'Right_Attack'));
        if (kind === 'Monk') paths.add(unitPath(color, kind, 'Heal'));
      }
    }
    for (const tool of ['Axe', 'Pickaxe']) paths.add(blue('Pawn', `Interact ${tool}`));
    paths.add(blue('Pawn', 'Idle Meat'));
    paths.add(blue('Monk', 'Heal_Effect'));
    for (const b of buildings) paths.add(`Buildings/${b.color} Buildings/${b.name}.png`);
    for (let i = 1; i <= 4; i++) {
      paths.add(terrain(`Resources/Wood/Trees/Tree${i}`));
      paths.add(terrain(`Resources/Wood/Trees/Stump ${i}`));
      paths.add(terrain(`Decorations/Bushes/Bushe${i}`));
      paths.add(terrain(`Decorations/Rocks/Rock${i}`));
      paths.add(terrain(`Decorations/Rocks in the Water/Water Rocks_0${i}`));
    }
    for (const n of goldNodes) paths.add(terrain(`Resources/Gold/Gold Stones/Gold Stone ${n.variant}`));
    for (const p of ['Tileset/Tilemap_color1', 'Tileset/Water Background color', 'Tileset/Water Foam', 'Tileset/Shadow', 'Decorations/Rubber Duck/Rubber duck', 'Decorations/Clouds/Clouds_01', 'Decorations/Clouds/Clouds_03', 'Resources/Meat/Sheep/Sheep_Idle', 'Resources/Meat/Sheep/Sheep_Move', 'Resources/Meat/Sheep/Sheep_Grass', 'Resources/Gold/Gold Resource/Gold_Resource', 'Resources/Meat/Meat Resource/Meat Resource', 'Resources/Wood/Wood Resource/Wood Resource']) paths.add(terrain(p));
    for (const p of ['Dust_01', 'Dust_02', 'Explosion_01', 'Explosion_02', 'Fire_01', 'Fire_02', 'Fire_03', 'Water Splash']) paths.add(`Particle FX/${p}.png`);
    let loaded = 0;
    const failures = [];
    await Promise.all([...paths].map(async p => { try { await loadImage(p); } catch { failures.push(p); } loaded++; $('loadingProgress').style.width = `${loaded / paths.size * 100}%`; }));
    if (failures.length) {
      $('loadError').hidden = false;
      $('loadError').textContent = `${failures.length} aset gagal dimuat. Pastikan folder aset tetap lengkap, lalu muat ulang.`;
      $('startLabel').textContent = 'Muat ulang untuk mencoba';
      $('startButton').disabled = false;
      $('startButton').onclick = () => location.reload();
      console.error('Assets missing:', failures);
      return;
    }
    terrainCanvas = makeTerrain();
    initialized = true;
    state = 'ready';
    $('startButton').disabled = false;
    $('startLabel').textContent = 'Mulai petualangan';
    $('loadingTrack').hidden = true;
    resize();
  }

  // Draw once, retaining the hand-crafted grass tile texture at pixel scale.
  function makeTerrain() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const tilemap = img(terrain('Tileset/Tilemap_color1'));
    g.fillStyle = '#4c9cab'; g.fillRect(0, 0, W, H);
    const water = img(terrain('Tileset/Water Background color'));
    if (water) { g.fillStyle = g.createPattern(water, 'repeat'); g.fillRect(0, 0, W, H); }
    // Seeded details stay fixed rather than flickering between frames.
    let seed = 8453;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    g.fillStyle = '#b2e6df33';
    for (let i = 0; i < 185; i++) { const x = random() * W, y = random() * H; g.fillRect(x, y, 5 + random() * 20, 2); }
    for (const [rstr, [left, right]] of Object.entries(rows)) {
      const r = Number(rstr);
      for (let col = left; col <= right; col++) {
        const x = col * TILE, y = r * TILE;
        g.fillStyle = '#296b7666'; g.fillRect(x - 4, y + 20, 72, 64);
        if (!land(col, r + 1)) g.drawImage(tilemap, 384, 256, 64, 64, x, y + 37, 64, 43);
      }
    }
    for (const [rstr, [left, right]] of Object.entries(rows)) {
      const r = Number(rstr);
      for (let col = left; col <= right; col++) {
        const sx = col === left ? 0 : col === right ? 128 : 64;
        const sy = !land(col, r - 1) ? 0 : !land(col, r + 1) ? 128 : 64;
        g.drawImage(tilemap, sx, sy, 64, 64, col * TILE, r * TILE, TILE, TILE);
      }
    }
    // Well-trodden roads connect the outposts with the blue settlement.
    const roads = [ [[94, 405], [223, 401], [350, 393], [510, 410], [687, 390], [845, 333]], [[687, 390], [821, 448], [978, 464], [1084, 453]], [[845, 333], [977, 286], [1005, 230]], [[845, 333], [744, 288], [733, 236]] ];
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const points of roads) {
      g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
      g.strokeStyle = '#7eaa5d'; g.lineWidth = 43; g.stroke();
      g.strokeStyle = '#b9bd79'; g.lineWidth = 33; g.stroke();
      g.strokeStyle = '#c4c78b'; g.lineWidth = 24; g.stroke();
    }
    // A visible landing jetty feeds a single road into the island.
    g.fillStyle = '#275f5d66'; g.fillRect(23, 392, 106, 45);
    g.fillStyle = '#684f3b'; g.fillRect(25, 386, 102, 4); g.fillRect(25, 420, 102, 5);
    for (let x = 28; x < 126; x += 11) {
      g.fillStyle = x % 2 ? '#c5a16b' : '#b8915c'; g.fillRect(x, 386, 9, 39);
      g.fillStyle = '#ead39a55'; g.fillRect(x + 1, 389, 2, 30);
      g.fillStyle = '#72533b'; g.fillRect(x + 3, 389, 2, 2); g.fillRect(x + 3, 417, 2, 2);
    }
    g.fillStyle = '#775b3e'; g.fillRect(119, 362, 5, 33); g.fillRect(119, 420, 5, 30);
    for (let i = 0; i < 170; i++) {
      const x = random() * W, y = random() * H;
      if (!onLand(x, y)) continue;
      g.fillStyle = ['#d9d78b', '#e5e2a0', '#679d53', '#9fbc63'][i % 4];
      g.fillRect(x, y, 2, 2); if (i % 3 === 0) g.fillRect(x + 3, y + 2, 2, 2);
    }
    return c;
  }

  function resize() {
    const rect = $('arena').getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    scale = canvas.height / H; viewH = H; viewW = canvas.width / scale;
    ctx.imageSmoothingEnabled = false;
  }
  new ResizeObserver(resize).observe($('arena'));

  function spriteFrame(path, time = 0, fps = 9, once = false) {
    const meta = manifest.get(path);
    // All four trees have eight 192px-wide frames; pine frames are 256px tall.
    const isTree = /\/Trees\/Tree[1-4]\.png$/.test(path);
    const width = isTree ? 192 : meta.height, height = meta.height;
    const count = Math.max(1, Math.floor(meta.width / width));
    const tick = Math.max(0, Math.floor(time * fps));
    const index = once ? Math.min(count - 1, tick) : tick % count;
    return { x: index * width, width, height, count, anchorY: isTree ? (height === 256 ? .95 : .87) : .79 };
  }
  function drawSprite(path, x, y, size, time = animTime, fps = 9, facing = 1, alpha = 1, once = false, flash = false) {
    const im = img(path); if (!im) return;
    const frame = spriteFrame(path, time, fps, once), width = size * frame.width / frame.height;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(facing, 1); ctx.globalAlpha = alpha;
    if (flash) ctx.filter = 'brightness(0) invert(1)';
    ctx.drawImage(im, frame.x, 0, frame.width, frame.height, -width / 2, -size * frame.anchorY, width, size);
    ctx.restore();
  }
  function drawImageAt(path, x, y, width, alpha = 1) {
    const im = img(path); if (!im) return;
    const height = im.height / im.width * width;
    ctx.globalAlpha = alpha; ctx.drawImage(im, Math.round(x - width / 2), Math.round(y - height), width, height); ctx.globalAlpha = 1;
  }
  function healthBar(x, y, hp, max, color, width = 35) {
    ctx.fillStyle = '#173327cc'; ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, 5);
    ctx.fillStyle = color; ctx.fillRect(x - width / 2, y, width * clamp(hp / max, 0, 1), 3);
  }
  function drawUnit(u, isHero = false) {
    if (isHero && hero.work) {
      const work = hero.work, progress = clamp(work.elapsed / work.duration, 0, 1);
      const action = work.node.type === 'wood' ? 'Interact Axe' : work.node.type === 'gold' ? 'Interact Pickaxe' : 'Idle Meat';
      drawSprite(blue('Pawn', action), u.x, u.y, 136, work.elapsed, spriteFrame(blue('Pawn', action)).count / work.duration, u.facing, 1, true);
      healthBar(u.x, u.y - 63, progress, 1, '#eed18b', 49);
      ctx.fillStyle = '#fff1c5'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'center';
      ctx.fillText(work.node.type === 'wood' ? 'MENEBANG' : work.node.type === 'gold' ? 'MENAMBANG' : 'MENGAMBIL BEKAL', u.x, u.y - 72);
      ctx.strokeStyle = '#f4d88baa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(work.node.x, work.node.y, 24, 10, 0, 0, Math.PI * 2); ctx.stroke();
      return;
    }
    const kind = isHero ? 'Warrior' : u.kind, color = isHero ? 'Blue' : u.color;
    const action = u.attack > 0 ? ({ Warrior: 'Attack1', Archer: 'Shoot', Lancer: 'Right_Attack', Monk: 'Heal', Pawn: 'Idle' }[kind]) : u.moving ? 'Run' : 'Idle';
    const size = kind === 'Lancer' ? (isHero ? 194 : 178) : isHero ? 136 : 113;
    const alpha = u.invuln > 0 && !u.hitFlash && Math.floor(animTime * 13) % 2 ? .75 : 1;
    if (isHero) {
      ctx.strokeStyle = '#f5df9a99'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(u.x, u.y - 4, 21, 9, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const path = unitPath(color, kind, action), age = u.attack > 0 ? (u.attackDuration || .4) - u.attack : animTime + (u.seed || 0);
    drawSprite(path, u.x, u.y, size, age, u.attack > 0 ? 11 : 9, u.facing, alpha, u.attack > 0);
    if (u.hitFlash > 0) drawSprite(path, u.x, u.y, size, age, u.attack > 0 ? 11 : 9, u.facing, Math.min(.92, u.hitFlash / .15), u.attack > 0, true);
    if (u.attack > 0 && age > .07 && age < .29 && !['Archer', 'Monk'].includes(kind)) {
      ctx.save(); ctx.translate(u.x, u.y - 23); ctx.scale(u.facing, 1);
      ctx.strokeStyle = isHero ? '#fff1c7cc' : u.team === 'enemy' ? '#ffc49ba8' : '#d4f5ddb0';
      ctx.lineWidth = isHero ? 4 : 3; ctx.lineCap = 'round';
      const progress = (age - .07) / .22;
      ctx.beginPath(); ctx.arc(0, 0, isHero ? 66 : 43, -.95 + progress * .8, -.25 + progress * 1.45); ctx.stroke(); ctx.restore();
    }
    if ((!isHero && u.hp < u.maxHp) || (isHero && u.hitFlash > 0)) healthBar(u.x, u.y - 55, u.hp, u.maxHp, u.team === 'enemy' ? '#ef9a7a' : '#a9dda9', isHero ? 43 : 35);
    if (isHero) { ctx.fillStyle = '#e9dda7'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('KAMU', u.x, u.y - 70); }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!initialized) { ctx.fillStyle = '#4c9cab'; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }
    cameraX = viewW >= W ? (W - viewW) / 2 : clamp((state === 'ready' ? 790 : hero.x) - viewW / 2, 0, W - viewW);
    cameraY = 0;
    ctx.setTransform(scale, 0, 0, scale, -cameraX * scale, -cameraY * scale);
    ctx.fillStyle = ctx.createPattern(img(terrain('Tileset/Water Background color')), 'repeat');
    ctx.fillRect(cameraX, 0, viewW, viewH);
    if (shake > 0 && !reducedMotion) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    ctx.drawImage(terrainCanvas, 0, 0);
    // Animated white water follows each exposed shoreline tile.
    ctx.globalAlpha = .32 + Math.sin(animTime * 1.7) * .1;
    const foam = img(terrain('Tileset/Water Foam'));
    if (foam) for (const [rstr, [left, right]] of Object.entries(rows)) {
      const r = Number(rstr);
      for (let c = left; c <= right; c++) if (!land(c, r + 1)) {
        const frame = Math.floor(animTime * 7) % 16;
        ctx.drawImage(foam, frame * 192 + 64, 128, 64, 64, c * 64, (r + 1) * 64 - 1, 64, 28);
      }
    }
    ctx.globalAlpha = 1;
    [[98, 284, 1], [1216, 510, 2], [360, 659, 3], [1160, 156, 4]].forEach(([x, y, i]) => drawImageAt(terrain(`Decorations/Rocks in the Water/Water Rocks_0${i}`), x, y, 65));
    const duck = img(terrain('Decorations/Rubber Duck/Rubber duck'));
    if (duck) { const i = Math.floor(animTime * 4) % 3; ctx.drawImage(duck, i * 32, 0, 32, 32, 1036 + Math.sin(animTime * .24) * 22, 53 + Math.sin(animTime * 1.8) * 2, 30, 30); }
    // Stumps and little rocks keep the forest floor varied.
    drawImageAt(terrain('Resources/Wood/Trees/Stump 1'), 373, 496, 48);
    drawImageAt(terrain('Resources/Wood/Trees/Stump 3'), 522, 211, 45);
    for (const [x, y, i] of rocks) drawImageAt(terrain(`Decorations/Rocks/Rock${i}`), x, y, 39);
    for (const d of drops) drawSprite(terrain(`Resources/${d.type === 'wood' ? 'Wood/Wood Resource/Wood Resource' : 'Gold/Gold Resource/Gold_Resource'}`), d.x, d.y + Math.sin(animTime * 4 + d.x) * 3, d.type === 'wood' ? 44 : 58);
    const renderables = [];
    for (const t of trees) renderables.push({ y: t.y, draw: () => {
      const behind = state !== 'ready' && hero.y < t.y - 4 && hero.y > t.y - t.size + 15 && Math.abs(hero.x - t.x) < 42;
      drawSprite(terrain(`Resources/Wood/Trees/Tree${t.variant}`), t.x, t.y, t.size, animTime + t.seed, 5, 1, behind ? .44 : 1);
    } });
    for (const n of goldNodes) renderables.push({ y: n.y, draw: () => drawImageAt(terrain(`Resources/Gold/Gold Stones/Gold Stone ${n.variant}`), n.x, n.y, 64) });
    for (const [x, y, i] of bushes) renderables.push({ y, draw: () => drawSprite(terrain(`Decorations/Bushes/Bushe${i}`), x, y, 75, animTime + i, 5) });
    for (const b of buildings) renderables.push({ y: b.y - 9, draw: () => {
      drawImageAt(`Buildings/${b.color} Buildings/${b.name}.png`, b.x, b.y, b.width);
      if (b.name === 'Castle') {
        if (castle.hitFlash > 0) { ctx.save(); ctx.filter = 'brightness(0) invert(1)'; drawImageAt(`Buildings/${b.color} Buildings/${b.name}.png`, b.x, b.y, b.width, .6); ctx.restore(); }
        if (castle.hp < 500) healthBar(b.x, b.y - 160, castle.hp, 500, '#a7d7bd', 85);
        if (castle.hp < 230) drawSprite('Particle FX/Fire_01.png', b.x - 48, b.y - 55, 65);
        if (castle.hp < 100) drawSprite('Particle FX/Fire_02.png', b.x + 49, b.y - 63, 77);
      }
    } });
    for (const s of sheep) renderables.push({ y: s.y, draw: () => drawSprite(terrain(`Resources/Meat/Sheep/${state === 'playing' && Math.sin(elapsed + s.seed) > .4 ? 'Sheep_Grass' : 'Sheep_Idle'}`), s.x, s.y, 77, animTime + s.seed, 6, Math.sin(animTime * .13 + s.seed) > 0 ? 1 : -1) });
    for (const v of villagers) renderables.push({ y: v.y, draw: () => drawSprite(blue('Pawn', `Interact ${v.tool}`), v.x, v.y, 104, animTime, 8, v.facing) });
    for (const u of [...enemies, ...allies]) if (u.hp > 0) renderables.push({ y: u.y, draw: () => drawUnit(u) });
    renderables.push({ y: hero.y, draw: () => drawUnit(hero, true) });
    renderables.sort((a, b) => a.y - b.y).forEach(r => r.draw());
    for (const p of projectiles) {
      const arrow = img(`Units/${p.color} Units/Archer/Arrow.png`);
      if (arrow) { ctx.save(); ctx.translate(p.x, p.y - 22); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.drawImage(arrow, -21, -21, 42, 42); ctx.restore(); }
    }
    for (const e of effects) drawSprite(e.path, e.x, e.y, e.size, e.time, e.fps, 1, Math.min(1, e.life * 3));
    for (const hit of impacts) {
      const progress = 1 - hit.life / hit.duration;
      ctx.save(); ctx.translate(hit.x, hit.y); ctx.globalAlpha = Math.min(1, hit.life * 7);
      ctx.strokeStyle = hit.color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 5 + progress * 17, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const angle = hit.angle + i * Math.PI * 2 / 7, radius = 6 + progress * 29;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .75;
        ctx.strokeStyle = i % 2 ? '#fff8d8' : hit.color; ctx.lineWidth = i % 2 ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(x * .55, y * .55); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.restore();
    }
    for (const f of floaters) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.font = `bold ${f.large ? 16 : 12}px Segoe UI`; ctx.textAlign = 'center'; ctx.strokeStyle = '#183d2c'; ctx.lineWidth = 3; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
    if (state === 'playing' && phase === 'battle') {
      ctx.fillStyle = '#233d31dc'; ctx.fillRect(76, 446, 100, 23);
      ctx.fillStyle = '#f2cc93'; ctx.font = 'bold 8px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('JALUR PENYERANG →', 126, 461);
    }
    // Translucent clouds drift across the sea and treetops.
    const cloud = img(terrain('Decorations/Clouds/Clouds_01'));
    if (cloud && !reducedMotion) {
      ctx.globalAlpha = .13;
      ctx.drawImage(cloud, (animTime * 7 % 1700) - 320, 52, 365, 162);
      ctx.drawImage(cloud, 1020 - (animTime * 4 % 1700), 516, 280, 124);
      ctx.globalAlpha = 1;
    }
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function addEffect(path, x, y, size = 90, life = .55, fps = 14) { effects.push({ path, x, y, size, life, time: 0, fps }); }
  function float(text, x, y, color = '#f4d790', large = false) { floaters.push({ text, x, y: y - 30, life: 1.05, color, large }); }
  function notify(text) { $('toast').textContent = text; $('toast').classList.add('show'); toastTimer = 3; }
  function announce(title, subtitle) {
    $('announcement').replaceChildren(document.createTextNode(title));
    const small = document.createElement('small'); small.textContent = subtitle; $('announcement').append(small);
    $('announcement').classList.add('show'); announcementTimer = 2.5;
  }
  function initAudio() { if (!audio) { const A = window.AudioContext || window.webkitAudioContext; if (A) audio = new A(); } if (audio?.state === 'suspended') audio.resume().catch(() => {}); }
  function tone(freq, duration = .1, type = 'sine', volume = .035, endFreq = freq) {
    if (!soundOn || !audio) return;
    const o = audio.createOscillator(), g = audio.createGain(); o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), audio.currentTime + duration);
    g.gain.setValueAtTime(volume, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
    o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + duration);
  }
  function move(entity, dx, dy, dt, speed) {
    const len = Math.hypot(dx, dy); entity.moving = len > .05;
    if (!entity.moving) return;
    translateEntity(entity, dx / len * speed * dt, dy / len * speed * dt);
    if (Math.abs(dx) > .1) entity.facing = dx > 0 ? 1 : -1;
    for (const o of obstacleList) {
      const vx = entity.x - o.x, vy = entity.y - o.y, d = Math.hypot(vx, vy), min = o.radius + 10;
      if (d < min && d > .01) {
        const px = o.x + vx / d * min, py = o.y + vy / d * min;
        if (canStand(px, py)) { entity.x = px; entity.y = py; }
      }
    }
  }
  function steerMove(entity, target, dt, speed = entity.speed) {
    let dx = target.x - entity.x, dy = target.y - entity.y;
    const distance = Math.hypot(dx, dy); if (distance < 3) { entity.moving = false; return; }
    dx /= distance; dy /= distance;
    for (const o of obstacleList) {
      const ox = entity.x - o.x, oy = entity.y - o.y, d = Math.hypot(ox, oy);
      if (d < o.radius + 45 && d > .1) {
        const force = (o.radius + 45 - d) / 45, side = entity.flankSign || 1;
        dx += (ox / d * 2.3 - oy / d * side * .9) * force;
        dy += (oy / d * 2.3 + ox / d * side * .9) * force;
      }
    }
    move(entity, dx, dy, dt, speed);
  }
  function updateReaction(entity, dt) {
    entity.hitFlash = Math.max(0, (entity.hitFlash || 0) - dt);
    entity.stagger = Math.max(0, (entity.stagger || 0) - dt);
    if (Math.hypot(entity.knockX || 0, entity.knockY || 0) > 5) {
      const speed = Math.hypot(entity.knockX, entity.knockY);
      move(entity, entity.knockX, entity.knockY, dt, speed);
      const decay = Math.exp(-19 * dt); entity.knockX *= decay; entity.knockY *= decay;
    }
  }

  function startGame() {
    if (!initialized) return;
    Object.assign(hero, { x: 788, y: 370, hp: 100, facing: 1, attack: 0, cooldown: 0, invuln: 0, moving: false, hitFlash: 0, stagger: 0, knockX: 0, knockY: 0, strike: null });
    hero.work = null;
    castle.hp = 500; castle.hitFlash = 0; gold = 80; wood = 40; food = 3; score = 0; kills = 0; recruitIndex = 0;
    enemies = []; allies = []; effects = []; floaters = []; drops = []; projectiles = []; impacts = []; hitStop = 0; damageDealt = 0; damageTaken = 0;
    for (const s of sheep) s.cooldown = 0;
    phase = 'prepare'; waveIndex = 0; waveTimer = 22; spawned = 0; spawnTimer = 0; elapsed = 0; passiveTimer = 0; gatherCooldown = 0; shake = 0;
    keys.clear(); pointerAttack = false; state = 'playing';
    $('startScreen').hidden = true; $('pauseScreen').hidden = true; $('endScreen').hidden = true;
    $('wavePanel').hidden = false; $('scorePanel').hidden = false; $('worldCaption').hidden = true;
    $('battleStatus').hidden = false; document.body.classList.add('is-playing'); $('gameShell').classList.remove('player-hit');
    $('mobileControls').hidden = !matchMedia('(pointer:coarse)').matches;
    $('pauseButton').textContent = 'Ⅱ'; $('pauseButton').setAttribute('aria-label', 'Jeda permainan');
    recruitUnit(true); updateUI(); resize(); canvas.focus({ preventScroll: true });
    announce('Selamat datang, Penjaga.', 'KUMPULKAN BEKAL · SIAPKAN PASUKAN');
    tone(392, .2); tone(523, .3, 'sine', .025);
  }
  function startWave() {
    phase = 'battle'; spawned = 0; spawnTimer = .3;
    const w = waves[waveIndex];
    announce(`Gelombang ${waveIndex + 1}`, w.name.toUpperCase());
    tone(220, .25, 'triangle', .04, 330);
  }
  function finishWave() {
    const reward = 30 + waveIndex * 10;
    gold += reward; wood += 15; food += 1; score += 150 + waveIndex * 50;
    hero.hp = Math.min(100, hero.hp + 25);
    if (waveIndex === waves.length - 1) { finish(true); return; }
    waveIndex++; phase = 'prepare'; waveTimer = 15;
    announce('Gelombang ditaklukkan!', `+${reward} EMAS · +15 KAYU · +1 BEKAL`);
    tone(523, .2); setTimeout(() => tone(659, .3), 160);
  }
  function finish(won) {
    state = won ? 'won' : 'lost'; keys.clear(); pointerAttack = false;
    $('announcement').classList.remove('show'); $('interactionHint').hidden = true; $('mobileControls').hidden = true;
    if (won) score += Math.round(castle.hp * 2 + hero.hp * 3);
    if (score > best) { best = score; try { localStorage.setItem('penjaga-pulau-best', String(best)); } catch {} }
    $('bestScore').textContent = String(best).padStart(4, '0');
    $('resultEyebrow').textContent = won ? 'KERAJAAN TETAP BERDIRI' : 'SETIAP PENJAGA PERNAH TERJATUH';
    $('resultIcon').textContent = won ? '♜' : '⚔';
    $('resultTitle').textContent = won ? 'Pulau terselamatkan!' : 'Kita coba sekali lagi.';
    $('resultDescription').textContent = won ? 'Lima gelombang berlalu. Rumah ini masih milik kita.' : castle.hp <= 0 ? 'Kastel telah runtuh. Rekrut pasukan dan sisakan kayu untuk perbaikan.' : 'Sang penjaga kehabisan tenaga. Gunakan bekal dan tetap dekat sekutu.';
    $('finalScore').textContent = score; $('finalKills').textContent = kills; $('finalWave').textContent = `${waveIndex + 1} / 5`;
    $('endScreen').hidden = false; $('restartButton').focus({ preventScroll: true }); updateUI();
    tone(won ? 659 : 196, .7, 'triangle', .04, won ? 880 : 98);
  }
  function spawnEnemy() {
    const w = waves[waveIndex], kind = w.types[spawned % w.types.length];
    const lane = [-1, 0, 1, -2, 2][spawned % 5];
    const entry = { x: roadEntry.x + rand(-3, 3), y: roadEntry.y + lane * 7 };
    const hp = ({ Warrior: 62, Archer: 43, Lancer: 82, Monk: 48, Pawn: 38 }[kind]) + waveIndex * 9;
    enemies.push({ x: entry.x, y: entry.y, kind, color: waveIndex === 4 ? ['Red', 'Purple', 'Yellow', 'Black'][spawned % 4] : w.color, hp, maxHp: hp, facing: 1, moving: false, attack: 0, cooldown: rand(.1, .6), seed: rand(0, 10), speed: kind === 'Lancer' ? 59 : kind === 'Pawn' ? 75 : 66, team: 'enemy', entering: true, lane, flankAngle: spawned * 2.399963 + waveIndex * .8, flankSign: spawned % 2 ? -1 : 1, hitFlash: 0, stagger: 0, knockX: 0, knockY: 0, strike: null });
    addEffect('Particle FX/Dust_02.png', entry.x, entry.y, 48); spawned++;
    const enemy = enemies[enemies.length - 1]; enemy.speed += waveIndex * 5; enemy.chargeCooldown = 2; enemy.charge = 0;
  }
  function recruitUnit(free = false) {
    if (state !== 'playing') return;
    const kind = ['Archer', 'Lancer', 'Monk', 'Warrior'][recruitIndex % 4];
    const cost = kind === 'Monk' ? 55 : 40;
    if (!free && allies.length >= 8) { notify('Pasukan lengkap: maksimal 8 sekutu.'); return; }
    if (!free && gold < cost) { notify(`Butuh ${cost} emas. Kumpulkan di tambang atau kalahkan musuh.`); return; }
    if (!free) gold -= cost;
    const hp = kind === 'Lancer' ? 130 : kind === 'Monk' ? 90 : 100;
    allies.push({ x: 885 + rand(-15, 15), y: 355 + rand(-10, 10), homeX: 720 + rand(0, 120), homeY: 325 + rand(0, 100), kind, color: 'Blue', hp, maxHp: hp, facing: -1, moving: false, attack: 0, cooldown: .2, seed: rand(0, 10), speed: 88, team: 'ally', flankSign: recruitIndex % 2 ? 1 : -1, hitFlash: 0, stagger: 0, knockX: 0, knockY: 0, strike: null });
    recruitIndex++; if (!free) { notify(`${{ Archer: 'Pemanah', Lancer: 'Penombak', Monk: 'Biarawan', Warrior: 'Ksatria' }[kind]} bergabung! (${allies.length}/8 sekutu)`); tone(440, .15, 'triangle'); }
    addEffect('Particle FX/Dust_01.png', 885, 355, 65); updateUI();
  }
  function repairCastle() {
    if (state !== 'playing') return;
    if (castle.hp >= 500) { notify('Kastel masih dalam kondisi sempurna.'); return; }
    if (wood < 30) { notify('Butuh 30 kayu. Dekati pohon lalu tahan E.'); return; }
    wood -= 30; castle.hp = Math.min(500, castle.hp + 140); score += 15;
    addEffect(blue('Monk', 'Heal_Effect'), castle.x, castle.y, 220, .8); float('+140', castle.x, castle.y - 70, '#d0efa8', true);
    notify('Kastel diperbaiki. Pertahankan rumahmu!'); tone(330, .2, 'triangle', .03, 550); updateUI();
  }
  function healHero() {
    if (state !== 'playing') return;
    if (hero.hp >= 100) { notify('Tenagamu masih penuh.'); return; }
    if (food < 1) { notify('Bekal habis. Dekati domba lalu tekan E.'); return; }
    food--; hero.hp = Math.min(100, hero.hp + 45); float('+45', hero.x, hero.y, '#c6eea1', true);
    addEffect(blue('Monk', 'Heal_Effect'), hero.x, hero.y, 140, .8); tone(587, .25); updateUI();
  }
  function nearestResource() {
    let closest = null, distance = 85;
    for (const node of [...trees.filter(t => t.resource).map(t => ({ ...t, type: 'wood', name: 'Tebang kayu +8' })), ...goldNodes.map(n => ({ ...n, type: 'gold', name: 'Tambang emas +10' })), ...sheep.filter(s => s.cooldown <= 0).map(s => ({ ...s, type: 'food', name: 'Ambil bekal +1', original: s }))]) {
      const d = dist(hero, node); if (d < distance) { distance = d; closest = node; }
    }
    return closest;
  }
  function gather() {
    if (state !== 'playing' || gatherCooldown > 0 || hero.work || hero.attack > 0 || hero.stagger > 0) return;
    const node = nearestResource(); if (!node) return;
    hero.work = { node, elapsed: 0, duration: node.type === 'food' ? .7 : .9 };
    hero.facing = node.x < hero.x ? -1 : 1; hero.moving = false;
  }
  function updateWork(dt) {
    const work = hero.work; if (!work) return;
    if (dist(hero, work.node) > 88 || hero.stagger > 0) { hero.work = null; return; }
    const previousTime = work.elapsed;
    work.elapsed += dt;
    if (previousTime < work.duration * .55 && work.elapsed >= work.duration * .55) {
      addEffect('Particle FX/Dust_01.png', work.node.x, work.node.y - 8, 45, .4);
      tone(work.node.type === 'gold' ? 660 : 190, .09, 'triangle', .025, work.node.type === 'gold' ? 420 : 110);
    }
    if (work.elapsed < work.duration) return;
    const node = work.node; hero.work = null; gatherCooldown = .18;
    if (node.type === 'food' && node.original.cooldown > 0) return;
    if (node.type === 'wood') { wood += 8; float('+8 kayu', node.x, node.y); }
    if (node.type === 'gold') { gold += 10; float('+10 emas', node.x, node.y); }
    if (node.type === 'food') { food++; node.original.cooldown = 12; float('+1 bekal', node.x, node.y); }
    score += 5; addEffect('Particle FX/Dust_01.png', node.x, node.y - 10, 55); tone(node.type === 'gold' ? 740 : 300, .08, 'triangle', .025); updateUI();
  }

  function hurt(target, amount, source) {
    if (target.hp <= 0 || (target === hero && hero.invuln > 0)) return;
    const appliedDamage = Math.min(target.hp, amount);
    if (source === hero && target.team === 'enemy') damageDealt += appliedDamage;
    if (target === hero) damageTaken += appliedDamage;
    target.hp -= amount;
    target.hitFlash = .18;
    const angle = source ? Math.atan2(target.y - source.y, target.x - source.x) : rand(0, Math.PI * 2);
    impacts.push({ x: target.x, y: target.y - (target === castle ? 40 : 27), angle, color: target === hero || target.team === 'ally' ? '#ff977d' : '#ffdb86', life: .3, duration: .3 });
    float(`−${amount}`, target.x + rand(-7, 7), target.y - (target === castle ? 45 : 10), target === hero ? '#ffbaa1' : '#fff1c5', true);
    if (target === hero) {
      hero.invuln = .45; shake = Math.max(shake, 3); $('gameShell').classList.add('player-hit'); tone(150, .12, 'triangle', .035, 75);
    } else if (target === castle) { shake = Math.max(shake, 2); addEffect('Particle FX/Explosion_02.png', castle.x + rand(-45, 45), castle.y - 20, 65, .35, 24); }
    else if (source === hero) { hitStop = .035; shake = Math.max(shake, 1.5); tone(280, .08, 'square', .017, 90); }
    if (target !== castle) {
      if (target === hero) hero.work = null;
      const force = target.kind === 'Lancer' ? 140 : target === hero ? 195 : 255;
      target.knockX = Math.cos(angle) * force; target.knockY = Math.sin(angle) * force;
      target.stagger = target === hero ? .09 : .12;
      target.strike = null;
    }
    if (target.hp <= 0 && target.team === 'enemy' && !target.dead) {
      target.dead = true; kills++; score += 25 + waveIndex * 5; gold += 6;
      addEffect('Particle FX/Explosion_01.png', target.x, target.y - 9, 75);
      drops.push({ x: target.x, y: target.y, type: Math.random() > .7 ? 'wood' : 'gold', life: 18, value: 5 });
      tone(320, .075, 'triangle', .02, 540);
    } else if (target.hp <= 0 && target.team === 'ally' && !target.dead) { target.dead = true; addEffect('Particle FX/Dust_02.png', target.x, target.y, 70); }
    target.hp = Math.max(0, target.hp);
  }
  function heroAttack() {
    if (hero.cooldown > 0 || hero.stagger > 0) return;
    hero.work = null;
    hero.attack = hero.attackDuration = .42; hero.cooldown = .58;
    const targets = enemies.filter(e => e.hp > 0 && dist(hero, e) < 108);
    if (targets.length) hero.facing = targets[0].x < hero.x ? -1 : 1;
    hero.strike = { timer: .12 };
    tone(380, .1, 'triangle', .018, 110);
  }
  function fireArrow(u, target) {
    const d = Math.max(1, dist(u, target));
    projectiles.push({ x: u.x, y: u.y - 5, vx: (target.x - u.x) / d * 360, vy: (target.y - u.y) / d * 360, color: u.color, team: u.team, target, source: u, damage: u.team === 'ally' ? 17 : 10 + waveIndex * 2, life: 1.4 });
  }
  function nearest(entity, candidates, limit = Infinity) {
    let target = null;
    for (const other of candidates) { if (other.hp <= 0) continue; const d = dist(entity, other); if (d < limit) { limit = d; target = other; } }
    return target;
  }
  function updateUnit(u, dt) {
    u.attack = Math.max(0, u.attack - dt); u.cooldown -= dt;
    u.chargeCooldown = (u.chargeCooldown || 0) - dt; u.charge = Math.max(0, (u.charge || 0) - dt);
    if (u.hp <= 0) return;
    if (u.strike) {
      u.strike.timer -= dt;
      if (u.strike.timer <= 0) {
        const strike = u.strike; u.strike = null;
        if (strike.target.hp > 0 && dist(u, strike.target) <= strike.range + 22) {
          if (u.kind === 'Archer') fireArrow(u, strike.target);
          else hurt(strike.target, strike.damage, u);
        }
      }
    }
    if (u.stagger > 0) { u.moving = false; return; }
    if (u.entering) {
      const exit = { x: 231, y: 402 + u.lane * 13 };
      if (dist(u, exit) < 22) u.entering = false;
      else { steerMove(u, exit, dt); return; }
    }
    if (u.kind === 'Monk') {
      const friends = u.team === 'ally' ? [hero, ...allies] : enemies;
      const wounded = nearest(u, friends.filter(f => f !== u && f.hp < f.maxHp), 220);
      const home = u.team === 'ally' ? { x: hero.x + 55, y: hero.y + 45 } : { x: hero.x - 130, y: hero.y + Math.sin(u.flankAngle) * 90 };
      if (wounded && dist(u, wounded) < 140 && u.cooldown <= 0) {
        wounded.hp = Math.min(wounded.maxHp, wounded.hp + (u.team === 'ally' ? 20 : 12));
        u.attack = u.attackDuration = .45; u.cooldown = u.team === 'ally' ? 3 : 4.5;
        addEffect(blue('Monk', 'Heal_Effect'), wounded.x, wounded.y, 110, .7); float(u.team === 'ally' ? '+20' : '+12', wounded.x, wounded.y, '#ceefa0'); u.moving = false;
      } else if (dist(u, wounded || home) > 100) steerMove(u, wounded || home, dt);
      else u.moving = false;
      return;
    }
    const target = u.team === 'ally' ? nearest(u, enemies, 650) : nearest(u, [hero, ...allies], 160) || (dist(u, castle) < 130 && dist(u, hero) > 420 ? castle : hero);
    if (!target) { if (dist(u, { x: u.homeX, y: u.homeY }) > 35) steerMove(u, { x: u.homeX, y: u.homeY }, dt); else u.moving = false; return; }
    const d = dist(u, target), range = u.kind === 'Archer' ? 225 : target === castle ? 88 : u.kind === 'Lancer' ? 91 : 51;
    if (u.team === 'enemy' && u.kind === 'Archer' && d < 145 && !u.strike) {
      const retreat = { x: u.x + (u.x - target.x), y: u.y + (u.y - target.y) };
      steerMove(u, retreat, dt, u.speed * .95); u.facing = target.x < u.x ? -1 : 1;
      if (u.cooldown <= 0) { u.attack = u.attackDuration = .72; u.cooldown = 1.6; u.strike = { timer: .31, target, range: 225 }; }
      return;
    }
    if (u.team === 'enemy' && u.kind === 'Warrior' && d > 100 && d < 250 && u.chargeCooldown <= 0) { u.charge = .65; u.chargeCooldown = 3.8; addEffect('Particle FX/Dust_01.png', u.x, u.y, 42); }
    if (d > range) {
      const radius = u.team === 'enemy' ? Math.min(100, d * .35) : 10;
      const angle = u.flankAngle || u.seed;
      const aim = { x: target.x + Math.cos(angle) * radius, y: target.y + Math.sin(angle) * radius };
      steerMove(u, canStand(aim.x, aim.y) ? aim : target, dt, u.speed * (u.charge > 0 ? 1.5 : 1));
    } else {
      u.moving = false; u.facing = target.x < u.x ? -1 : 1;
      if (u.cooldown <= 0) {
        u.attack = u.attackDuration = u.kind === 'Archer' ? .72 : .4; u.cooldown = u.kind === 'Archer' ? 1.6 : u.team === 'ally' ? .9 : Math.max(.85, 1.25 - waveIndex * .08);
        u.strike = { timer: u.kind === 'Archer' ? .31 : u.kind === 'Lancer' ? .24 : .2, target, range, damage: u.team === 'ally' ? 18 : (target === castle ? 13 : u.kind === 'Lancer' ? 13 : 10) + waveIndex * 2 };
      }
    }
  }

  function update(dt) {
    for (const u of [hero, ...allies, ...enemies]) keepOnLand(u);
    if (castle.hp <= 0 || hero.hp <= 0) { finish(false); return; }
    if (hitStop > 0) { hitStop -= dt; return; }
    elapsed += dt; gatherCooldown = Math.max(0, gatherCooldown - dt); hero.cooldown = Math.max(0, hero.cooldown - dt); hero.attack = Math.max(0, hero.attack - dt); hero.invuln = Math.max(0, hero.invuln - dt);
    for (const u of [hero, ...allies, ...enemies]) updateReaction(u, dt);
    castle.hitFlash = Math.max(0, (castle.hitFlash || 0) - dt);
    $('gameShell').classList.toggle('player-hit', hero.hitFlash > 0);
    if (hero.strike) {
      hero.strike.timer -= dt;
      if (hero.strike.timer <= 0) {
        hero.strike = null;
        const targets = enemies.filter(e => e.hp > 0 && dist(hero, e) < 94 && (e.x - hero.x) * hero.facing >= -12).sort((a, b) => dist(hero, a) - dist(hero, b)).slice(0, 3);
        targets.forEach((e, i) => hurt(e, i === 0 ? 27 : 18, hero));
      }
    }
    const dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    const dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    if ((dx || dy) && hero.work) { hero.work = null; gatherCooldown = .2; }
    if (hero.stagger <= 0) move(hero, dx, dy, dt, 185 * (hero.attack > 0 ? .55 : 1));
    updateWork(dt);
    if (keys.has(' ') || pointerAttack) heroAttack();
    if (keys.has('e')) gather();
    for (const s of sheep) s.cooldown = Math.max(0, s.cooldown - dt);
    if (phase === 'prepare') { waveTimer -= dt; if (dist(hero, castle) < 155) hero.hp = Math.min(100, hero.hp + 4 * dt); if (waveTimer <= 0) startWave(); }
    else {
      spawnTimer -= dt;
      if (spawned < waves[waveIndex].count && spawnTimer <= 0) {
        const batch = Math.min(3, waves[waveIndex].count - spawned);
        for (let i = 0; i < batch; i++) spawnEnemy();
        spawnTimer = waves[waveIndex].interval * 1.9;
      }
    }
    for (const u of [...allies, ...enemies]) updateUnit(u, dt);
    // Soft separation keeps soldiers from drawing exactly on top of one another.
    for (const group of [allies, enemies]) for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const a = group[i], b = group[j], d = dist(a, b);
      if (d > .1 && d < 31) { const push = (31 - d) * Math.min(.45, dt * 7), px = (a.x - b.x) / d * push, py = (a.y - b.y) / d * push; translateEntity(a, px, py); translateEntity(b, -px, -py); }
    }
    for (const p of projectiles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const candidates = p.team === 'ally' ? enemies : [hero, ...allies, castle];
      for (const target of candidates) if (target.hp > 0 && dist(p, target) < (target === castle ? 57 : 22)) { hurt(target, p.damage, p.source); p.life = 0; addEffect('Particle FX/Dust_01.png', p.x, p.y, 32, .25); break; }
    }
    projectiles = projectiles.filter(p => p.life > 0); enemies = enemies.filter(u => u.hp > 0); allies = allies.filter(u => u.hp > 0);
    for (const d of drops) {
      d.life -= dt;
      const distance = dist(d, hero);
      if (distance < 110) { d.x += (hero.x - d.x) * dt * 8; d.y += (hero.y - d.y) * dt * 8; }
      if (distance < 30) { if (d.type === 'wood') wood += d.value; else gold += d.value; float(`+${d.value}`, hero.x, hero.y - 12); d.life = 0; }
    }
    drops = drops.filter(d => d.life > 0);
    passiveTimer += dt;
    if (passiveTimer >= 6) { passiveTimer = 0; wood += 3; gold += 4; float('+3 kayu', villagers[0].x, villagers[0].y, '#dbdca0'); float('+4 emas', villagers[1].x, villagers[1].y); }
    if (castle.hp <= 0 || hero.hp <= 0) { finish(false); return; }
    if (phase === 'battle' && spawned >= waves[waveIndex].count && enemies.length === 0) finishWave();
    uiTimer += dt;
    if (uiTimer > .1) {
      updateUI(); uiTimer = 0;
      const node = nearestResource(); $('interactionHint').hidden = !node;
      if (node) $('interactionHint').querySelector('span').textContent = `${node.name} · tahan E`;
    }
    if (soundOn && (melodyTimer -= dt) <= 0) { melodyTimer = 2.6; tone([262, 294, 330, 392, 440][Math.floor(elapsed / 2.6) % 5], 1.1, 'sine', .008); }
  }
  function updateUI() {
    $('heroHealth').textContent = `${Math.ceil(hero.hp)} / 100`; $('heroHealthBar').style.width = `${hero.hp}%`;
    $('castleHealth').textContent = `${Math.ceil(castle.hp)} / 500`; $('castleHealthBar').style.width = `${castle.hp / 5}%`;
    $('goldCount').textContent = gold; $('woodCount').textContent = wood; $('foodCount').textContent = food; $('scoreCount').textContent = String(score).padStart(4, '0');
    const w = waves[waveIndex];
    $('waveCount').textContent = `${phase === 'prepare' ? waveIndex : waveIndex + 1} / 5`;
    $('waveTitle').textContent = phase === 'prepare' ? `Jeda · ${Math.max(0, Math.ceil(waveTimer))} dtk` : `Gelombang ${waveIndex + 1}`;
    $('waveDetail').textContent = phase === 'prepare' ? `Berikutnya: ${w.name}` : w.name;
    $('waveProgress').style.width = `${phase === 'prepare' ? (1 - waveTimer / (waveIndex === 0 ? 22 : 15)) * 100 : (spawned - enemies.length) / w.count * 100}%`;
    $('enemyCount').textContent = phase === 'prepare' ? `${allies.length} sekutu bersiap` : `${enemies.length + w.count - spawned} musuh tersisa`;
    $('phaseHint').textContent = phase === 'prepare' ? 'Kumpulkan bekal dan siapkan pertahanan.' : 'Musuh mendekat. Rumahmu membutuhkanmu.';
    const cost = recruitIndex % 4 === 2 ? 55 : 40;
    $('recruitCost').textContent = `${cost} emas · ${allies.length}/8`;
    $('recruitButton').classList.toggle('unavailable', gold < cost || allies.length >= 8);
    $('repairButton').classList.toggle('unavailable', wood < 30 || castle.hp >= 500);
    $('healButton').classList.toggle('unavailable', food < 1 || hero.hp >= 100);
  }
  function togglePause(force) {
    if (state !== 'playing' && state !== 'paused') return;
    const pause = typeof force === 'boolean' ? force : state === 'playing';
    state = pause ? 'paused' : 'playing'; keys.clear(); pointerAttack = false;
    $('pauseScreen').hidden = !pause; $('pauseButton').textContent = pause ? '▶' : 'Ⅱ';
    $('pauseButton').setAttribute('aria-label', pause ? 'Lanjutkan permainan' : 'Jeda permainan');
    $('interactionHint').hidden = true;
    if (pause) $('resumeButton').focus({ preventScroll: true }); else canvas.focus({ preventScroll: true });
  }
  function frame(time) {
    const dt = Math.min((time - lastTime) / 1000, .04) || .016; lastTime = time;
    if (state !== 'paused' && !document.querySelector('dialog[open]') && state !== 'won' && state !== 'lost') animTime += dt;
    if (state === 'playing') update(dt);
    if (state !== 'paused') {
      for (const e of effects) { e.life -= dt; e.time += dt; }
      effects = effects.filter(e => e.life > 0);
      for (const impact of impacts) impact.life -= dt;
      impacts = impacts.filter(impact => impact.life > 0);
      for (const f of floaters) { f.life -= dt; f.y -= dt * 26; } floaters = floaters.filter(f => f.life > 0);
      shake = Math.max(0, shake - dt * 16);
      if ((announcementTimer -= dt) <= 0) $('announcement').classList.remove('show');
      if ((toastTimer -= dt) <= 0) $('toast').classList.remove('show');
    }
    draw(); requestAnimationFrame(frame);
  }

  // Dialogs stop the battle and resume only if it was running beforehand.
  function openDialog(id) {
    if (document.querySelector('dialog[open]')) return;
    pausedForDialog = state === 'playing'; if (pausedForDialog) { state = 'paused'; keys.clear(); pointerAttack = false; }
    if (id === 'galleryDialog' && !$('galleryGrid').children.length) renderGallery();
    $(id).showModal();
  }
  for (const id of ['helpDialog', 'galleryDialog']) {
    $(id).addEventListener('close', () => { if (pausedForDialog) { state = 'playing'; canvas.focus({ preventScroll: true }); } pausedForDialog = false; });
    $(id).addEventListener('click', e => { if (e.target === $(id)) { const r = $(id).getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $(id).close(); } });
  }
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
  $('helpButton').addEventListener('click', () => openDialog('helpDialog'));
  $('galleryButton').addEventListener('click', () => openDialog('galleryDialog'));
  let galleryObserver;
  function renderGallery() {
    galleryObserver?.disconnect(); $('galleryGrid').replaceChildren();
    const category = $('galleryCategory').value, query = $('gallerySearch').value.toLowerCase();
    const assets = window.TINY_ASSETS.filter(a => (!category || a.path.startsWith(category + '/')) && a.path.toLowerCase().includes(query));
    $('gallerySummary').textContent = `${assets.length} dari ${window.TINY_ASSETS.length} aset asli · 5 folder utama · 56 folder aset`;
    galleryObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const preview = entry.target, meta = manifest.get(preview.dataset.path);
      loadImage(meta.path).then(im => {
        const g = preview.getContext('2d'); g.imageSmoothingEnabled = false;
        const animated = /Units\/|Particle FX\/|Trees\/Tree|Sheep\/|Bushes\/|Water Foam|Rubber Duck/.test(meta.path);
        const sw = animated ? spriteFrame(meta.path).width : meta.width, sh = meta.height;
        const s = Math.min(90 / sw, 90 / sh); g.drawImage(im, 0, 0, sw, sh, (90 - sw * s) / 2, (90 - sh * s) / 2, sw * s, sh * s);
      }).catch(() => {});
      galleryObserver.unobserve(preview);
    }), { root: $('galleryGrid'), rootMargin: '150px' });
    for (const a of assets) {
      const card = document.createElement('div'); card.className = 'gallery-card';
      const art = document.createElement('div'); art.className = 'gallery-art';
      const preview = document.createElement('canvas'); preview.width = 90; preview.height = 90; preview.dataset.path = a.path; preview.setAttribute('aria-label', a.path); art.append(preview);
      const title = document.createElement('strong'); title.textContent = a.path.split('/').pop().replace('.png', '');
      const folder = document.createElement('small'); folder.textContent = a.path.slice(0, a.path.lastIndexOf('/'));
      card.append(art, title, folder); $('galleryGrid').append(card); galleryObserver.observe(preview);
    }
    if (!assets.length) { const empty = document.createElement('p'); empty.textContent = 'Tidak ada aset yang cocok.'; $('galleryGrid').append(empty); }
  }
  $('gallerySearch').addEventListener('input', renderGallery); $('galleryCategory').addEventListener('change', renderGallery);
  $('startButton').addEventListener('click', startGame); $('restartButton').addEventListener('click', startGame); $('restartPauseButton').addEventListener('click', startGame);
  $('pauseButton').addEventListener('click', () => togglePause()); $('resumeButton').addEventListener('click', () => togglePause(false));
  for (const [id, action] of [['recruitButton', () => recruitUnit()], ['repairButton', repairCastle], ['healButton', healHero]]) {
    $(id).addEventListener('click', () => { action(); if (state === 'playing') canvas.focus({ preventScroll: true }); });
  }
  $('soundButton').addEventListener('click', () => {
    initAudio(); soundOn = !soundOn; $('soundButton').setAttribute('aria-pressed', String(soundOn)); $('soundButton').setAttribute('aria-label', soundOn ? 'Matikan suara' : 'Nyalakan suara');
    $('soundButton').querySelector('.sound-off').hidden = soundOn; if (soundOn) tone(523, .2);
  });
  $('fullscreenButton').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('gameShell').requestFullscreen(); }
    catch { notify('Layar penuh tidak tersedia di browser ini.'); }
  });
  document.addEventListener('fullscreenchange', resize);
  window.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if ((key === 'p' || key === 'escape') && !e.repeat) { e.preventDefault(); togglePause(); return; }
    if (state !== 'playing') return;
    const controls = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' ', 'e', '1', '2', 'q'];
    if (!controls.includes(key)) return;
    // Native buttons retain keyboard activation when deliberately focused.
    if (key === ' ' && e.target.tagName === 'BUTTON') return;
    e.preventDefault(); keys.add(key);
    if (!e.repeat) { if (key === '1') recruitUnit(); if (key === '2') repairCastle(); if (key === 'q') healHero(); }
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); pointerAttack = false; if (state === 'playing') togglePause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(true); });
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; if (state === 'playing') { canvas.focus({ preventScroll: true }); pointerAttack = true; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointerup', () => { pointerAttack = false; }); canvas.addEventListener('pointercancel', () => { pointerAttack = false; });
  for (const b of document.querySelectorAll('[data-move]')) {
    const key = { up: 'w', left: 'a', down: 's', right: 'd' }[b.dataset.move];
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); if (state === 'playing') keys.add(key); });
    const release = () => keys.delete(key); b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
  }
  for (const [id, key] of [['touchAttack', ' '], ['touchGather', 'e']]) {
    const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); if (state === 'playing') keys.add(key); });
    const release = () => keys.delete(key); b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
  }

  // Read-only state for meaningful smoke tests and inspecting an active match.
  window.PenjagaPulau = Object.freeze({ snapshot: () => ({ state, phase, wave: waveIndex + 1, waveTimer, spawned, enemies: enemies.map(u => ({ x: u.x, y: u.y, hp: u.hp, kind: u.kind, entering: u.entering, hitFlash: u.hitFlash, stagger: u.stagger })), allies: allies.map(u => ({ x: u.x, y: u.y, hp: u.hp, kind: u.kind })), hero: { x: hero.x, y: hero.y, hp: hero.hp, hitFlash: hero.hitFlash, stagger: hero.stagger }, impacts: impacts.length, damageDealt, damageTaken, work: hero.work ? {type: hero.work.node.type, elapsed: hero.work.elapsed, duration: hero.work.duration} : null, castleHp: castle.hp, gold, wood, food, score, kills, loadedAssets: [...images.values()].filter(r => r.loaded).length, assetCount: manifest.size }) });
  resize(); preload(); requestAnimationFrame(frame);
})();
