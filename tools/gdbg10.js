const puppeteer = require('puppeteer');
const B = 'http://127.0.0.1:9410';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await br.newPage(); p.on('console', m => console.log('console:', m.text().slice(0, 160)));
  await p.setViewport({ width: 390, height: 844 });
  await p.setCookie({ name: 'as_user', value: '3', url: B });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('sawaWorldTour', '1'); } catch (e) {} });
  await p.goto(B + '/app/?g=' + Date.now() + '#community', { waitUntil: 'networkidle2', timeout: 120000 });
  const e = await p.waitForSelector('pierce/[data-act="w-open"]', { timeout: 60000 }); await e.evaluate(x => x.click());
  await p.waitForFunction(() => window.SawaGame && window.SawaGame.scene() && window.SawaGame.scene().pl, { timeout: 120000 });
  await sleep(1500);
  const lost = () => p.evaluate(() => window.SawaGame.scene().game.renderer.contextLost);
  console.log('start lost', await lost());
  await p.evaluate(() => { const w = window.SawaGame.scene(); w.game.canvas.addEventListener('webglcontextlost', () => console.log('CONTEXT LOST at ' + (window.__step || '?'))); });
  console.log(await p.evaluate(() => { const out = []; const P = window.Phaser; function scan(obj, name, depth) { if (!obj || depth > 3) return; for (const k of Object.getOwnPropertyNames(obj)) { let v; try { v = obj[k]; } catch (e) { continue; } if (typeof v === 'function') { const src = Function.prototype.toString.call(v); if (src.includes('loseContext')) out.push(name + '.' + k); if (v.prototype && depth < 3) for (const pk of Object.getOwnPropertyNames(v.prototype)) { let f; try { f = v.prototype[pk]; } catch (e) { continue; } if (typeof f === 'function' && Function.prototype.toString.call(f).includes('loseContext')) out.push(name + '.' + k + '.prototype.' + pk); } } else if (v && typeof v === 'object' && depth < 3) scan(v, name + '.' + k, depth + 1); } } scan(P, 'Phaser', 0); return out.join(' | '); }));
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
