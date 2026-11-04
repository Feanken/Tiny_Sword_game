/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.GameSession = class GameSession {
    constructor({world}) {
      Object.assign(this, {
        world: world,
        gameRandom: Math.random,
        castle: { ...world.castle, hp: 500, maxHp: 500 },
        hero: { ...world.heroSpawn, hp: 100, maxHp: 100, facing: 1, attack: 0, cooldown: 0, invuln: 0, moving: false, hitFlash: 0, stagger: 0, knockX: 0, knockY: 0 },
        runSeed: 0,
        encounters: [],
        state: 'loading',
        phase: 'prepare',
        waveIndex: 0,
        waveTimer: 22,
        spawned: 0,
        spawnTimer: 0,
        gold: 80,
        wood: 40,
        food: 3,
        score: 0,
        kills: 0,
        recruitIndex: 0,
        elapsed: 0,
        animTime: 0,
        gatherCooldown: 0,
        passiveTimer: 0,
        shake: 0,
        enemies: [],
        allies: [],
        effects: [],
        floaters: [],
        drops: [],
        projectiles: [],
        impacts: [],
        approachSlots: new Map(),
        combatUnits: [],
        engagements: new Map(),
        combatId: 0,
        pressureActive: 0,
        pressureGap: 0,
        rangedPressureGap: 0,
        collectingHeroDamage: false,
        pendingHeroDamage: null,
        combatStats: {},
        simulationAccumulator: 0,
        damageDealt: 0,
        damageTaken: 0,
        dashTrail: [],
        campPurchase: -1,
        difficulty: 'normal',
        squadOrder: 'follow',
        bossSpawned: false,
        boss: null,
        orderPulse: 0,
        ranks: { blade:0, rhythm:0, wind:0, counter:0, bastion:0, oath:0 },
        lastTime: 0,
        initialized: false,
      });
      Object.assign(this.hero, world.heroSpawn);
      Object.assign(this.castle, world.castle);
    }
    resetForRun() {
      const world = this.world;
      this.combatId=0;this.pressureActive=0;this.pressureGap=0;this.rangedPressureGap=0;this.approachSlots.clear();this.engagements.clear();this.combatUnits.length=0;this.collectingHeroDamage=false;this.pendingHeroDamage=null;
      Object.assign(this.hero,{impactHold:0,damageCue:0,dodgeCue:0,missCue:0,lastDamageTime:-99,stepTimer:0,swingFacing:1,swingEmpowered:false,labelSlot:0,markerLayout:null});
      Object.assign(this.hero, { x: world.heroSpawn.x, y: world.heroSpawn.y, hp: 100, facing: 1, attack: 0, cooldown: 0, invuln: 0, moving: false, hitFlash: 0, stagger: 0, knockX: 0, knockY: 0, strike: null });
      this.simulationAccumulator = 0;
      this.squadOrder='follow';this.boss=null;this.bossSpawned=false;this.orderPulse=0;
      this.hero.maxHp=100;this.castle.maxHp=500;this.campPurchase=-1;for(const id in this.ranks)this.ranks[id]=0;this.dashTrail=[];
      Object.assign(this.hero,{dash:0,dashCooldown:0,dashElapsed:0,riposte:0,dashPerfect:false,lastMoveX:1,lastMoveY:0});
      this.hero.work = null; this.hero.healCooldown = 0; this.hero.animTime = 0; this.hero.animState = 'Idle';
      this.castle.hp = 500; this.castle.hitFlash = 0; this.gold = 80; this.wood = 40; this.food = 3; this.score = 0; this.kills = 0; this.recruitIndex = 0;
      this.enemies = []; this.allies = []; this.effects = []; this.floaters = []; this.drops = []; this.projectiles = []; this.impacts = []; this.damageDealt = 0; this.damageTaken = 0;
      this.phase = 'prepare'; this.waveIndex = 0; this.waveTimer = 22; this.spawned = 0; this.spawnTimer = 0; this.elapsed = 0; this.passiveTimer = 0; this.gatherCooldown = 0; this.shake = 0;
    }
  };
})(window.PenjagaModules = window.PenjagaModules || {});
