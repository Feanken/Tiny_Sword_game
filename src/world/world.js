/* Map definitions are immutable authoring data; each World owns its mutable copy. */
(function (M) {
  'use strict';
  const validateMap = definition => window.PenjagaMapValidation.assertValidMap(definition);
  M.validateMap = validateMap;
  M.World = class World {
    constructor(definition) {
      Object.assign(this, JSON.parse(JSON.stringify(validateMap(definition))));
      // The current engine consumes one entry path. Additional authored paths stay data.
      this.entryPath = this.paths?.[0] || {
        points: [this.roadEntry, {x: this.roadEntry.x + 121, y: this.roadEntry.y - 3}],
        entryLaneOffset: {x: 0, y: 7}, exitLaneOffset: {x: 0, y: 13}, exitRadius: 22
      };
    }
    resetResources() { for (const sheep of this.sheep) sheep.cooldown = 0; }
  };
})(window.PenjagaModules = window.PenjagaModules || {});
