/* Separate mine panel. Campaign owns when opening it is allowed and pauses time. */
((M)=>{
  'use strict';
  const messages={'chapter-locked':'Masuki bab berikutnya dahulu.','boss-locked':'Kemenangan boss bab sebelumnya belum tercatat.','insufficient-gold':'Emas belum cukup.','purchase-closed':'Peningkatan tersedia saat persiapan atau tinjauan bab.',
    'max-level':'Operasi tambang sudah lengkap.','no-chapter':'Kampanye belum dimulai.','dead':'Operasi terhenti.'};
  M.installMinePanel=function({mount,mines,onOpen=()=>true,onClose=()=>{},onPurchase=()=>{}}){
    const button=document.createElement('button');button.type='button';button.className='mine-panel-toggle';button.textContent='Tambang · M';
    const dialog=document.createElement('dialog');dialog.className='mine-panel';dialog.setAttribute('aria-label','Operasi tambang');
    dialog.innerHTML=`<form method="dialog"><button class="mine-close" aria-label="Tutup panel tambang">×</button></form>
      <p class="mine-eyebrow">SATU OPERASI · SELURUH KAMPANYE</p><h2 data-mine-field="name"></h2>
      <p class="mine-profile" data-mine-field="profile"></p>
      <dl><div><dt>Emas tersedia</dt><dd data-mine-field="gold"></dd></div>
      <div><dt>Hasil per aksi</dt><dd data-mine-field="yield"></dd></div>
      <div><dt>Kuota operasi bab ini</dt><dd data-mine-field="quota"></dd></div>
      <div><dt>Produksi tambahan</dt><dd data-mine-field="production"></dd></div>
      <div><dt>Tick produksi bab ini</dt><dd data-mine-field="ticks"></dd></div></dl>
      <p class="mine-node-label">Sisa aksi per node aktif</p><ul data-mine-field="nodes"></ul>
      <div class="mine-next"><strong data-mine-field="next"></strong><p data-mine-field="requirement"></p>
      <button type="button" data-mine-buy></button></div>
      <p class="mine-feedback" data-mine-field="feedback" role="status"></p>
      <p class="mine-note">Tahan E dekat batu emas untuk mining. Semua node berbagi satu operasi. Waktu panel berhenti; tambang tidak menghasilkan emas saat menu, pause atau aplikasi ditutup.</p>`;
    mount.append(button);document.body.append(dialog);
    const field=id=>dialog.querySelector('[data-mine-field="'+id+'"]'),buy=dialog.querySelector('[data-mine-buy]');
    let signature;
    function update(){
      const v=mines.status(),nodes=mines.nodes().map(n=>({id:n.id,...mines.status(n.id)})).filter(n=>n.nodeActive);
      const nextSignature=JSON.stringify([dialog.open,v.stageId,v.gold,v.yield,v.profileId,v.manualOverride,v.remaining,v.production,v.passiveTicks,v.next,nodes.map(n=>[n.id,n.nodeRemaining])]);
      if(signature===nextSignature)return;signature=nextSignature;
      field('name').textContent=v.name;field('gold').textContent=v.gold+' emas';
      field('profile').textContent=v.profileId==='standard'?'PROFIL STANDAR · ekonomi 25 / 35 / 45':`PROFIL TESTING PENGGUNA · override ${v.manualOverride} emas / aksi`;
      field('profile').dataset.profile=v.profileId;
      field('yield').textContent=v.yield+' emas';field('quota').textContent=v.remaining+' / '+v.quota+' aksi tersisa';
      field('production').textContent='+'+v.production+' emas / '+v.period+' detik aktif';field('ticks').textContent=v.passiveTicks+' / '+v.tickLimit;
      field('nodes').replaceChildren(...nodes.map(n=>{const item=document.createElement('li');item.textContent=n.id+' · '+n.nodeRemaining+' aksi';return item;}));
      field('next').textContent=v.next?'Berikutnya: '+v.next.name:'Rumah tambang lengkap';
      field('requirement').textContent=v.next?`Biaya ${v.next.cost} emas · selesaikan Bab ${v.next.requiredChapterId.at(-1)-1}, masuk Bab ${v.next.requiredChapterId.at(-1)} · tahap sebelumnya harus dimiliki.`:'Seluruh peningkatan operasi telah dibeli.';
      buy.hidden=!v.next;buy.disabled=!v.next?.allowed;buy.textContent=v.next?'Bangun · '+v.next.cost+' emas':'Lengkap';
      buy.title=!v.next?'Lengkap':!v.next.chapterUnlocked?'Masuki bab berikutnya dahulu.':!v.next.bossUnlocked?'Kemenangan boss sebelumnya belum tercatat.':v.gold<v.next.cost?'Emas belum cukup.':'Peningkatan dibeli saat persiapan atau tinjauan bab.';
      button.setAttribute('aria-expanded',String(dialog.open));
    }
    function open(){if(dialog.open||onOpen()===false)return false;field('feedback').textContent='';dialog.showModal();update();return true;}
    const onBuy=()=>{const result=mines.purchaseNextLevel();field('feedback').textContent=result.ok?`Bangunan siap · ${result.goldDelta} emas`:(messages[result.reason]||'Transaksi ditolak.');update();onPurchase(result);};
    const closed=()=>{onClose();update();};button.addEventListener('click',open);buy.addEventListener('click',onBuy);dialog.addEventListener('close',closed);
    update();return {button,dialog,open,close:()=>dialog.close(),update,dispose(){button.removeEventListener('click',open);buy.removeEventListener('click',onBuy);dialog.removeEventListener('close',closed);button.remove();dialog.remove();}};
  };
})(window.PenjagaModules=window.PenjagaModules||{});
