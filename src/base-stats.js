/* Pure rank-derived values. Temporary effects and skill behaviour live elsewhere. */
((M)=>{
  'use strict';
  const ids=['blade','rhythm','wind','counter','bastion','oath'];
  const parts=r=>({a:Math.min(r,10),b:Math.min(Math.max(r-10,0),10),c:Math.min(Math.max(r-20,0),5)});
  const milestone=r=>Math.min(2,Math.floor(r/5));
  function resolve(ranks){
    if(!ranks||ids.some(id=>!Number.isInteger(ranks[id])||ranks[id]<0||ranks[id]>25))
      throw new RangeError('Base stats require all six ranks from 0 to 25.');
    const p=Object.fromEntries(ids.map(id=>[id,parts(ranks[id])]));
    const blade=p.blade,oath=p.oath,bastion=p.bastion,counter=p.counter,rhythm=p.rhythm;
    const legacyWind=Math.min(10,ranks.wind);
    return Object.freeze({
      primaryDamage:27+5*blade.a+2*blade.b+blade.c,
      secondaryDamage:Math.round(18+3*blade.a+blade.b+.5*blade.c),
      heroMaxHp:100+15*oath.a+8*oath.b+4*oath.c,
      castleMaxHp:500+80*bastion.a+40*bastion.b+20*bastion.c,
      attackCooldown:Math.max(.30,M.config.HERO_ATTACK.cooldown*
        (1-.06*Math.min(ranks.rhythm,5)-.03*Math.min(Math.max(ranks.rhythm-5,0),5))-.0014*rhythm.b-.001*rhythm.c),
      swingCap:M.config.SWING.cap+milestone(ranks.blade),
      swingMoveScale:M.config.HERO_ATTACK.moveScale+.1*milestone(ranks.rhythm),
      heroDamageReduction:Math.min(.35,.02*bastion.a+.01*bastion.b+.01*bastion.c),
      castleDamageReduction:Math.min(.50,.04*bastion.a+.005*(bastion.b+bastion.c)),
      fortressRadius:Math.min(360,160+20*bastion.a),
      counterBonus:12+6*counter.a+2*counter.b+counter.c+8*milestone(ranks.counter),
      counterWindow:Math.min(4,2+.2*ranks.counter),
      foodHealing:45+5*oath.a+2*oath.b+oath.c,
      foodCooldown:Math.max(1.2,1.8-.3*milestone(ranks.oath)),
      monkHealing:16+2*oath.a+.5*oath.b+.2*oath.c,
      legacyDashCooldown:Math.max(.75,2.4-.25*Math.min(legacyWind,5)-.08*Math.max(legacyWind-5,0)),
      legacyDashImmunity:Math.min(.20,.16+.02*milestone(legacyWind))
    });
  }
  M.BaseStats=Object.freeze({resolve});
})(window.PenjagaModules=window.PenjagaModules||{});
