'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createGame} = require('./game-harness.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const a = createGame(47), b = createGame(47);
const registry = {window: {}};
vm.runInNewContext(fs.readFileSync('maps/island.js', 'utf8'), registry);
const definition = registry.window.PenjagaMaps.island;
const baselineSource = fs.readFileSync(__dirname + '/fixtures/baseline-game.js', 'utf8');
const baseline = createGame(47, baselineSource.replace('snapshot: () => ({ runSeed',
  'snapshot: () => ({ mapAudit: {width:W,height:H,tileSize:TILE,rows,roadEntry,trees,goldNodes,sheep,buildings,rocks,bushes,villagers}, runSeed'));
for (const [key, value] of Object.entries(baseline.snapshot().mapAudit)) assert.deepEqual(plain(definition[key]), plain(value), 'Map baseline parity: ' + key);
assert.deepEqual(plain(definition.roads.map(road => road.points)), plain(vm.runInNewContext(baselineSource.match(/const roads = ([^\r\n]+);/)[1])));
const pristine = JSON.stringify(definition);
const World = a.runtime.world.constructor;
const first = new World(definition), second = new World(definition);
for (const field of ['rows', 'heroSpawn', 'castle', 'roadEntry', 'squadGuard', 'allySpawn', 'allyHome', 'trees', 'goldNodes', 'sheep', 'buildings', 'rocks', 'bushes', 'villagers']) {
  assert.deepEqual(plain(first[field]), plain(definition[field]));
  assert.notEqual(first[field], definition[field]);
}
first.sheep[0].cooldown = 12;
assert.equal(second.sheep[0].cooldown, 0);
first.resetResources(); assert.equal(first.sheep[0].cooldown, 0);
assert.equal(JSON.stringify(definition), pristine);
assert.throws(() => new World({...definition, heroSpawn: {x: -1, y: 0}}), /OUTSIDE_WORLD/);
const alternate = new World({...definition, id: 'alternate-test', heroSpawn: {x: 600, y: 410}});
const alternateSession = new a.runtime.session.constructor({world: alternate});
alternateSession.hero.x = 900; alternateSession.resetForRun();
assert.deepEqual({x: alternateSession.hero.x, y: alternateSession.hero.y}, {x: 600, y: 410});

assert.notEqual(a.runtime.navigation.routeFields, b.runtime.navigation.routeFields);
a.g.startGame(47); b.g.startGame(47);
a.g.keys.add('d'); a.g.advance(1 / 60);
assert.notEqual(a.g.hero.x, b.g.hero.x);
a.g.ranks.blade = 10;
assert.equal(b.g.ranks.blade, 0);
assert.equal(a.runtime.world.sheep[0].cooldown, 0);
assert.ok(Object.isFrozen(a.runtime.config.GATHERING_REWARDS));
assert.equal(a.runtime.config.GATHERING_REWARDS.gold, 50);

const miningReward = b.runtime.config.GATHERING_REWARDS.gold;
Object.assign(b.g.hero, {x: 610, y: 510});
assert.equal(b.runtime.economy.nearestResource().name, `Tambang emas +${miningReward}`);
const goldBeforeMining = b.g.gold;
b.g.gather();
for (let tick = 0; tick < 60; tick++) b.g.advance(1 / 60);
assert.equal(b.g.gold - goldBeforeMining, miningReward);
assert.ok(b.g.floaters.some(floater => floater.text === `+${miningReward} emas`));

// Input subscriptions must detach, and a held control must not survive disposal.
const listeners = new Map();
const target = {
  addEventListener(type, fn) { listeners.set(type, fn); },
  removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); }
};
a.runtime.input.listen(target, 'keydown', () => a.g.keyboardInput('w', true));
listeners.get('keydown')(); assert.ok(a.g.keys.has('w'));
a.runtime.input.dispose();
assert.equal(listeners.size, 0); assert.equal(a.g.keys.size, 0);
assert.equal(a.runtime.input.attached, false);
a.runtime.input.attach(); const count = a.runtime.input.listeners.length;
a.runtime.input.attach(); assert.equal(a.runtime.input.listeners.length, count);
console.log('Map contract, definition immutability, world/session/cache isolation, mining config and input detach/reattach: passed');
