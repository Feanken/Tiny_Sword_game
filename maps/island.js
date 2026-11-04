/* Map 1, extracted from game.js at 6b60a5e. Classic script; no runtime work. */
((root) => {
  'use strict';
  const map = {
    version: 1, id: 'island', name: 'Pulau Penjaga',
    width: 1280, height: 704, tileSize: 64,
    rows: { 1: [6, 14], 2: [3, 17], 3: [2, 18], 4: [2, 18], 5: [1, 18], 6: [1, 18], 7: [2, 18], 8: [2, 17], 9: [4, 16] },
    landBounds: { left: 80, right: 1195, top: 80, bottom: 630 },
    heroSpawn: { x: 788, y: 370 },
    castle: { x: 845, y: 310 },
    roadEntry: { x: 110, y: 405 },
    squadGuard: { x: 845, y: 355 },
    allySpawn: { x: 885, y: 355 },
    allyHome: { x: 720, y: 325, width: 120, height: 100 },
    trees: [
      [200, 330, 1], [153, 488, 2], [222, 505, 3], [292, 554, 4], [349, 589, 1],
      [420, 185, 3], [484, 173, 4], [551, 184, 1], [621, 181, 2],
      [1155, 329, 1], [1157, 414, 2], [1133, 543, 4], [1067, 590, 1], [1001, 613, 2],
      [421, 604, 3], [487, 613, 4], [554, 613, 1], [629, 608, 2],
      [278, 322, 3], [346, 317, 2], [291, 472, 4],
    ].map(([x, y, variant], i) => ({ x, y, variant, seed: i * .71, radius: variant < 3 ? 14 : 12, size: variant < 3 ? 166 : 150, resource: i < 5 || i >= 18 })),
    goldNodes: [[571, 534, 1], [610, 563, 3], [646, 531, 4]].map(([x, y, variant]) => ({ x, y, variant, radius: 13 })),
    sheep: [[1014, 298], [1063, 316], [1010, 342]].map(([x, y], i) => ({ x, y, originX: x, originY: y, seed: i * 2, cooldown: 0 })),
    buildings: [
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
    ],
    rocks: [[140, 473, 1], [384, 202, 3], [469, 576, 2], [687, 591, 4], [1098, 266, 2], [1150, 454, 3]],
    bushes: [[299, 216, 1], [372, 323, 2], [464, 191, 3], [670, 183, 4], [1044, 243, 1], [1120, 405, 2], [836, 575, 3], [550, 582, 4], [176, 423, 1]],
    villagers: [{ x: 704, y: 414, tool: 'Axe', type: 'wood', facing: -1 }, { x: 619, y: 493, tool: 'Pickaxe', type: 'gold', facing: -1 }],

    // Optional v1 authoring extension. Baseline arrays above stay deep-equal.
    layoutVersion: 1,
    collision: { footRadius: 23, footSamples: 8, obstaclePadding: 10, overlapTolerance: .01 },
    heroFacing: 1, allyFacing: -1,
    allySpawnJitter: { x: [-15, 15], y: [-10, 10] },
    initialAllies: [{ id: 'initial-archer', kind: 'Archer', spawn: 'allySpawn', free: true }],
    fortress: { id: 'blue-fortress', buildingId: 'building-01' },
    roads: [
      { id: 'road-west', points: [[94, 405], [223, 401], [350, 393], [510, 410], [687, 390], [845, 333]] },
      { id: 'road-settlement', points: [[687, 390], [821, 448], [978, 464], [1084, 453]] },
      { id: 'road-archery', points: [[845, 333], [977, 286], [1005, 230]] },
      { id: 'road-tower', points: [[845, 333], [744, 288], [733, 236]] },
    ],
    roadStyle: { lineCap: 'round', lineJoin: 'round', strokes: [{ color: '#7eaa5d', width: 43 }, { color: '#b9bd79', width: 33 }, { color: '#c4c78b', width: 24 }] },
    paths: [{
      id: 'path-west', roadId: 'road-west',
      points: [{ x: 110, y: 405 }, { x: 231, y: 402 }],
      entryLaneOffset: { x: 0, y: 7 }, exitLaneOffset: { x: 0, y: 13 }, exitRadius: 22,
    }],
    enemySpawns: [
      { id: 'spawn-west-wave', role: 'wave', pathId: 'path-west', x: 110, y: 405, jitter: { x: [-3, 3], y: [0, 0] }, lanes: [-1, 0, 1, -2, 2] },
      { id: 'spawn-west-boss', role: 'boss', pathId: 'path-west', x: 110, y: 405, jitter: { x: [0, 0], y: [0, 0] }, lanes: [0] },
    ],
    decorations: [
      ...[[98, 284, 1], [1216, 510, 2], [360, 659, 3], [1160, 156, 4]].map(([x, y, variant]) => ({ id: `water-rock-${variant}`, kind: 'image', domain: 'world', x, y, width: 65, asset: `Terrain/Decorations/Rocks in the Water/Water Rocks_0${variant}.png`, layer: 'floor' })),
      { id: 'stump-1', kind: 'image', domain: 'land', x: 373, y: 496, width: 48, asset: 'Terrain/Resources/Wood/Trees/Stump 1.png', layer: 'floor' },
      { id: 'stump-3', kind: 'image', domain: 'land', x: 522, y: 211, width: 45, asset: 'Terrain/Resources/Wood/Trees/Stump 3.png', layer: 'floor' },
      { id: 'duck', kind: 'duck', domain: 'world', x: 1036, y: 53, width: 30, height: 30, asset: 'Terrain/Decorations/Rubber Duck/Rubber duck.png', layer: 'floor', motion: { xAmplitude: 22, xRate: .24, yAmplitude: 2, yRate: 1.8 }, animation: { frameWidth: 32, frameHeight: 32, frames: 3, fps: 4 }, anchor: 'top-left' },
      { id: 'cloud-east', kind: 'cloud', domain: 'world', x: 0, y: 52, width: 365, height: 162, asset: 'Terrain/Decorations/Clouds/Clouds_01.png', layer: 'canopy', alpha: .13, motion: { speed: 7, wrap: 1700, offsetX: -320, direction: 1 }, reducedMotion: 'hide', anchor: 'top-left' },
      { id: 'cloud-west', kind: 'cloud', domain: 'world', x: 1020, y: 516, width: 280, height: 124, asset: 'Terrain/Decorations/Clouds/Clouds_01.png', layer: 'canopy', alpha: .13, motion: { speed: 4, wrap: 1700, offsetX: 0, direction: -1 }, reducedMotion: 'hide', anchor: 'top-left' },
      { id: 'jetty-west', kind: 'jetty', domain: 'world', x: 25, y: 386, layer: 'terrain',
        rectangles: [[23, 392, 106, 45, '#275f5d66'], [25, 386, 102, 4, '#684f3b'], [25, 420, 102, 5, '#684f3b']],
        planks: { startX: 28, endXExclusive: 126, step: 11, y: 386, width: 9, height: 39, oddColor: '#c5a16b', evenColor: '#b8915c', highlight: [1, 389, 2, 30, '#ead39a55'], nails: [[3, 389, 2, 2, '#72533b'], [3, 417, 2, 2, '#72533b']] },
        posts: [[119, 362, 5, 33, '#775b3e'], [119, 420, 5, 30, '#775b3e']] },
    ],
    terrainStyle: {
      tileset: 'Terrain/Tileset/Tilemap_color1.png', water: 'Terrain/Tileset/Water Background color.png', waterColor: '#4c9cab',
      detailSeed: 8453, waterDetails: { count: 185, color: '#b2e6df33' },
      grassDetails: { attempts: 170, colors: ['#d9d78b', '#e5e2a0', '#679d53', '#9fbc63'] },
      foam: { asset: 'Terrain/Tileset/Water Foam.png', fps: 7, frames: 16, frameStride: 192, sourceX: 64, sourceY: 128, sourceSize: 64, width: 64, height: 28, alpha: .32, alphaAmplitude: .1, alphaRate: 1.7 },
    },
  };
  // Sidecar IDs preserve the exact shape of the arrays required by Chat 1.
  map.objectIds = {};
  for (const [collection, prefix] of Object.entries({ trees: 'tree', goldNodes: 'gold', sheep: 'sheep', buildings: 'building', rocks: 'rock', bushes: 'bush', villagers: 'villager' })) {
    map.objectIds[collection] = map[collection].map((_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);
  }
  map.obstacles = [
    ...map.trees.map((t, i) => ({ id: `obstacle-tree-${i + 1}`, sourceId: map.objectIds.trees[i], x: t.x, y: t.y - 4, radius: t.radius })),
    ...map.goldNodes.map((n, i) => ({ id: `obstacle-gold-${i + 1}`, sourceId: map.objectIds.goldNodes[i], x: n.x, y: n.y, radius: n.radius })),
    ...map.buildings.map((b, i) => ({ id: `obstacle-building-${i + 1}`, sourceId: map.objectIds.buildings[i], x: b.x, y: b.cy, radius: b.radius })),
  ];
  root.PenjagaMaps = root.PenjagaMaps || {};
  root.PenjagaMaps.island = map;
})(typeof window === 'object' ? window : globalThis);
