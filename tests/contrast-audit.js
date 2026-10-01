/* Contrast audit: measures computed text/background colour of every visible text node on each view, light and dark, against WCAG AA (4.5:1, or 3:1 for large text).
   Run with the app being served locally, e.g.:
     python3 -m http.server 8765 &            # from the repo root
     npm i -D playwright && npx playwright install chromium   # once
     node tests/contrast-audit.js                        # APP_URL=http://host:port/index.html to override
   Not loaded by the app — these are developer checks only. */
const { chromium } = require('playwright');
const BASE = process.env.APP_URL || 'http://localhost:8765/index.html';
(async () => {
  const browser = await chromium.launch();
  let totalFail = 0, totalChecked = 0;
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.route(/gstatic\.com/, r => r.abort());
    await page.addInitScript(() => { try { localStorage.setItem('arabicAcademyVoiceSetupSeen', '1');
      localStorage.setItem('arabicAcademyProgress', JSON.stringify({ xp: 135, streak: 6, lastChapterId: 3, selectedTrack: 'classical', gatingEnabled: true,
        chapters: { 1: { exercises: { 'c1-ex1': 100 }, speakingAttempts: 6, speakAttemptedIdx: [0,1,2,3,4,5] }, 3: { exercises: { 'c2-ex1': 50 }, speakingAttempts: 1, speakAttemptedIdx: [0] } } })); } catch (e) {} });
    await page.goto(BASE, { waitUntil: 'load' });
    const views = [
      ['dashboard (gated)', () => { progress.gatingEnabled = true; setAllUnits(true); }], ['index (gated)', () => showIndex()], ['dashboard (ungated)', () => { progress.gatingEnabled = false; setAllUnits(true); }], ['tracks', () => { progress.gatingEnabled = false; showTrackSelector(); }], ['voice', () => renderVoiceSetupScreen()],
      ['chapter-content', () => { openChapter(1); switchTab('content'); }], ['vocab', () => { openChapter(1); switchTab('vocab'); document.querySelectorAll('#panel-vocab .flip-toggle').forEach((b, i) => i < 2 && b.click()); }],
      ['exercises-checked', () => { openChapter(1); switchTab('exercises'); const ex = currentChapter.exercises;
         ex.filter(e => e.type === 'mcq').forEach(e => { e.items.forEach((it, i) => mcqPick(e.id, i, i === 0 ? (it.correct + 1) % it.options.length : it.correct)); scoreMCQ(e.id, e.items.length); });
         ex.filter(e => e.type === 'translate').forEach(e => { e.items.forEach((it, i) => document.getElementById(`${e.id}-in${i}`).value = i ? it.keywords[0] : 'zzz'); scoreTranslate(e.id, e.items.map(i => i.keywords)); });
         ex.filter(e => e.type === 'creative').forEach(e => submitCreative(e.id, 0));
         ex.filter(e => e.type === 'matching').forEach(e => { e.pairs.forEach((p, i) => { matchClick(e.id, 'left', i); matchClick(e.id, 'right', i); }); }); }],
      ['speaking', () => { openChapter(1); switchTab('speaking'); scoreAndShowResult('هذا كتاب'); }],
      ['test', () => startKnowledgeTest()],
    ];
    const bad = new Map();
    for (const [name, fn] of views) {
      await page.evaluate(fn); await page.waitForTimeout(120);
      const res = await page.evaluate(() => {
        const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[, /]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
        const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
        const bgOf = el => { const stack = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return { gradient: true, el: e }; const c = parse(cs.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; const cs = getComputedStyle(document.body); const bb = parse(cs.backgroundColor); if (bb) base = bb; for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base); return base; };
        const out = []; let checked = 0, gradients = 0;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        while (walker.nextNode()) {
          const n = walker.currentNode; if (!n.textContent.trim()) continue;
          const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
          const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
          if (cs.visibility === 'hidden' || cs.display === 'none' || r.width === 0 || r.height === 0 || parseFloat(cs.opacity) === 0) continue;
          if (el.closest('.skip-link, .sr-only, [aria-hidden=true]')) continue;
          if (el.closest('.flip-back') && !el.closest('.flipped')) continue;
          let opacity = 1; for (let e = el; e; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity);
          const fgRaw = parse(cs.color); const bg = bgOf(el);
          if (bg.gradient) { gradients++; continue; }
          const fg = blend({ ...fgRaw, a: fgRaw.a * opacity }, bg);
          const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700; const large = size >= 24 || (size >= 18.66 && bold);
          checked++;
          if (ratio < (large ? 3 : 4.5)) out.push({ t: n.textContent.trim().slice(0, 30), cls: el.className.toString().slice(0, 30) || el.tagName, ratio: +ratio.toFixed(2), size });
        }
        return { out, checked, gradients };
      });
      totalChecked += res.checked;
      res.out.forEach(o => { const k = `${o.cls}`; if (!bad.has(k)) bad.set(k, { ...o, views: [name] }); else bad.get(k).views.push(name); });
      console.log(`${scheme.padEnd(5)} ${name.padEnd(18)} checked ${String(res.checked).padStart(4)} text nodes (+${res.gradients} on gradients)  failures ${res.out.length}`);
    }
    for (const [k, v] of bad) { totalFail++; console.log(`   ✗ [${scheme}] .${k} "${v.t}" ratio ${v.ratio} (${v.size}px) in ${[...new Set(v.views)].join(', ')}`); }
    await ctx.close();
  }
  console.log(`\nTotal text nodes checked: ${totalChecked}; distinct failing classes: ${totalFail}`);
  await browser.close();
})();
