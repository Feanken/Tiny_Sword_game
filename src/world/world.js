/* Map definitions are immutable authoring data; each World owns its mutable copy. */
(function (M) {
  'use strict';
  const validateMap = definition => window.PenjagaMapValidation.assertValidMap(definition);
  M.validateMap = validateMap;
  M.World = class World {
    constructor(definition) {
      Object.assign(this, JSON.parse(JSON.stringify(validateMap(definition))));
      const fallback = {
        id: 'path-west',
        points: [this.roadEntry, {x: this.roadEntry.x + 121, y: this.roadEntry.y - 3}],
        entryLaneOffset: {x: 0, y: 7}, exitLaneOffset: {x: 0, y: 13}, exitRadius: 22
      };
      this.entryPaths = new Map((this.paths ?? [fallback]).map(path => [path.id, path]));
      const spawns = this.enemySpawns ?? [
        {...this.roadEntry, pathId: fallback.id, role: 'wave', jitter: {x: [-3, 3], y: [0, 0]}, lanes: [-1, 0, 1, -2, 2]},
        {...this.roadEntry, pathId: fallback.id, role: 'boss', jitter: {x: [0, 0], y: [0, 0]}, lanes: [0]}
      ];
      this.waveSpawns = new Map();
      for (const spawn of spawns) {
        if (spawn.role === 'boss') {
          if (this.bossSpawn) throw new Error('Only one boss entry spawn is supported.');
          this.bossSpawn = spawn;
        } else {
          if (this.waveSpawns.has(spawn.pathId)) throw new Error('Duplicate wave spawn for ' + spawn.pathId);
          this.waveSpawns.set(spawn.pathId, spawn);
        }
      }
      this.wavePathIds = [...this.waveSpawns.keys()];
      if (!this.wavePathIds.length || !this.bossSpawn) throw new Error('Map requires a wave entry and a boss entry.');
    }
    resetResources() { for (const sheep of this.sheep) sheep.cooldown = 0; }
  };
})(window.PenjagaModules = window.PenjagaModules || {});
