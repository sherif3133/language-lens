const puppeteer = require('puppeteer');
const B = 'http://127.0.0.1:9410', OUT = process.argv[2];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio'] });
  const p = await br.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.setCookie({ name: 'as_user', value: '3', url: B });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('sawaWorldTour', '1'); } catch (e) {} });
  await p.goto(B + '/app/?g=' + Date.now() + '#community', { waitUntil: 'networkidle2', timeout: 120000 });
  const e = await p.waitForSelector('pierce/[data-act="w-open"]', { timeout: 60000 }); await e.evaluate(x => x.click());
  await p.waitForFunction(() => window.SawaGame && window.SawaGame.scene() && window.SawaGame.scene().pl, { timeout: 120000 });
  await sleep(1500);
  await p.evaluate(() => { const s = window.SawaGame.scene(); const m = s.monsters.find(x => x.active); s.cool = 0; s.pl.setPosition(m.x - 4, m.y); });
  await p.waitForSelector('pierce/.sg-battle.on .sg-ops', { timeout: 60000 }); await sleep(1200);
  for (let i = 0; i < 5; i++) { await p.waitForSelector('pierce/.sg-ops button:not([disabled])', { timeout: 60000 }); await p.keyboard.press('1'); await sleep(2600); }
  await p.waitForSelector('pierce/.sg-res', { timeout: 60000 }); await p.keyboard.press('Enter'); await sleep(3000); console.log('CTX', JSON.stringify(await p.evaluate(() => { const g = window.SawaGame.scene().game; return { type: g.renderer.type, lost: g.renderer.contextLost, connected: g.canvas.isConnected, size: [g.canvas.width, g.canvas.height], hidden: (() => { let e = g.canvas; while (e) { if (e.hidden) return 'hidden:' + (e.id || e.className); e = e.parentNode || e.host; } return false; })(), loop: g.loop.running, frame: g.loop.frame }; }))); console.log('CHK', JSON.stringify(await p.evaluate(() => { const g = window.SawaGame.scene().game; const out = {}; ['tiles3', 'light', 'dot', 'bbg3'].concat(g.textures.getTextureKeys().filter(k => /^ch_|^mo_/.test(k)).slice(0, 3)).forEach(k => { const t = g.textures.get(k); const im = t && t.source[0] && t.source[0].image; out[k] = im ? [im.width, im.height, im.constructor.name] : null; }); out.count = g.textures.getTextureKeys().length; return out; })));
  await p.evaluate(() => { const s = window.SawaGame.scene(); const m = s.monsters.find(x => x.active); s.cool = 0; s.pl.setPosition(m.x - 4, m.y); });
  await p.waitForSelector('pierce/.sg-battle.on .sg-ops', { timeout: 60000 }); await sleep(1200);
  const info = await p.evaluate(() => { const g = window.SawaGame.scene().game, b = g.scene.getScene('Battle'), c = b.cameras.main, h = b.children.list[2]; return { cam: { alpha: c.alpha, zoom: c.zoom, x: c.x, y: c.y, w: c.width, h: c.height, sx: c.scrollX, sy: c.scrollY, fade: c.fadeEffect.isRunning, fadeA: c.fadeEffect.alpha, fadeComplete: c.fadeEffect.isComplete, flash: c.flashEffect.isRunning, cams: b.cameras.cameras.length }, hero: { will: h.willRender(c), frame: h.frame.name, tex: h.texture.key, srcW: h.texture.source[0].width, cut: [h.frame.cutX, h.frame.cutWidth], tint: h.tintFill, scroll: h.scrollFactorX } }; });
  console.log(JSON.stringify(info, null, 1));
  await p.screenshot({ path: OUT + '/dbg-battle.png' });
  console.log(await p.evaluate(() => { const b = window.SawaGame.scene().game.scene.getScene('Battle'); b.children.list[0].setVisible(false); b.children.list[1].setVisible(false); return b.sys.displayList.length + ' ' + (b.sys.displayList === b.children); }));
  await new Promise(r => setTimeout(r, 400)); await p.screenshot({ path: OUT + '/dbg-battle2.png' });
  console.log('errors', errs);
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
