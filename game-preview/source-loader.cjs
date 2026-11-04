// Test-only bridge for the existing lexical instrumentation. Production exposes snapshots only.
const fs = require('node:fs');
const bindings = require('./runtime-bindings.json');
exports.instrumentBootstrap = code => {
  if (!code.includes('M.createRuntime()')) return code;
  const accessors = Object.entries(bindings).map(([name, target]) =>
    JSON.stringify(name) + ': {configurable:true, get:()=>runtime.' + target + ', set:value=>{runtime.' + target + '=value;}}'
  ).join(',\n');
  return code.replace('const runtime = M.createRuntime();',
    'const runtime = M.createRuntime();\nwindow.__testRuntime = runtime;\nObject.defineProperties(globalThis, {' + accessors + '});')
    .replace('runtime.renderer.resize(); runtime.assets.preload(); requestAnimationFrame(runtime.simulation.frame);',
      'resize(); preload(); requestAnimationFrame(frame);');
};
exports.loadGameSource = (code = fs.readFileSync('game.js', 'utf8')) => {
  if (!code.includes('M.createRuntime()')) return code;
  const scripts = [...fs.readFileSync('index.html', 'utf8').matchAll(/<script src="([^"]+)" defer>/g)]
    .map(match => match[1]).filter(file => file.startsWith('src/') || file.startsWith('maps/'));
  return scripts.map(file => fs.readFileSync(file, 'utf8')).join('\n;\n') + '\n;\n' + exports.instrumentBootstrap(code);
};
