'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../src/camera.js'), 'utf8'), context);
const {Camera2D} = context.window.PenjagaModules;
const close = (a,b) => assert.ok(Math.abs(a-b) < 1e-8, a + ' != ' + b);
for (const [width,height] of [[1280,704],[2560,1792],[4096,3072]]) {
  for (const [cssWidth,cssHeight] of [[1200,660],[1440,704],[1800,900]]) {
    const camera = new Camera2D(width,height);
    camera.resize(cssWidth,cssHeight);
    assert.equal(camera.height,704,'World growth must not change viewport zoom.');
    const rect = {left:31,top:123,width:cssWidth,height:cssHeight};
    for (const target of [{x:0,y:0},{x:width,y:height},{x:width/2,y:height/2}]) {
      camera.follow(target);
      if (camera.width<=width) assert.ok(camera.x>=0 && camera.x<=width-camera.width);
      if (camera.height<=height) assert.ok(camera.y>=0 && camera.y<=height-camera.height);
      const screen = camera.worldToScreen(target.x,target.y,rect);
      const world = camera.screenToWorld(screen.x,screen.y,rect);
      close(world.x,target.x);close(world.y,target.y);
      assert.ok(camera.intersects(camera.x+10,camera.y+10,1,1));
      assert.equal(camera.intersects(camera.x-100,camera.y-100,10,10),false);
    }
  }
}
console.log('PASS camera: fixed viewport scale, X/Y clamping, screen/world round trips and two-axis culling.');
