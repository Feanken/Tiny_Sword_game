// Transport/contract smoke test. This is not the renderer preview owned by Chat 2.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'penjaga-campaign-browser-'));
const chrome=process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scripts=['maps/island.js','maps/floor-geometry.js','maps/campaign-islands.js',
  'maps/validate-map.js','src/config.js','src/world/world.js','src/skill-config.js','src/upgrade-skills.js','src/session.js','src/math.js','src/navigation.js'];
const body=`
  const M=window.PenjagaModules,world=new M.World(PenjagaMaps['campaign-islands']);
  const session=new M.GameSession({world});
  const rt={world,session,config:M.config,math:{},navigation:{},combat:{heroAttackAge:()=>0}};
  M.installMath(rt);M.installNavigation(rt);
  const must=(value,message)=>{if(!value)throw new Error(message);};
  const states=[];
  for(const [chapter,count] of [['chapter-1',1],['chapter-2',2],['chapter-3',3]]){
    world.applyChapterPreview(chapter);
    must(world.wavePathIds.length===count,'path count');
    must(rt.navigation.componentCount===1,'connectivity');
    must(world.isWalkable(world.heroSpawn.x,world.heroSpawn.y),'hero floor');
    must(world.floorGeometry.contains(1664,384)===(count>=2),'north unlock');
    must(world.floorGeometry.contains(256,1600)===(count>=3),'southwest unlock');
    states.push(chapter);
  }
  rt.navigation.routeFields.set(1,new Int16Array([0]));
  world.applyChapterPreview('chapter-1');
  must(rt.navigation.routeFields.size===0,'stale routes');
  rt.navigation.dispose();
  document.body.textContent='CAMPAIGN_GEOMETRY_PASS '+states.join(',');
`;
function fixture(base){
  return '<!doctype html><meta charset="utf-8"><title>Geometry contract test</title><body>PENDING'+
    '<script>window.onerror=(message)=>{document.body.textContent="ERROR "+message;};</script>'+
    scripts.map(file=>'<script src="'+base+file+'"></script>').join('')+
    '<script>try{'+body+'}catch(error){document.body.textContent="ERROR "+error.stack;}</script>';
}
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  if(url.pathname==='/'){
    response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(fixture('/'));return;
  }
  const file=url.pathname.slice(1);
  if(!scripts.includes(file)){response.writeHead(404);response.end();return;}
  response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});
  response.end(fs.readFileSync(path.join(root,file)));
});
async function dump(url,profile){
  const child=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run',
    '--disable-background-networking','--user-data-dir='+profile,'--dump-dom',
    '--virtual-time-budget=10000',url],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr=(stderr+data).slice(-5000));
  const timeout=setTimeout(()=>child.kill(),30000);
  try{
    const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
    assert.equal(code,0,stderr);
    // Match text content, not the PASS string inside an unexecuted script.
    assert.match(stdout,/<body>CAMPAIGN_GEOMETRY_PASS chapter-1,chapter-2,chapter-3<\/body>/);
  }finally{clearTimeout(timeout);}
}
try{
  const file=path.join(temp,'contract.html');
  fs.writeFileSync(file,fixture(pathToFileURL(root+path.sep).href));
  await dump(pathToFileURL(file).href,path.join(temp,'file-profile'));
  console.log('PASS file:// campaign geometry, 3 chapter states, topology invalidation.');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  await dump('http://127.0.0.1:'+server.address().port+'/',path.join(temp,'http-profile'));
  console.log('PASS HTTP campaign geometry, 3 chapter states, topology invalidation.');
}finally{
  server.close();
  // Delete only the exact mkdtemp result, verified to be inside the OS temp root.
  const target=path.resolve(temp);
  if(path.dirname(target)===path.resolve(os.tmpdir())&&path.basename(target).startsWith('penjaga-campaign-browser-')){
    fs.rmSync(target,{recursive:true,force:true,maxRetries:8,retryDelay:150});
  }
}
