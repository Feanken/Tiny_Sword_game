/* Mine art uses existing Tiny Swords sprites and a fixed reserved collision plot. */
((M)=>{
  'use strict';
  const primaryId='gold-01',plotRadius=36;
  const paths=['Terrain/Resources/Gold/Gold Stones/Gold Stone 1.png','Buildings/Blue Buildings/House1.png',
    'Buildings/Blue Buildings/House2.png','Terrain/Resources/Gold/Gold Resource/Gold_Resource.png','Terrain/Resources/Tools/Tool_02.png'];
  M.prepareMineMap=function(definition){
    const map=JSON.parse(JSON.stringify(definition)),index=map.objectIds?.goldNodes?.indexOf(primaryId);
    if(index===undefined||index<0)throw new Error('Mine plot requires source gold-01.');
    map.goldNodes[index].radius=plotRadius;
    const obstacle=map.obstacles?.find(o=>o.sourceId===primaryId);
    if(!obstacle)throw new Error('Mine plot requires matching source collider.');
    obstacle.radius=plotRadius;
    return map;
  };
  M.MineVisual=class {
    static primaryId=primaryId;
    static plotRadius=plotRadius;
    static assetPaths(){return [...paths];}
    constructor({world,mines,image}){Object.assign(this,{world,mines,image});}
    draw(ctx,camera,hero){
      const site=this.mines.nodes().find(n=>n.id===primaryId);
      if(!site||!this.world.isObjectActive(primaryId)||!camera.intersects(site.x-80,site.y-140,160,200))return false;
      const view=this.mines.status(primaryId),i=view.level;
      const sprite=(path,width,x=site.x,y=site.y+14)=>{
        const image=this.image(path);if(!image)return;
        const height=width*image.height/image.width;
        ctx.drawImage(image,Math.round(x-width/2),Math.round(y-height),width,height);
      };
      ctx.save();ctx.imageSmoothingEnabled=false;
      ctx.beginPath();ctx.ellipse(site.x,site.y,38,24,0,0,Math.PI*2);ctx.fillStyle='#846f45';ctx.fill();
      ctx.strokeStyle='#594b32';ctx.lineWidth=2;ctx.stroke();
      // Posts mark the reserved plot in all stages; upgrades never push actors aside.
      for(const sign of [-1,1]){ctx.fillStyle='#55472b';ctx.fillRect(site.x+sign*31-2,site.y-4,4,14);ctx.fillStyle='#c3a76c';ctx.fillRect(site.x+sign*31-1,site.y-7,2,13);}
      if(hero&&hero.x>site.x-47&&hero.x<site.x+47&&hero.y>site.y-120&&hero.y<site.y-15)ctx.globalAlpha=.45;
      if(i===0){
        const ore=this.image(paths[0]);
        // Original ore sheets have wide transparent gutters; display the nugget.
        if(ore)ctx.drawImage(ore,40,40,48,48,Math.round(site.x-28),Math.round(site.y-42),56,56);
      }else sprite(paths[i],i===1?66:92);
      if(i){sprite(paths[3],23,site.x-22,site.y+16);sprite(paths[4],25,site.x+22,site.y+10);}
      ctx.globalAlpha=1;
      ctx.fillStyle='#17352de8';ctx.fillRect(site.x-45,site.y+24,90,18);
      ctx.font='bold 9px Segoe UI';ctx.textAlign='center';ctx.fillStyle='#f3d990';
      ctx.fillText(['BATU EMAS','POS TAMBANG','RUMAH TAMBANG'][i],site.x,site.y+36);
      ctx.restore();return true;
    }
  };
})(window.PenjagaModules=window.PenjagaModules||{});
