/* Preview art consumes World floor rectangles; it never defines walkable land. */
((M) => {
  'use strict';
  const themes = {
    'island-main': {label:'Pulau Embun', tile:1, color:'#9abc75'},
    'island-north': {label:'Bukit Utara', tile:5, color:'#7fbaa4'},
    'island-southwest': {label:'Pesisir Barat Daya', tile:4, color:'#b3ac75'},
    'bridge-north': {label:'Jembatan Utara', color:'#b58b57'},
    'bridge-southwest': {label:'Jembatan Barat Daya', color:'#b58b57'}
  };
  const terrain = path => 'Terrain/' + path + '.png';
  const boundsOf = rectangles => {
    const x = Math.min(...rectangles.map(r => r.x)), y = Math.min(...rectangles.map(r => r.y));
    return {x,y,width:Math.max(...rectangles.map(r => r.x+r.width))-x,height:Math.max(...rectangles.map(r => r.y+r.height))-y};
  };
  function floorPath(ctx, rectangles) {
    ctx.beginPath();
    for (const rect of rectangles) ctx.rect(rect.x,rect.y,rect.width,rect.height);
  }

  M.MapPreviewRenderer = class MapPreviewRenderer {
    constructor(world, images) {
      this.world = world;
      this.images = images;
      this.canvas = document.createElement('canvas');
      this.canvas.width = world.width;
      this.canvas.height = world.height;
      this.rebuild();
      this.dispose = world.onTopologyChange(() => this.rebuild());
    }

    static theme(id) { return themes[id] || {label:id,color:'#9abc75',tile:1}; }

    static assetPaths(world) {
      const collections = world.allCollections;
      const paths = new Set([terrain('Tileset/Water Background color'), terrain('Resources/Meat/Sheep/Sheep_Idle'),
        'Units/Blue Units/Warrior/Warrior_Idle.png','Units/Blue Units/Warrior/Warrior_Run.png']);
      for (const variant of [1,4,5]) paths.add(terrain('Tileset/Tilemap_color'+variant));
      for (const tree of collections.trees) paths.add(terrain('Resources/Wood/Trees/Tree'+tree.variant));
      for (const gold of collections.goldNodes) paths.add(terrain('Resources/Gold/Gold Stones/Gold Stone '+gold.variant));
      for (const building of collections.buildings) paths.add('Buildings/'+building.color+' Buildings/'+building.name+'.png');
      for (const [, , variant] of collections.rocks) paths.add(terrain('Decorations/Rocks/Rock'+variant));
      for (const [, , variant] of collections.bushes) paths.add(terrain('Decorations/Bushes/Bushe'+variant));
      for (const worker of collections.villagers) paths.add('Units/Blue Units/Pawn/Pawn_Interact '+worker.tool+'.png');
      return [...paths];
    }

    rebuild() {
      const {world} = this, ctx = this.canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = ctx.createPattern(this.images.get(terrain('Tileset/Water Background color')), 'repeat');
      ctx.fillRect(0,0,world.width,world.height);
      this.regions = [...new Set(world.allFloorGeometry.rectangles.map(rect => rect.regionId))].map(id => {
        const rectangles = world.allFloorGeometry.rectangles.filter(rect => rect.regionId === id);
        return {id,rectangles,bounds:boundsOf(rectangles),kind:rectangles[0].kind,theme:M.MapPreviewRenderer.theme(id)};
      });
      for (const region of this.regions) {
        const {rectangles,bounds,theme} = region;
        ctx.save();
        floorPath(ctx,rectangles);
        ctx.fillStyle = '#234d53';
        ctx.shadowColor = '#123240';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 8;
        ctx.fill();
        ctx.restore();
        ctx.save();
        floorPath(ctx,rectangles);
        ctx.clip();
        if (region.kind === 'bridge') {
          ctx.fillStyle = '#8b623e';
          ctx.fillRect(bounds.x,bounds.y,bounds.width,bounds.height);
          for (let y=bounds.y; y<bounds.y+bounds.height; y+=12) {
            ctx.fillStyle = '#c5a16b';
            ctx.fillRect(bounds.x,y,bounds.width,9);
            ctx.fillStyle = '#e7c486';
            ctx.fillRect(bounds.x,y,bounds.width,2);
          }
        } else {
          const size = world.tileSize, tile = this.images.get(terrain('Tileset/Tilemap_color'+theme.tile));
          const contains = (x,y) => world.allFloorGeometry.contains(x,y);
          for (let y=Math.floor(bounds.y/size)*size;y<bounds.y+bounds.height;y+=size) {
            for (let x=Math.floor(bounds.x/size)*size;x<bounds.x+bounds.width;x+=size) {
              const sx = !contains(x-size/2,y+size/2) ? 0 : !contains(x+size*1.5,y+size/2) ? 128 : 64;
              const sy = !contains(x+size/2,y-size/2) ? 0 : !contains(x+size/2,y+size*1.5) ? 128 : 64;
              ctx.drawImage(tile,sx,sy,64,64,x,y,size,size);
            }
          }
        }
        ctx.restore();
      }
      ctx.save();
      floorPath(ctx,world.allFloorGeometry.rectangles);
      ctx.clip();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const road of world.allCollections.roads) {
        ctx.beginPath();
        road.points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
        for (const [color,width] of [['#7e985a',43],['#c5c08a',30]]) {
          ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
        }
      }
      ctx.restore();
      const locked = document.createElement('canvas');
      locked.width=world.width;locked.height=world.height;
      const shade=locked.getContext('2d');
      for (const region of this.regions.filter(r => !world.isRegionActive(r.id))) {
        shade.save();
        floorPath(shade,region.rectangles);
        shade.clip();
        shade.fillStyle = '#10263bd9';
        shade.fillRect(region.bounds.x,region.bounds.y,region.bounds.width,region.bounds.height);
        shade.strokeStyle = '#88a7ba30';shade.lineWidth=2;
        for (let x=region.bounds.x-region.bounds.height;x<region.bounds.x+region.bounds.width;x+=28) {
          shade.beginPath();shade.moveTo(x,region.bounds.y);shade.lineTo(x+region.bounds.height,region.bounds.y+region.bounds.height);shade.stroke();
        }
        shade.restore();
      }
      // Bridge caps overlap islands. An inactive cap must not darken walkable mainland.
      shade.globalCompositeOperation='destination-out';
      floorPath(shade,world.floorGeometry.rectangles);shade.fill();
      ctx.drawImage(locked,0,0);
      this.objects = [];
      const add = (collection, create) => world.allCollections[collection].forEach((value,index) => {
        const sourceId=world.objectIds[collection][index];
        if (world.isObjectActive(sourceId)) this.objects.push({...create(value),sourceId});
      });
      add('trees',t => ({...t,path:terrain('Resources/Wood/Trees/Tree'+t.variant),size:t.size,animated:true}));
      add('goldNodes',g => ({...g,path:terrain('Resources/Gold/Gold Stones/Gold Stone '+g.variant),size:64}));
      add('buildings',b => ({...b,path:'Buildings/'+b.color+' Buildings/'+b.name+'.png',size:b.width}));
      add('rocks',([x,y,v]) => ({x,y,path:terrain('Decorations/Rocks/Rock'+v),size:39}));
      add('bushes',([x,y,v]) => ({x,y,path:terrain('Decorations/Bushes/Bushe'+v),size:75,animated:true}));
      add('sheep',s => ({...s,path:terrain('Resources/Meat/Sheep/Sheep_Idle'),size:77,animated:true}));
      add('villagers',v => ({...v,path:'Units/Blue Units/Pawn/Pawn_Interact '+v.tool+'.png',size:104,animated:true}));
      this.objects.sort((a,b) => a.y-b.y);
    }

    paintObject(ctx, camera, object, time, hero) {
      const image = this.images.get(object.path);
      const tree = /\/Trees\/Tree/.test(object.path);
      const frameWidth = tree ? 192 : object.animated ? image.height : image.width;
      const frameHeight = image.height;
      const width = object.animated ? object.size*frameWidth/frameHeight : object.size;
      const height = object.animated ? object.size : object.size*frameHeight/frameWidth;
      const anchor = object.animated ? tree ? (frameHeight===256 ? .95 : .87) : .79 : 1;
      const x = object.x-width/2, y = object.y-height*anchor;
      if (!camera.intersects(x,y,width,height)) return false;
      const frame = object.animated ? Math.floor((time+(object.seed||0))*5) % Math.max(1,Math.floor(image.width/frameWidth)) : 0;
      ctx.globalAlpha = object!==hero && hero.x>x && hero.x<x+width && hero.y>y && hero.y<object.y-10 ? .45 : 1;
      ctx.save();
      if (object.facing < 0) {ctx.translate(object.x*2,0);ctx.scale(-1,1);}
      ctx.drawImage(image,frame*frameWidth,0,frameWidth,frameHeight,Math.round(x),Math.round(y),width,height);
      ctx.restore();
      ctx.globalAlpha = 1;
      return true;
    }

    draw(ctx, camera, time, hero) {
      const x=Math.max(0,camera.x),y=Math.max(0,camera.y);
      const width=Math.min(this.world.width-x,camera.width-(x-camera.x));
      const height=Math.min(this.world.height-y,camera.height-(y-camera.y));
      ctx.fillStyle='#3c859c';ctx.fillRect(camera.x,camera.y,camera.width,camera.height);
      if (width>0 && height>0) ctx.drawImage(this.canvas,x,y,width,height,x,y,width,height);
      for (const region of this.regions) {
        if (!camera.intersects(region.bounds.x,region.bounds.y,region.bounds.width,region.bounds.height)) continue;
        const active=this.world.isRegionActive(region.id),cx=region.bounds.x+region.bounds.width/2;
        ctx.font='bold 13px Segoe UI';ctx.textAlign='center';
        ctx.fillStyle=active ? '#fff1b8' : '#c2d0de';
        ctx.fillText(region.theme.label.toUpperCase()+(active?'':' · TERKUNCI'),cx,region.bounds.y+28);
      }
      let painted=0, heroPainted=false;
      const actor={...hero,path:'Units/Blue Units/Warrior/Warrior_'+(hero.moving?'Run':'Idle')+'.png',size:136,animated:true};
      for (const object of this.objects) {
        if (!heroPainted && object.y>hero.y) {this.paintObject(ctx,camera,actor,time,actor);heroPainted=true;}
        if (this.paintObject(ctx,camera,object,time,actor)) painted++;
      }
      if (!heroPainted) this.paintObject(ctx,camera,actor,time,actor);
      this.stats={objects:this.objects.length,painted,culled:this.objects.length-painted};
    }

    minimap(canvas,camera,hero,castle) {
      const ctx=canvas.getContext('2d'),sx=canvas.width/this.world.width,sy=canvas.height/this.world.height;
      ctx.setTransform(sx,0,0,sy,0,0);
      ctx.fillStyle='#153144';ctx.fillRect(0,0,this.world.width,this.world.height);
      const ordered=[...this.regions].sort((a,b)=>Number(this.world.isRegionActive(a.id))-Number(this.world.isRegionActive(b.id)));
      for (const region of ordered) {
        floorPath(ctx,region.rectangles);
        ctx.fillStyle=this.world.isRegionActive(region.id)?region.theme.color:'#41505d';
        ctx.fill();
      }
      ctx.strokeStyle='#ffffff';ctx.lineWidth=2/sx;ctx.strokeRect(camera.x,camera.y,camera.width,camera.height);
      ctx.fillStyle='#ecc271';ctx.fillRect(castle.x-18,castle.y-18,36,36);
      ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(hero.x,hero.y,5/sx,0,Math.PI*2);ctx.fill();
      ctx.setTransform(1,0,0,1,0,0);
    }
  };
})(window.PenjagaModules = window.PenjagaModules || {});
