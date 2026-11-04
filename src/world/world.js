/* Map definitions are immutable authoring data; each World owns its mutable copy. */
(function (M) {
  'use strict';
  const validateMap = definition => window.PenjagaMapValidation.assertValidMap(definition);
  M.validateMap = validateMap;
  M.World = class World {
    #listeners = new Set();
    constructor(definition) {
      Object.assign(this, JSON.parse(JSON.stringify(validateMap(definition))));
      const fallback = {
        id: 'path-west',
        points: [this.roadEntry, {x: this.roadEntry.x + 121, y: this.roadEntry.y - 3}],
        entryLaneOffset: {x: 0, y: 7}, exitLaneOffset: {x: 0, y: 13}, exitRadius: 22
      };
      this.allEntryPaths = new Map((this.paths ?? [fallback]).map(path => [path.id, path]));
      const spawns = this.enemySpawns ?? [
        {...this.roadEntry, pathId: fallback.id, role: 'wave', jitter: {x: [-3, 3], y: [0, 0]}, lanes: [-1, 0, 1, -2, 2]},
        {...this.roadEntry, pathId: fallback.id, role: 'boss', jitter: {x: [0, 0], y: [0, 0]}, lanes: [0]}
      ];
      this.allWaveSpawns = new Map();
      this.allBossSpawns = new Map();
      for (const spawn of spawns) {
        if (spawn.role === 'boss') {
          if (this.allBossSpawns.has(spawn.pathId)) throw new Error('Duplicate boss spawn for ' + spawn.pathId);
          this.allBossSpawns.set(spawn.pathId, spawn);
        } else {
          if (this.allWaveSpawns.has(spawn.pathId)) throw new Error('Duplicate wave spawn for ' + spawn.pathId);
          this.allWaveSpawns.set(spawn.pathId, spawn);
        }
      }
      this.allCollections = Object.freeze(Object.fromEntries(
        ['trees','goldNodes','sheep','buildings','rocks','bushes','villagers','roads','decorations','obstacles']
          .filter(key=>Array.isArray(this[key])).map(key=>[key,Object.freeze([...this[key]])])));
      this.topologyVersion = 1;
      if (this.version === 2) {
        this.allFloorGeometry = window.PenjagaFloor.createFloor(this);
        this.#activate(this.previewChapters['chapter-1']);
      } else {
        this.activeRegionIds = Object.freeze([]);
        this.floorGeometry = this.allFloorGeometry = window.PenjagaFloor?.createFloor(this);
        this.activeObstacles = this.obstacles ?? [
          ...this.trees.map(t=>({x:t.x,y:t.y-4,radius:t.radius})),
          ...this.goldNodes,...this.buildings.map(b=>({x:b.x,y:b.cy,radius:b.radius}))
        ];
        this.#indexPaths();
      }
      if (!this.wavePathIds.length || !this.bossSpawn) throw new Error('Map requires a wave entry and a boss entry.');
    }
    #indexPaths() {
      const active=p=>this.version!==2||p.requiredRegionIds.every(id=>this.isRegionActive(id));
      this.entryPaths = new Map([...this.allEntryPaths].filter(([,p])=>active(p)));
      this.waveSpawns = new Map([...this.allWaveSpawns].filter(([id])=>this.entryPaths.has(id)));
      this.bossSpawns = new Map([...this.allBossSpawns].filter(([id])=>this.entryPaths.has(id)));
      this.bossSpawn = this.bossSpawns.values().next().value;
      this.wavePathIds = Object.freeze([...this.waveSpawns.keys()]);
    }
    #activate(ids) {
      this.activeRegionIds = Object.freeze(this.regions.filter(r=>ids.includes(r.id)).map(r=>r.id));
      this.floorGeometry = window.PenjagaFloor.createFloor(this,this.activeRegionIds);
      for(const [key,all] of Object.entries(this.allCollections)) {
        this[key] = all.filter((item,i)=>{
          if(key==='obstacles')return this.isObjectActive(item.sourceId);
          if(item.requiredRegionIds)return item.requiredRegionIds.every(id=>this.isRegionActive(id));
          const sourceId=this.objectIds[key]?.[i];
          return !sourceId||this.isObjectActive(sourceId);
        });
      }
      this.activeObstacles = Object.freeze([...this.obstacles]);
      this.#indexPaths();
    }
    isRegionActive(id) { return this.activeRegionIds.includes(id); }
    isObjectActive(sourceId) {
      return this.version!==2 || this.isRegionActive(this.objectRegions[sourceId]);
    }
    isWalkable(x,y,entity) {
      return this.floorGeometry ? this.floorGeometry.positionFits(x,y,this.activeObstacles,entity) :
        window.PenjagaMapValidation.positionFits(this,x,y);
    }
    path(id) { return this.entryPaths.get(id); }
    guardPoint(id) {
      return this.guardPoints?.find(g=>g.id===id&&this.isRegionActive(g.regionId)&&
        (g.requiredRegionIds||[]).every(region=>this.isRegionActive(region)));
    }
    onTopologyChange(listener) {
      if(typeof listener!=='function')throw new TypeError('Topology listener must be a function.');
      this.#listeners.add(listener);
      return ()=>this.#listeners.delete(listener);
    }
    applyChapterPreview(chapterId) {
      const ids=this.previewChapters?.[chapterId];
      if(!ids)throw new RangeError('Unknown preview chapter: '+chapterId);
      return this.applyOpenRegions(ids);
    }
    applyOpenRegions(ids) {
      if(this.version!==2||!Array.isArray(ids)||new Set(ids).size!==ids.length||
        !Object.values(this.previewChapters).some(set=>set.length===ids.length&&set.every(id=>ids.includes(id))))
        throw new RangeError('Expected one cumulative campaign region set.');
      if(ids.length===this.activeRegionIds.length&&ids.every(id=>this.isRegionActive(id)))return false;
      this.#activate(ids);
      this.topologyVersion++;
      const event=Object.freeze({version:this.topologyVersion,activeRegionIds:this.activeRegionIds});
      for(const listener of this.#listeners)listener(event);
      return true;
    }
    resetResources() { for (const sheep of this.sheep) sheep.cooldown = 0; }
  };
})(window.PenjagaModules = window.PenjagaModules || {});
