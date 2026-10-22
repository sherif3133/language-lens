const puppeteer = require('puppeteer');
const B = 'http://127.0.0.1:9410', OUT = process.argv[2];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
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
  await p.waitForSelector('pierce/.sg-res', { timeout: 60000 }); await p.keyboard.press('Enter'); await sleep(3000); await p.screenshot({ path: OUT + '/dbg-after1.png' }); console.log('after1', JSON.stringify(await p.evaluate(() => { const g = window.SawaGame.scene().game; const t = g.textures.get('tiles3'); return { lost: g.renderer.contextLost, glt: !!(t.source[0].glTexture), worldActive: g.scene.getScene('World').sys.isActive(), battle: g.scene.getScene('Battle').sys.settings.status, cam: g.scene.getScene('World').cameras.main.flashEffect.isRunning }; })));
  await p.evaluate(() => { const s = window.SawaGame.scene(); const m = s.monsters.find(x => x.active); s.cool = 0; s.pl.setPosition(m.x - 4, m.y); });
  await p.waitForSelector('pierce/.sg-battle.on .sg-ops', { timeout: 60000 }); await sleep(1200);
  const info = await p.evaluate(() => { const g = window.SawaGame.scene().game, b = g.scene.getScene('Battle'), c = b.cameras.main, h = b.children.list[2]; return { cam: { alpha: c.alpha, zoom: c.zoom, x: c.x, y: c.y, w: c.width, h: c.height, sx: c.scrollX, sy: c.scrollY, fade: c.fadeEffect.isRunning, fadeA: c.fadeEffect.alpha, fadeComplete: c.fadeEffect.isComplete, flash: c.flashEffect.isRunning, cams: b.cameras.cameras.length }, hero: { will: h.willRender(c), frame: h.frame.name, tex: h.texture.key, srcW: h.texture.source[0].width, cut: [h.frame.cutX, h.frame.cutWidth], tint: h.tintFill, scroll: h.scrollFactorX } }; });
  console.log(JSON.stringify(info, null, 1));
  await p.screenshot({ path: OUT + '/dbg-battle.png' });
  console.log('renderer', await p.evaluate(() => window.SawaGame.scene().game.renderer.type)); console.log(await p.evaluate(() => { const b = window.SawaGame.scene().game.scene.getScene('Battle'); b.children.list[0].setVisible(false); b.children.list[1].setVisible(false); return b.sys.displayList.length + ' ' + (b.sys.displayList === b.children); }));
  await new Promise(r => setTimeout(r, 400)); await p.screenshot({ path: OUT + '/dbg-battle2.png' });
  console.log('errors', errs);
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
