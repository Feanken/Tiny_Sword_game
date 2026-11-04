/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installNavigation = function ({navigation, world, config, math, session, combat}) {
    navigation.dispose?.();
    navigation.canStand = function canStand(x, y) {
      if(world.version===2)return world.floorGeometry.canStand(x,y);
      // Stay inside the visible grass edge, including diagonal shore corners.
      for (const [dx,dy] of config.footOffsets) if (!navigation.onLand(x+dx,y+dy)) return false;
      return navigation.onLand(x, y);
    };

    navigation.translateEntity = function translateEntity(entity, dx, dy) {
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
      for (let i = 0; i < steps; i++) {
        if (navigation.positionFits(entity.x + dx / steps, entity.y, entity)) entity.x += dx / steps;
        if (navigation.positionFits(entity.x, entity.y + dy / steps, entity)) entity.y += dy / steps;
      }
    };

    navigation.keepOnLand = function keepOnLand(entity) {
      if (navigation.canStand(entity.x, entity.y)) return;
      for (let radius = 4; radius <= 320; radius += 4) for (let i = 0; i < 24; i++) {
        const x = entity.x + Math.cos(i * Math.PI / 12) * radius, y = entity.y + Math.sin(i * Math.PI / 12) * radius;
        if (navigation.canStand(x, y)) { entity.x = x; entity.y = y; return; }
      }
      entity.x = world.heroSpawn.x; entity.y = world.heroSpawn.y;
    };

    navigation.positionFits = function positionFits(x, y, entity) {
      if(world.version===2)return world.isWalkable(x,y,entity);
      if (!navigation.canStand(x, y)) return false;
      return navigation.obstacleList.every(o => {
        const next = Math.hypot(x - o.x, y - o.y), radius = o.radius + 10;
        // An overlapping spawn can slide out, but cannot go deeper into a collider.
        return next >= radius - .01 || (entity && next > Math.hypot(entity.x - o.x, entity.y - o.y) + .001);
      });
    };

    navigation.clearPath = function clearPath(a, b) {
      if(world.version===2)return world.floorGeometry.segmentFits(a,b,navigation.obstacleList);
      const steps = Math.max(1, Math.ceil(math.dist(a, b) / 12));
      for (let i = 1; i <= steps; i++) if (!navigation.positionFits(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps)) return false;
      return true;
    };

    navigation.routeTo = function routeTo(a, b) {
      if(world.version===2&&(!navigation.canStand(a.x,a.y)||!navigation.onLand(b.x,b.y)))return [];
      let start=-1,best=Infinity;
      const col=Math.floor(a.x/32),row=Math.floor(a.y/32);
      for(let r=Math.max(0,row-3);r<=Math.min(navigation.navRows-1,row+3);r++) for(let c=Math.max(0,col-3);c<=Math.min(navigation.navCols-1,col+3);c++) {
        const i=r*navigation.navCols+c,n=navigation.navNodes[i],d=(n.x-a.x)**2+(n.y-a.y)**2;
        if(navigation.navOpen[i] && d<best && navigation.clearPath(a,n)){start=i;best=d;}
      }
      if(start<0)return [];
      let goal=-1;best=Infinity;
      for(let i=0;i<navigation.navNodes.length;i++) if(navigation.navComponent[i]===navigation.navComponent[start]) {
        const n=navigation.navNodes[i],d=(n.x-b.x)**2+(n.y-b.y)**2;
        if(d<best){goal=i;best=d;}
      }
      if(goal<0)return [];
      let field=navigation.routeFields.get(goal);
      if(!field){
        field=new Int16Array(navigation.navNodes.length).fill(-1);field[goal]=0;const queue=[goal];
        for(let head=0;head<queue.length;head++)for(const next of navigation.navEdges[queue[head]])if(field[next]<0){field[next]=field[queue[head]]+1;queue.push(next);}
        if(navigation.routeFields.size>=32)navigation.routeFields.delete(navigation.routeFields.keys().next().value);
        navigation.routeFields.set(goal,field);navigation.navigationStats.builds++;
      }else navigation.navigationStats.hits++;
      const path=world.version===2?[navigation.navNodes[start]]:[];let current=start;
      while(current!==goal){const next=navigation.navEdges[current].find(i=>field[i]>=0&&field[i]<field[current]);if(next===undefined)return [];path.push(navigation.navNodes[next]);current=next;}
      return path;
    };

    navigation.move = function move(entity, dx, dy, dt, speed) {
      const len = Math.hypot(dx, dy); entity.moving = len > .05;
      if (!entity.moving) return;
      navigation.translateEntity(entity, dx / len * speed * dt, dy / len * speed * dt);
      const committed=entity===session.hero?entity.attack>0&&combat.heroAttackAge()<config.SWING.end:entity.attack>0;
      if (Math.abs(dx) > .1 && !committed && !(entity.stagger > 0)) entity.facing = dx > 0 ? 1 : -1;
      for (const o of navigation.obstacleList) {
        const vx = entity.x - o.x, vy = entity.y - o.y, d = Math.hypot(vx, vy), min = o.radius + 10;
        if (d < min && d > .01) {
          const px = o.x + vx / d * min, py = o.y + vy / d * min;
          navigation.translateEntity(entity, px - entity.x, py - entity.y);
        }
      }
    };

    navigation.steerMove = function steerMove(entity, target, dt, speed = entity.speed) {
      if(entity.routeTopologyVersion!==world.topologyVersion){
        entity.route=[];entity.routeTimer=0;entity.routeTarget=null;
        entity.routeTopologyVersion=world.topologyVersion;
      }
      entity.progressTimer = (entity.progressTimer || 0) - dt;
      if(entity.progressTimer<=0){
        const previousStall=entity.stallSeconds||0;
        entity.stallSeconds = entity.progressPosition && math.dist(entity,entity.progressPosition)<6 && math.dist(entity,target)>40 ? previousStall+1 : 0;
        if(entity.stallSeconds>0&&!previousStall)session.combatStats.stalls++;
        entity.progressPosition = {x:entity.x,y:entity.y};entity.progressTimer=1;
        if(entity.stallSeconds>0)entity.routeTimer=0;
      }
      entity.routeTimer = (entity.routeTimer || 0) - dt;
      if (!navigation.clearPath(entity, target)) {
        if (entity.routeTimer <= 0 || !entity.routeTarget || math.dist(entity.routeTarget, target) > 64) {
          entity.route = navigation.routeTo(entity, target); entity.routeTimer = .9; entity.routeTarget = { ...target };
        }
        const path = entity.route || [];
        while (path.length && math.dist(entity, path[0]) < (world.version===2?3:12) &&
          (world.version!==2||path.length===1||navigation.clearPath(entity,path[1]))) path.shift();
        while (path.length > 1 && navigation.clearPath(entity, path[1])) path.shift();
        if (path.length) {
          navigation.navigateStep(entity,path[0].x-entity.x,path[0].y-entity.y,dt,
            world.version===2?Math.min(speed,math.dist(entity,path[0])/dt):speed);
          entity.blockedSeconds = 0; return;
        }
        entity.blockedSeconds = (entity.blockedSeconds || 0) + dt;if(entity.blockedSeconds>1)session.combatStats.blockedSeconds+=dt; entity.moving = false; return;
      } else { entity.route = []; entity.blockedSeconds = 0; }
      let dx = target.x - entity.x, dy = target.y - entity.y;
      const distance = Math.hypot(dx, dy); if (distance < 3) { entity.moving = false; return; }
      dx /= distance; dy /= distance;
      for (const o of navigation.obstacleList) {
        const ox = entity.x - o.x, oy = entity.y - o.y, d = Math.hypot(ox, oy);
        // On v2, the segment is already clear. Extra repulsion can prevent an
        // actor from ever reaching a valid goal near the fortress or a bridge.
        if (world.version!==2 && d < o.radius + 45 && d > .1) {
          const force = (o.radius + 45 - d) / 45, side = entity.flankSign || 1;
          dx += (ox / d * 2.3 - oy / d * side * .9) * force;
          dy += (oy / d * 2.3 + ox / d * side * .9) * force;
        }
      }
      navigation.navigateStep(entity,dx,dy,dt,speed);
    };

    navigation.navigateStep = function navigateStep(u,dx,dy,dt,speed){
      const length=Math.hypot(dx,dy);if(length<.001){u.moving=false;return;}
      dx/=length;dy/=length;
      // A shared right-hand passing rule avoids opposite steering decisions each frame.
      if(u!==session.hero&&!u.entering){
        let blocker=null,nearest=38*38;
        for(const other of session.combatUnits){if(other===u||other.hp<=0||other.entering)continue;
          const ox=other.x-u.x,oy=other.y-u.y,d2=ox*ox+oy*oy;
          if(d2<nearest&&ox*dx+oy*dy>0){nearest=d2;blocker=other;}
        }
        if(blocker){
          const strength=(38-Math.sqrt(nearest))/38*1.4,px=-dy,py=dx;
          const side=navigation.positionFits(u.x+(dx+px)*10,u.y+(dy+py)*10)?1:-1;
          dx+=px*strength*side;dy+=py*strength*side;
        }
      }
      navigation.move(u,dx,dy,dt,speed);
    };

    navigation.followEntry = function (unit, dt) {
      const path = world.entryPaths.get(unit.pathId ?? world.wavePathIds[0]);
      const last = path.points.length - 1;
      let index = unit.entryWaypoint ?? 1;
      for (; index <= last; index++) {
        const point = path.points[index];
        const offset = index === last ? path.exitLaneOffset : {x: 0, y: 0};
        const target = {x: point.x + unit.lane * offset.x, y: point.y + unit.lane * offset.y};
        const distance = math.dist(unit, target);
        if (distance < (index === last ? path.exitRadius : 4)) continue;
        unit.entryWaypoint = index;
        if (last === 1 || !navigation.clearPath(unit, target)) {
          navigation.steerMove(unit, target, dt);
        } else {
          navigation.move(unit, target.x - unit.x, target.y - unit.y, dt, Math.min(unit.speed, distance / dt));
        }
        return true;
      }
      unit.entryWaypoint = index;
      unit.entering = false;
      return false;
    };

    navigation.land = (c, r) => world.version===2 ?
      world.floorGeometry.contains((c+.5)*world.tileSize,(r+.5)*world.tileSize) :
      !!world.rows[r] && c >= world.rows[r][0] && c <= world.rows[r][1];

    navigation.onLand = (x, y) => world.version===2 ? world.floorGeometry.contains(x,y) :
      navigation.land(Math.floor(x / world.tileSize), Math.floor(y / world.tileSize)) && x > world.landBounds.left && x < world.landBounds.right && y > world.landBounds.top && y < world.landBounds.bottom;

    navigation.routeFields = new Map();
    navigation.navigationStats = { builds:0, hits:0, topologyBuilds:0 };
    navigation.rebuildTopology = function rebuildTopology() {
      navigation.routeFields.clear();
      navigation.obstacleList = world.activeObstacles;
      session.approachSlots?.clear();session.engagements?.clear();
      if(session.combatUnits)session.combatUnits.length=0;
      for(const u of new Set([session.hero,...session.allies,...session.enemies])){
        Object.assign(u,{
          route:[],routeTimer:0,routeTarget:null,routeTopologyVersion:world.topologyVersion,
          approachTarget:null,approachSlot:-1,approachThink:0,
          combatTarget:null,protectTarget:null,targetThink:0,roleThink:0,
          healTarget:null,healThink:0,supportGoal:null,supportThink:0,
          evadeAction:null,evadeGoal:null,retreatGoal:null,repositionGoal:null,
          arrowGoal:null,arrowEvade:0,arrowThink:0,strike:null,attack:0,
          progressPosition:null,progressTimer:0,stallSeconds:0,blockedSeconds:0
        });
        if(world.version===2&&!navigation.positionFits(u.x,u.y)){
          navigation.keepOnLand(u);
          if(!navigation.positionFits(u.x,u.y)){u.x=world.heroSpawn.x;u.y=world.heroSpawn.y;}
        }
        if(u.entering&&!world.entryPaths.has(u.pathId)){u.entering=false;u.pathId=null;}
      }
      if(session.hero)session.hero.work=null;
      navigation.navCols = Math.ceil(world.width / 32);

      navigation.navRows = Math.ceil(world.height / 32);

      navigation.navNodes = Array.from({ length: navigation.navCols * navigation.navRows }, (_, i) => ({ x: i % navigation.navCols * 32 + 16, y: Math.floor(i / navigation.navCols) * 32 + 16 }));

      navigation.navOpen = navigation.navNodes.map(p => navigation.positionFits(p.x, p.y));

      navigation.navEdges = navigation.navNodes.map((n, i) => navigation.navOpen[i] ? [i-navigation.navCols,i+navigation.navCols,i%navigation.navCols?i-1:-1,i%navigation.navCols<navigation.navCols-1?i+1:-1].filter(j => j>=0 && j<navigation.navNodes.length && navigation.navOpen[j] && navigation.clearPath(n,navigation.navNodes[j])) : []);

      navigation.navComponent = new Int16Array(navigation.navNodes.length).fill(-1);

      navigation.componentCount = 0;

      for(let i=0;i<navigation.navNodes.length;i++) if(navigation.navOpen[i] && navigation.navComponent[i]<0) {
        const queue=[i];navigation.navComponent[i]=navigation.componentCount;
        for(let head=0;head<queue.length;head++) for(const next of navigation.navEdges[queue[head]]) if(navigation.navComponent[next]<0){navigation.navComponent[next]=navigation.componentCount;queue.push(next);}
        navigation.componentCount++;
      }
      navigation.topologyVersion=world.topologyVersion;
      navigation.navigationStats.topologyBuilds++;
    };
    navigation.rebuildTopology();
    const unsubscribe=world.onTopologyChange(()=>navigation.rebuildTopology());
    navigation.dispose=unsubscribe;
  };
})(window.PenjagaModules = window.PenjagaModules || {});
