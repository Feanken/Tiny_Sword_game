/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installAssets = function ({assets: assetStore, host, world, math, renderer, session}) {
    assetStore.loadImage = function loadImage(path) {
      if (assetStore.images.has(path)) return assetStore.images.get(path).promise;
      const image = new Image();
      const record = { image, loaded: false };
      record.promise = new Promise((resolve, reject) => {
        image.onload = () => { record.loaded = true; resolve(image); };
        image.onerror = () => { assetStore.images.delete(path); reject(new Error(path)); };
      });
      assetStore.images.set(path, record);
      image.src = path;
      return record.promise;
    };

    assetStore.img = function img(path) { const r = assetStore.images.get(path); return r?.loaded ? r.image : null; };

    assetStore.preload = async function preload() {
      const paths = new Set();
      for (const color of ['Blue', 'Red', 'Purple', 'Yellow', 'Black']) {
        for (const kind of ['Warrior', 'Archer', 'Lancer', 'Monk', 'Pawn']) {
          for (const action of ['Idle', 'Run']) paths.add(math.unitPath(color, kind, action));
          if (kind === 'Warrior') paths.add(math.unitPath(color, kind, 'Attack1'));
          if (kind === 'Archer') { paths.add(math.unitPath(color, kind, 'Shoot')); paths.add(`Units/${color} Units/Archer/Arrow.png`); }
          if (kind === 'Lancer') paths.add(math.unitPath(color, kind, 'Right_Attack'));
          if (kind === 'Monk') paths.add(math.unitPath(color, kind, 'Heal'));
        }
      }
      for (const tool of ['Axe', 'Pickaxe']) paths.add(math.blue('Pawn', `Interact ${tool}`));
      paths.add(math.blue('Pawn', 'Idle Meat'));paths.add(math.unitPath('Black','Warrior','Attack2'));paths.add(math.unitPath('Black','Warrior','Guard'));
      paths.add(math.blue('Monk', 'Heal_Effect'));
      paths.add(math.blue('Warrior', 'Attack2'));
      for (const b of world.buildings) paths.add(`Buildings/${b.color} Buildings/${b.name}.png`);
      for (let i = 1; i <= 4; i++) {
        paths.add(math.terrain(`Resources/Wood/Trees/Tree${i}`));
        paths.add(math.terrain(`Resources/Wood/Trees/Stump ${i}`));
        paths.add(math.terrain(`Decorations/Bushes/Bushe${i}`));
        paths.add(math.terrain(`Decorations/Rocks/Rock${i}`));
        paths.add(math.terrain(`Decorations/Rocks in the Water/Water Rocks_0${i}`));
      }
      for (const n of world.goldNodes) paths.add(math.terrain(`Resources/Gold/Gold Stones/Gold Stone ${n.variant}`));
      for (const p of ['Tileset/Tilemap_color1', 'Tileset/Water Background color', 'Tileset/Water Foam', 'Tileset/Shadow', 'Decorations/Rubber Duck/Rubber duck', 'Decorations/Clouds/Clouds_01', 'Decorations/Clouds/Clouds_03', 'Resources/Meat/Sheep/Sheep_Idle', 'Resources/Meat/Sheep/Sheep_Move', 'Resources/Meat/Sheep/Sheep_Grass', 'Resources/Gold/Gold Resource/Gold_Resource', 'Resources/Meat/Meat Resource/Meat Resource', 'Resources/Wood/Wood Resource/Wood Resource']) paths.add(math.terrain(p));
      for (const p of ['Dust_01', 'Dust_02', 'Explosion_01', 'Explosion_02', 'Fire_01', 'Fire_02', 'Fire_03', 'Water Splash']) paths.add(`Particle FX/${p}.png`);
      if(world.version===2)for(const p of M.MapPreviewRenderer.assetPaths(world))paths.add(p);
      let loaded = 0;
      const failures = [];
      await Promise.all([...paths].map(async p => { try { await assetStore.loadImage(p); } catch { failures.push(p); } loaded++; host.$('loadingProgress').style.width = `${loaded / paths.size * 100}%`; }));
      if (failures.length) {
        host.$('loadError').hidden = false;
        host.$('loadError').textContent = `${failures.length} aset gagal dimuat. Pastikan folder aset tetap lengkap, lalu muat ulang.`;
        host.$('startLabel').textContent = 'Muat ulang untuk mencoba';
        host.$('startButton').disabled = false;
        host.$('startButton').onclick = () => location.reload();
        console.error('Assets missing:', failures);
        return;
      }
      renderer.terrainCanvas = renderer.makeTerrain();
      session.initialized = true;
      session.state = 'ready';
      host.$('startButton').disabled = false;
      host.$('startLabel').textContent = 'Mulai petualangan';
      host.$('loadingTrack').hidden = true;
      renderer.resize();
    };

    assetStore.images = new Map();

    assetStore.manifest = new Map(window.TINY_ASSETS.map(a => [a.path, a]));
  };
})(window.PenjagaModules = window.PenjagaModules || {});
