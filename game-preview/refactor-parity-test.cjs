// Differential replay against the frozen, pre-refactor implementation at 6b60a5e.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createGame} = require('./game-harness.cjs');
const baseline = fs.readFileSync(__dirname + '/fixtures/baseline-game.js', 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
let comparisons = 0;
for (const mode of ['easy', 'normal', 'hard']) {
  const before = createGame(47, baseline), after = createGame(47);
  const games = [before.g, after.g];
  const equal = label => {
    assert.deepEqual(plain(after.snapshot()), plain(before.snapshot()), mode + ': ' + label);
    comparisons++;
  };
  for (const g of games) { g.setDifficulty(mode); g.startGame(47); g.setGold(10000); }
  equal('start');
  for (let rank = 1; rank <= 10; rank++) {
    for (const id of ['blade', 'rhythm', 'wind', 'counter', 'bastion', 'oath']) for (const g of games) g.buyUpgrade(id);
    equal('upgrade ' + rank);
  }
  for (const g of games) {
    Object.assign(g.hero, {x: 610, y: 510, moving: false});
    g.gather();
  }
  const gold = after.g.gold;
  for (let i = 0; i < 60; i++) { for (const g of games) g.advance(1 / 60); equal('mining ' + i); }
  assert.equal(after.g.gold, gold + 50, 'Preserve user mining edit');
  for (const g of games) {
    for (let i = 0; i < 7; i++) g.recruitUnit();
    Object.assign(g.hero, {x: 600, y: 410});
    g.startWave();
  }
  for (let frame = 0; frame < 2400; frame++) {
    for (const g of games) {
      if (frame % 180 === 0) { g.keys.clear(); g.keys.add(frame % 360 ? 'a' : 'd'); g.keys.add(' '); }
      if (frame % 240 === 0) g.requestDash();
      if (frame % 300 === 0) { g.setSquadOrder(frame % 600 ? 'guard' : 'follow'); g.healHero(); g.repairCastle(); }
      if (frame === 500 || frame === 501) g.togglePause(frame === 500);
      g.advance(1 / 60);
    }
    if (frame % 10 === 0) equal('battle frame ' + frame);
  }
  for (const g of games) g.startGame(47);
  equal('restart');
}
console.log(comparisons + ' identical snapshots across three modes: mining +50, all 60 upgrades, input/dash, squads, combat, pause and restart.');
