/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installAudio = function ({audio, host, config, math, session}) {
    audio.initAudio = function initAudio() {
      if(!audio.audio){
        const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
        audio.audio=new A();audio.audioMaster=audio.audio.createGain();audio.audioMaster.gain.value=audio.soundOn?.8:0;
        audio.effectsBus=audio.audio.createGain();audio.effectsBus.gain.value=audio.effectsVolume;audio.musicBus=audio.audio.createGain();audio.musicBus.gain.value=audio.musicVolume;
        const limiter=audio.audio.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=5;limiter.attack.value=.003;limiter.release.value=.15;
        audio.effectsBus.connect(audio.audioMaster);audio.musicBus.connect(audio.audioMaster);audio.audioMaster.connect(limiter);limiter.connect(audio.audio.destination);
      }
      if(audio.audio.state==='suspended')audio.audio.resume().catch(()=>{});
      if(!audio.audioLoading){
        host.$('audioStatus').textContent='Memuat efek suara…';
        audio.audioLoading=Promise.all(Object.entries(window.TINY_AUDIO||{}).map(async([name,data])=>{
          try{const raw=atob(data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);audio.sampleBuffers.set(name,await audio.audio.decodeAudioData(bytes.buffer));}catch{audio.audioFailures++;}
        })).then(()=>{host.$('audioStatus').textContent=audio.sampleBuffers.size?`${audio.sampleBuffers.size} efek suara siap · dapat dimainkan offline.`:'Efek cadangan aktif.';});
      }
    };

    audio.trackVoice = function trackVoice(source,gain,panner,priority){
      const voice={source,priority,finish:null};let finished=false;audio.activeVoices++;
      voice.finish=()=>{if(finished)return;finished=true;audio.activeVoices--;audio.soundVoices.delete(voice);source.disconnect();gain.disconnect();panner?.disconnect();};
      source.onended=voice.finish;audio.soundVoices.add(voice);return voice;
    };

    audio.playSample = function playSample(names,point=session.hero,volume=.5,rate=1,priority=1){
      if(!audio.soundOn||!audio.audio||!names.length)return false;
      const name=names[audio.sampleSerial++%names.length],buffer=audio.sampleBuffers.get(name);if(!buffer)return false;
      if(audio.activeVoices>=12){let victim=null;for(const v of audio.soundVoices)if(v.priority<priority&&(!victim||v.priority<victim.priority))victim=v;if(!victim)return false;victim.source.stop();victim.finish();}
      const source=audio.audio.createBufferSource(),gain=audio.audio.createGain();source.buffer=buffer;source.playbackRate.value=rate;
      const distance=math.dist(point,session.hero);gain.gain.value=volume*math.clamp(1-distance/850,.15,1);
      source.connect(gain);let panner=null;
      if(audio.audio.createStereoPanner){panner=audio.audio.createStereoPanner();panner.pan.value=math.clamp((point.x-session.hero.x)/440,-.8,.8);gain.connect(panner);panner.connect(audio.effectsBus);}else gain.connect(audio.effectsBus);
      audio.trackVoice(source,gain,panner,priority);source.start();return true;
    };

    audio.updateAudioVolumes = function updateAudioVolumes(){
      host.$('effectsVolume').value=Math.round(audio.effectsVolume*100);host.$('effectsVolumeValue').textContent=`${Math.round(audio.effectsVolume*100)}%`;
      host.$('musicVolume').value=Math.round(audio.musicVolume*100);host.$('musicVolumeValue').textContent=`${Math.round(audio.musicVolume*100)}%`;
      if(audio.audio){audio.effectsBus.gain.setTargetAtTime(audio.effectsVolume,audio.audio.currentTime,.02);audio.musicBus.gain.setTargetAtTime(audio.musicVolume,audio.audio.currentTime,.02);}
      try{localStorage.setItem('penjaga-audio',JSON.stringify({effects:audio.effectsVolume,music:audio.musicVolume}));}catch{}
    };

    audio.combatCue = function combatCue(type,point=session.hero){
      if(session.elapsed-(audio.lastCombatCue.get(type)??-99)<.06)return;
      audio.lastCombatCue.set(type,session.elapsed);
      if(audio.playSample(config.combatSamples[type]||[],point,['slam','charge','volley'].includes(type)?.65:.42,type==='bow'?1.7:1,['slam','charge','volley','dodge'].includes(type)?3:1))return;
      const s=config.combatSounds[type];if(s)audio.tone(s[0],s[3],s[2],.025,s[1]);
    };

    audio.tone = function tone(freq, duration = .1, type = 'sine', volume = .035, endFreq = freq,bus='fx') {
      if (!audio.soundOn || !audio.audio || audio.activeVoices>=12) return;
      const o = audio.audio.createOscillator(), g = audio.audio.createGain(); o.type = type; o.frequency.setValueAtTime(freq, audio.audio.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), audio.audio.currentTime + duration);
      g.gain.setValueAtTime(volume, audio.audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.audio.currentTime + duration);
      o.connect(g);g.connect(bus==='music'?audio.musicBus:audio.effectsBus);audio.trackVoice(o,g,null,bus==='music'?0:1);o.start();o.stop(audio.audio.currentTime+duration);
    };

    audio.soundOn = false;

    audio.audio = undefined;

    audio.melodyTimer = 0;

    audio.sampleBuffers = new Map();

    audio.soundVoices = new Set();

    audio.audioLoading = null;

    audio.audioMaster = undefined;

    audio.effectsBus = undefined;

    audio.musicBus = undefined;

    audio.audioFailures = 0;

    audio.sampleSerial = 0;

    audio.effectsVolume = .75;

    audio.musicVolume = .25;

    audio.lastCombatCue = new Map();

    audio.activeVoices = 0;

    try{const saved=JSON.parse(localStorage.getItem('penjaga-audio')||'{}');if(Number.isFinite(saved.effects))audio.effectsVolume=math.clamp(saved.effects,0,1);if(Number.isFinite(saved.music))audio.musicVolume=math.clamp(saved.music,0,1);}catch{}
    audio.updateMusic = function (dt) {
      if (audio.soundOn && (audio.melodyTimer -= dt) <= 0) { audio.melodyTimer = 2.6; audio.tone([262, 294, 330, 392, 440][Math.floor(session.elapsed / 2.6) % 5], 1.1, 'sine', .025,undefined,'music'); }
    };
  };
})(window.PenjagaModules = window.PenjagaModules || {});
