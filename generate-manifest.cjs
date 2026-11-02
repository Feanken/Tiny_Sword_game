// Rebuild the gallery index after adding original PNG assets.
const fs = require('node:fs');
const path = require('node:path');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.png')) {
      const bytes = fs.readFileSync(file);
      files.push({ path: file.split(path.sep).join('/'), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
    }
  }
}
for (const dir of ['Buildings', 'Particle FX', 'Terrain', 'UI Elements', 'Units']) walk(dir);
fs.writeFileSync('asset-manifest.js', '// Original Tiny Swords asset index.\nwindow.TINY_ASSETS = ' + JSON.stringify(files, null, 2) + ';\n');
console.log(`${files.length} assets / ${new Set(files.map(f => path.dirname(f.path))).size} folders`);
