/* Map 2 playtest, based on the authoring example from 33ee225. */
((root) => {
  'use strict';
  if (!root.PenjagaMaps?.island) throw new Error('Load maps/island.js before the Map 2 example.');
  const map = JSON.parse(JSON.stringify(root.PenjagaMaps.island));
  map.id = 'crossroads';
  map.name = 'Pulau Dua Arah';
  map.arrivalTiming = {
    alternatingWaves: 2,
    alternatingGap: 4.8,
    pairedGap: 3.3,
    firstDeparture: 1.5,
    warningLead: 3.4,
  };
  const west = map.paths.find(path => path.id === 'path-west');
  west.points.push({ x: 350, y: 393 }, { x: 510, y: 410 }, { x: 665, y: 395 });
  west.warningLabel = '← Dari kiri';
  map.roads.push({ id: 'road-north', points: [[800, 94], [794, 165], [765, 238], [765, 325], [845, 333]] });
  map.paths.push({
    id: 'path-north', roadId: 'road-north',
    points: [{ x: 800, y: 110 }, { x: 794, y: 165 }, { x: 765, y: 238 }, { x: 765, y: 325 }],
    entryLaneOffset: { x: 7, y: 0 }, exitLaneOffset: { x: 13, y: 0 }, exitRadius: 22,
    warningLabel: '↑ Dari atas',
  });
  map.enemySpawns.push({ id: 'spawn-north-wave', role: 'wave', pathId: 'path-north', x: 800, y: 110, jitter: { x: [0, 0], y: [-3, 3] }, lanes: [-1, 0, 1, -2, 2] });
  root.PenjagaMaps.crossroads = map;
})(typeof window === 'object' ? window : globalThis);
