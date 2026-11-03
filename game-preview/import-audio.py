"""Keep only the sound effects used by the game; embed for direct file:// play."""
from pathlib import Path
import base64, json, zipfile, hashlib, sys, urllib.request

root=Path(__file__).resolve().parent.parent
target=root/'Audio'
target.mkdir(exist_ok=True)
packs={
 'rpg':('rpg-audio-source.zip','https://kenney.nl/assets/rpg-audio',[
  'knifeSlice.ogg','knifeSlice2.ogg','chop.ogg','cloth1.ogg','cloth2.ogg',
  'drawKnife1.ogg','handleCoins.ogg','metalClick.ogg']),
 'impact':('impact-audio-source.zip','https://kenney.nl/assets/impact-sounds',[
  'impactMetal_light_000.ogg','impactMetal_light_001.ogg','impactMetal_heavy_000.ogg',
  'impactSoft_medium_000.ogg','impactSoft_heavy_000.ogg','impactWood_heavy_000.ogg',
  'impactWood_light_000.ogg','footstep_grass_000.ogg','footstep_grass_001.ogg'])
}
embedded={};sources=[]
for key,(archive,url,names) in packs.items():
 archive_path=root/'game-preview'/archive
 if not archive_path.exists():
  if '--download' not in sys.argv:
   raise SystemExit('Source archive missing; run with --download to fetch it from Kenney.')
  asset_path='assets/'+('rpg-audio' if key=='rpg' else 'impact-sounds')
  req=urllib.request.Request('https://kenney.nl/download-link/'+asset_path.encode().hex(),headers={'Accept':'application/json','Referer':url})
  with urllib.request.urlopen(req,timeout=30) as response: download=json.load(response)['url']
  with urllib.request.urlopen(download,timeout=30) as response: archive_path.write_bytes(response.read())
 with zipfile.ZipFile(archive_path) as z:
  for name in names:
   data=z.read('Audio/'+name)
   assert data.startswith(b'OggS'),name
   (target/name).write_bytes(data)
   embedded[name]=base64.b64encode(data).decode('ascii')
   sources.append({'file':name,'source':url,'sha256':hashlib.sha256(data).hexdigest()})
  (target/(key+'-License.txt')).write_bytes(z.read('License.txt'))
(target/'sources.json').write_text(json.dumps(sources,indent=2)+'\n',encoding='utf8')
(root/'audio-pack.js').write_text('// Local audio payload for offline and file:// playback. Sources: Audio/sources.json\nwindow.TINY_AUDIO = '+json.dumps(embedded,separators=(',',':'))+';\n',encoding='utf8')
print(f'{len(embedded)} local effects; embedded payload {(root/"audio-pack.js").stat().st_size:,} bytes')
