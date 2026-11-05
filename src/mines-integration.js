/* Optional hooks, not a campaign controller. Caller installs these once. */
((M)=>{
  'use strict';
  M.createMineHooks=function({mines,visual,onHarvest=()=>{}}){
    const idOf=node=>node?.mineId||node?.sourceId||node?.id||mines.nodes().find(n=>n.x===node?.x&&n.y===node?.y)?.id;
    return Object.freeze({
      resource(node){
        const mineId=idOf(node),v=mines.status(mineId);
        return v?.nodeActive&&v.nodeRemaining>0?{...node,mineId,type:'gold',name:`Tambang +${v.yield} emas · ${v.nodeRemaining} aksi`,duration:M.MineParameters.harvestSeconds}:null;
      },
      harvest(node){const raw=mines.interact(idOf(node)),result=typeof raw==='boolean'?(mines.lastReceipt?.()||{ok:raw,goldDelta:0}):raw;onHarvest(result,node);return result;},
      drawScenery(item,ctx,camera,hero){if(item.type!=='gold'||idOf(item.source)!==M.MineVisual.primaryId)return false;visual.draw(ctx,camera,hero);return true;},
      // MapPreviewRenderer's source-identity hook preserves its depth sorting.
      installPreview(renderer){
        const original=renderer.paintObject;
        renderer.paintObject=function(ctx,camera,object,time,hero){
          return object.sourceId===M.MineVisual.primaryId?visual.draw(ctx,camera,hero):original.call(this,ctx,camera,object,time,hero);
        };
        return ()=>{renderer.paintObject=original;};
      }
    });
  };
})(window.PenjagaModules=window.PenjagaModules||{});
