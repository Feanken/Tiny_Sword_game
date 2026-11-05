/* Classic script. Load after config, base-stats and upgrade-progress. */
((M) => {
  'use strict';
  const DEFAULT_MAP_IDS = Object.freeze(['island', 'crossroads']);
  const { MAX_UPGRADE_LEVEL, upgrades } = M.config;
  const rankIds = upgrades.map(upgrade => upgrade.id);
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  function carryFrom({gold, ranks, upgradeProgress}) {
    if (!Number.isSafeInteger(gold) || gold < 0) throw new RangeError('Gold must be a nonnegative safe integer.');
    if (!isRecord(ranks)) throw new TypeError('Upgrade ranks must be an object.');
    const carriedRanks = {};
    const milestones = {};
    for (const id of rankIds) {
      const rank = ranks[id];
      if (!Object.hasOwn(ranks, id) || !Number.isInteger(rank) || rank < 0 || rank > MAX_UPGRADE_LEVEL) {
        throw new RangeError(`Rank ${id} must be an integer from 0 to ${MAX_UPGRADE_LEVEL}.`);
      }
      carriedRanks[id] = rank;
      milestones[id] = Math.min(2,Math.floor(rank / 5));
    }
    // Prototype capacities match GameSession and the Oath/Bastion upgrades.
    const progress=upgradeProgress??{ranks:carriedRanks,paidTierUnlocks:Object.fromEntries(rankIds.map(id=>[id,[]])),bossVictories:[]};
    if(!M.UpgradeProgress.validSnapshot(progress)||rankIds.some(id=>progress.ranks[id]!==carriedRanks[id]))
      throw new RangeError('Carried ranks need matching paid tiers and boss evidence.');
    const derived=M.BaseStats.resolve(carriedRanks),heroHp=derived.heroMaxHp,castleHp=derived.castleMaxHp;
    const frozenProgress=Object.freeze({
      ranks:Object.freeze({...carriedRanks}),
      paidTierUnlocks:Object.freeze(Object.fromEntries(rankIds.map(id=>[id,Object.freeze([...progress.paidTierUnlocks[id]])]))),
      bossVictories:Object.freeze([...progress.bossVictories])
    });
    return Object.freeze({
      gold,
      ranks: Object.freeze(carriedRanks),
      milestones: Object.freeze(milestones),
      upgradeProgress:frozenProgress,
      hero: Object.freeze({hp: heroHp, maxHp: heroHp}),
      castle: Object.freeze({hp: castleHp, maxHp: castleHp})
    });
  }

  M.Expedition = class Expedition {
    #mapIds;
    #runId = 0;
    #arenaIndex = 0;
    #status = 'idle';
    #activeArena = null;

    constructor(mapIds = DEFAULT_MAP_IDS) {
      if (!Array.isArray(mapIds) || !mapIds.length || [...mapIds].some(id => typeof id !== 'string' || !id.trim() || id !== id.trim())) {
        throw new TypeError('An expedition needs an ordered array of map IDs.');
      }
      this.#mapIds = Object.freeze([...mapIds]);
    }

    snapshot() {
      return {
        runId: this.#runId,
        status: this.#status,
        mapIds: this.#mapIds,
        completedMapIds: this.#mapIds.slice(0, this.#arenaIndex),
        activeArena: this.#activeArena
      };
    }

    startNew() {
      this.#runId++;
      this.#arenaIndex = 0;
      this.#status = 'active';
      this.#activeArena = this.#request(null);
      return this.#activeArena;
    }

    finishArena(result) {
      if (!isRecord(result)) throw new TypeError('An arena result must be an object.');
      const current = this.#activeArena;
      if (!current) return {accepted: false, status: this.#status, reason: 'inactive', nextArena: null};
      if (result.runId !== current.runId || result.arenaIndex !== current.arenaIndex || result.mapId !== current.mapId) {
        return {accepted: false, status: this.#status, reason: 'stale-arena', nextArena: null};
      }
      if (result.outcome !== 'won' && result.outcome !== 'lost') throw new TypeError('Arena outcome must be won or lost.');

      if (result.outcome === 'lost') {
        this.#activeArena = null;
        this.#status = 'lost';
        return {accepted: true, status: this.#status, nextArena: null};
      }

      const hasNextArena = this.#arenaIndex + 1 < this.#mapIds.length;
      // Validate before changing the stage so a corrected result can be submitted.
      const carry = hasNextArena ? carryFrom(result) : null;
      this.#arenaIndex++;
      this.#status = hasNextArena ? 'active' : 'completed';
      this.#activeArena = hasNextArena ? this.#request(carry) : null;
      return {accepted: true, status: this.#status, nextArena: this.#activeArena};
    }

    #request(carry) {
      return Object.freeze({
        runId: this.#runId,
        arenaIndex: this.#arenaIndex,
        mapId: this.#mapIds[this.#arenaIndex],
        carry
      });
    }
  };
})(window.PenjagaModules = window.PenjagaModules || {});
