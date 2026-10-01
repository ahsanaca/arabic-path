/* UI checks: hash routing (Back/Forward/reload/deep links), keyboard + ARIA semantics, font loading, no horizontal overflow at 320–1280px in light/dark, 44px tap targets.
   Run with the app being served locally, e.g.:
     python3 -m http.server 8765 &            # from the repo root
     npm i -D playwright && npx playwright install chromium   # once
     node tests/ui-checks.js                        # APP_URL=http://host:port/index.html to override
   Not loaded by the app — these are developer checks only. */
const { chromium } = require('playwright');
const BASE = process.env.APP_URL || 'http://localhost:8765/index.html';
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); else console.log('  ✓', m); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async (vp = { width: 1100, height: 900 }, scheme = 'light') => {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, hasTouch: vp.width < 700 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/gstatic|Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.route(/gstatic\.com/, r => r.abort());
    await page.addInitScript(() => { try { localStorage.setItem('arabicAcademyVoiceSetupSeen', '1'); } catch (e) {} });
    return { ctx, page };
  };

  // ---------- routing ----------
  console.log('Routing');
  {
    const { ctx, page } = await mk();
    await page.goto(BASE, { waitUntil: 'load' });
    ok(await page.evaluate(() => currentView) === 'dashboard', 'loads on dashboard with empty hash');
    await page.evaluate(() => showIndex());
    ok(page.url().endsWith('#/index'), 'showIndex() sets #/index');
    await page.evaluate(() => openChapter(1));
    ok(/#\/chapter\/1(\/content)?$/.test(page.url()), 'openChapter(1) sets #/chapter/1[/content]');
    await page.evaluate(() => switchTab('exercises', true));
    ok(page.url().endsWith('#/chapter/1/exercises'), 'switching tab updates hash (#/chapter/1/exercises)');
    await page.goBack();
    await page.waitForTimeout(100);
    ok(await page.evaluate(() => currentView) === 'index', 'Back from a chapter returns to the index (tab switches did not pollute history)');
    await page.goForward();
    await page.waitForTimeout(100);
    ok(await page.evaluate(() => currentView + ':' + currentChapter.id) === 'chapter:1', 'Forward returns to the chapter');
    await page.reload({ waitUntil: 'load' });
    const st = await page.evaluate(() => ({ v: currentView, id: currentChapter && currentChapter.id, tab: currentTab }));
    ok(st.v === 'chapter' && st.id === 1 && st.tab === 'exercises', 'reload restores chapter + tab: ' + JSON.stringify(st));
    await page.goto(BASE + '#/chapter/28/vocab', { waitUntil: 'load' });
    await page.evaluate(() => 0);
    const deep = await page.evaluate(() => ({ v: currentView, id: currentChapter && currentChapter.id, tab: currentTab }));
    ok(deep.v === 'chapter' && deep.id === 28 && deep.tab === 'vocab', 'deep link #/chapter/28/vocab opens that chapter + tab: ' + JSON.stringify(deep));
    await page.goto(BASE + '#/chapter/9999', { waitUntil: 'load' });
    ok(await page.evaluate(() => currentView) === 'dashboard' && page.url().endsWith('#/'), 'unknown chapter id falls back to dashboard');
    const soonId = await page.evaluate(() => chapters.find(c => c.locked).id);
    await page.goto(BASE + '#/chapter/' + soonId, { waitUntil: 'load' });
    ok(await page.evaluate(() => currentView) === 'dashboard', 'locked ("coming soon") chapter id falls back to dashboard');
    // gating blocks deep links too
    await page.evaluate(() => { progress.chapters = {}; toggleGating(true); });
    await page.goto(BASE + '#/chapter/4', { waitUntil: 'load' });
    ok(await page.evaluate(() => currentView) === 'dashboard', 'gated chapter cannot be opened by URL');
    await page.evaluate(() => { toggleGating(false); });
    await page.goto(BASE + '#/test', { waitUntil: 'load' });
    ok(await page.evaluate(() => currentView) === 'test', '#/test renders the knowledge test');
    await page.goto(BASE + '#/tracks', { waitUntil: 'load' });
    ok(await page.evaluate(() => currentView) === 'trackSelect', '#/tracks renders tracks');
    ok(await page.evaluate(() => document.title) === 'Tracks — Arabic Academy', 'document.title follows the view');
    const rep = await page.evaluate(() => { openChapter(3); return document.getElementById('reportLink').href; });
    ok(/mailto:.*%20Chapter%202/.test(rep) || /Chapter%202/.test(decodeURIComponent(rep).replace(/ /g, '%20')), 'footer report link is pre-filled with the current chapter');
    await ctx.close();
  }

  // first-visit voice setup interstitial
  {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.route(/gstatic\.com/, r => r.abort());
    await page.goto(BASE, { waitUntil: 'load' });
    ok(await page.evaluate(() => currentView) === 'voiceSetup', 'first visit shows voice setup once');
    await page.evaluate(() => finishVoiceSetup(true));
    await page.reload({ waitUntil: 'load' });
    ok(await page.evaluate(() => currentView) === 'dashboard', 'after finishing it, next visit goes straight to dashboard');
    await ctx.close();
  }

  // ---------- a11y semantics + keyboard ----------
  console.log('Accessibility & keyboard');
  {
    const { ctx, page } = await mk();
    await page.goto(BASE + '#/chapter/1', { waitUntil: 'load' });
    await page.waitForTimeout(200);
    const sem = await page.evaluate(() => ({
      tabs: document.querySelectorAll('[role=tab]').length,
      selected: document.querySelectorAll('[role=tab][aria-selected=true]').length,
      panels: document.querySelectorAll('[role=tabpanel]').length,
      lang: document.querySelectorAll('.arabic:not([lang=ar])').length,
      arabicCount: document.querySelectorAll('.arabic').length,
      h1: document.querySelectorAll('h1').length,
      main: document.querySelectorAll('main').length,
      divClicks: [...document.querySelectorAll('[onclick]')].filter(e => !['BUTTON', 'A', 'SUMMARY', 'INPUT'].includes(e.tagName)).map(e => e.tagName + '.' + e.className).slice(0, 5),
      imgNoAlt: document.querySelectorAll('img:not([alt])').length,
      unlabeledButtons: [...document.querySelectorAll('button')].filter(b => !(b.textContent.trim() || b.getAttribute('aria-label'))).length,
    }));
    ok(sem.tabs === 4 && sem.selected === 1 && sem.panels === 4, `tablist semantics (tabs ${sem.tabs}, selected ${sem.selected}, panels ${sem.panels})`);
    ok(sem.arabicCount > 0 && sem.lang === 0, `every .arabic element has lang="ar" (${sem.arabicCount} found)`);
    ok(sem.h1 === 1 && sem.main === 1, `one <h1> and one <main> (h1=${sem.h1}, main=${sem.main})`);
    ok(sem.divClicks.length === 0, 'no click handlers on non-interactive elements: ' + JSON.stringify(sem.divClicks));
    ok(sem.unlabeledButtons === 0, `every button has an accessible name (${sem.unlabeledButtons} without)`);

    // arrow keys move between tabs
    await page.focus('#tab-content');
    await page.keyboard.press('ArrowRight');
    ok(await page.evaluate(() => currentTab) === 'vocab' && await page.evaluate(() => document.activeElement.id) === 'tab-vocab', 'ArrowRight moves to next tab and moves focus');
    await page.keyboard.press('End');
    ok(await page.evaluate(() => currentTab) === 'speaking', 'End jumps to last tab');
    await page.keyboard.press('Home');
    ok(await page.evaluate(() => currentTab) === 'content', 'Home jumps to first tab');

    // flip cards are keyboard operable and expose state
    await page.evaluate(() => switchTab('vocab', true));
    const first = page.locator('#panel-vocab .flip-toggle').first();
    await first.focus();
    await page.keyboard.press('Enter');
    let pressed = await first.getAttribute('aria-pressed');
    ok(pressed === 'true', 'Enter flips a card (aria-pressed=true)');
    await page.keyboard.press('Space');
    pressed = await first.getAttribute('aria-pressed');
    ok(pressed === 'false', 'Space flips it back');
    const hidden = await page.evaluate(() => { const c = document.querySelector('#panel-vocab .flip-card'); return [c.querySelector('.flip-front').getAttribute('aria-hidden'), c.querySelector('.flip-back').getAttribute('aria-hidden')]; });
    ok(JSON.stringify(hidden) === '["false","true"]', 'unflipped card hides only the back face from screen readers ' + JSON.stringify(hidden));

    // exercise options are real buttons, selectable by keyboard
    await page.evaluate(() => switchTab('exercises', true));
    const opt = page.locator('#panel-exercises .click-opt').first();
    await opt.focus(); await page.keyboard.press('Enter');
    ok(await opt.getAttribute('aria-pressed') === 'true', 'MCQ option selectable by keyboard (aria-pressed)');

    // sentence builder: tap a placed word to take it back out
    const res = await page.evaluate(() => {
      const ex = currentChapter.exercises.find(e => e.type === 'sentence');
      const slot = document.getElementById(`${ex.id}-slot0`);
      const chips = [...slot.parentElement.querySelectorAll('.word-chip')];
      chips[0].click(); chips[1].click();
      const afterAdd = slot.querySelectorAll('.placed').length;
      slot.querySelector('.placed').click();
      const afterRemove = slot.querySelectorAll('.placed').length;
      const used = slot.parentElement.querySelectorAll('.word-chip.used').length;
      slot.querySelector('.placed').click();
      return { afterAdd, afterRemove, used, placeholder: !!slot.querySelector('.placeholder') };
    });
    ok(res.afterAdd === 2 && res.afterRemove === 1 && res.used === 1 && res.placeholder, 'tapping a placed word returns it to the bank; placeholder returns when empty ' + JSON.stringify(res));

    await ctx.close();
    // skip link: first Tab stop on a fresh load, and it moves focus into <main>
    const fresh = await mk(); await fresh.page.goto(BASE, { waitUntil: 'load' });
    await fresh.page.keyboard.press('Tab');
    ok(await fresh.page.evaluate(() => document.activeElement.className) === 'skip-link', 'first Tab stop is the skip link');
    await fresh.page.keyboard.press('Enter');
    ok(await fresh.page.evaluate(() => document.activeElement.id) === 'pageRoot', 'activating the skip link focuses <main>');
    await fresh.ctx.close();
  }

  // ---------- fonts ----------
  console.log('Fonts');
  {
    const { ctx, page } = await mk();
    await page.goto(BASE + '#/chapter/1/vocab', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const f = await page.evaluate(async () => { await document.fonts.ready; return { amiri: document.fonts.check('700 32px Amiri', 'كتاب'), loaded: [...document.fonts].filter(x => x.status === 'loaded').map(x => x.family + ' ' + x.weight) }; });
    ok(f.amiri, 'bundled Amiri font loads and covers the Arabic text: ' + JSON.stringify(f.loaded));
    await ctx.close();
  }

  // ---------- overflow + tap targets on every view at several widths ----------
  console.log('Layout at multiple widths (no horizontal scroll) + tap targets');
  for (const w of [320, 360, 390, 768, 1280]) {
    for (const scheme of ['light', 'dark']) {
      const { ctx, page } = await mk({ width: w, height: 800 }, scheme);
      await page.goto(BASE, { waitUntil: 'load' });
      const views = [
        ['dashboard', () => { setAllUnits(true); }],
        ['index', () => showIndex()],
        ['tracks', () => showTrackSelector()],
        ['voice', () => renderVoiceSetupScreen()],
        ['test', () => startKnowledgeTest()],
        ['chapter-content (ch1)', () => { openChapter(1); switchTab('content'); }],
        ['chapter-vocab (alphabet)', () => { openChapter(0); switchTab('vocab'); }],
        ['chapter-exercises (ch13)', () => { openChapter(14); switchTab('exercises'); }],
        ['chapter-speaking', () => { openChapter(1); switchTab('speaking'); }],
        ['spoken chapter', () => { selectTrack('spoken'); openChapter(100); switchTab('content'); selectTrack('classical'); }],
      ];
      for (const [name, fn] of views) {
        await page.evaluate(fn);
        if (name === 'spoken chapter') await page.evaluate(() => openChapter(100));
        await page.waitForTimeout(80);
        const m = await page.evaluate(() => {
          const de = document.documentElement;
          const over = de.scrollWidth - de.clientWidth;
          const offenders = over > 0 ? [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > de.clientWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 4).map(e => e.tagName + '.' + e.className) : [];
          return { over, offenders };
        });
        if (m.over > 0) fails.push(`overflow ${m.over}px at ${w}px ${scheme} on "${name}": ${m.offenders.join(', ')}`);
      }
      // tap targets on the dashboard + a chapter (touch widths only)
      if (w <= 390 && scheme === 'light') {
        for (const [name, fn] of [['dashboard', () => { setAllUnits(true); }], ['index', () => showIndex()], ['tracks', () => showTrackSelector()], ['voice setup', () => renderVoiceSetupScreen()], ['test', () => startKnowledgeTest()], ['sign-in', () => renderLoginScreen('signin')], ['chapter', () => { openChapter(1); switchTab('vocab'); }], ['exercises', () => { openChapter(1); switchTab('exercises'); }], ['speaking', () => { openChapter(1); switchTab('speaking'); }]]) {
          await page.evaluate(fn); await page.waitForTimeout(80);
          const small = await page.evaluate(() => [...document.querySelectorAll('button, a[href], summary, input:not([type=hidden])')]
            .filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !(e.closest('.switch') && e.tagName === 'INPUT') && (r.height < 43.5 || r.width < 43.5) && !e.classList.contains('skip-link'); })
            .map(e => `${e.tagName}.${e.className.toString().split(' ')[0]}(${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}) "${(e.textContent || '').trim().slice(0, 18)}"`));
          // footer links are inline text links; report only non-link controls
          const bad = small.filter(s => !/^A\./.test(s));
          ok(bad.length === 0, `tap targets ≥44px on ${name} @${w}px` + (bad.length ? ': ' + bad.slice(0, 6).join(' | ') : ''));
        }
      }
      await ctx.close();
    }
  }
  ok(!fails.some(f => f.startsWith('overflow')), 'no horizontal overflow on any view at 320/360/390/768/1280 in light and dark');

  console.log('\nconsole/page errors:', errors.length ? errors.slice(0, 8) : 'none');
  console.log('FAILURES:', fails.length ? fails : 'none');
  await browser.close();
  process.exit(fails.length || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
