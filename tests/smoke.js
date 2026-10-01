/* Behavioural smoke test: opens every built chapter, every tab, and drives every exercise type through the real UI to a full score.
   Run with the app being served locally, e.g.:
     python3 -m http.server 8765 &            # from the repo root
     npm i -D playwright && npx playwright install chromium   # once
     node tests/smoke.js                        # APP_URL=http://host:port/index.html to override
   Not loaded by the app — these are developer checks only. */
const { chromium } = require('playwright');
const URL = process.env.APP_URL || 'http://localhost:8765/index.html';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/gstatic|Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route(/gstatic\.com/, r => r.abort());
  await page.addInitScript(() => { try { localStorage.setItem('arabicAcademyVoiceSetupSeen', '1'); } catch (e) {} });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof openChapter === 'function');

  const fails = [];
  const check = (cond, msg) => { if (!cond) fails.push(msg); };

  const ids = await page.evaluate(() => chapters.filter(c => !c.locked).map(c => ({ id: c.id, track: c.track || 'classical' })));
  let tabsChecked = 0, exChecked = 0;
  for (const track of ['classical', 'spoken']) {
    await page.evaluate(t => selectTrack(t), track);
    for (const { id } of ids.filter(x => x.track === track)) {
      await page.evaluate(i => openChapter(i), id);
      for (const tab of ['content', 'vocab', 'exercises', 'speaking']) {
        await page.evaluate(t => switchTab(t), tab);
        const len = await page.evaluate(t => document.getElementById('panel-' + t).innerText.trim().length, tab);
        check(len > 0, `chapter ${id} tab ${tab} is empty`);
        const visible = await page.evaluate(t => getComputedStyle(document.getElementById('panel-' + t)).display !== 'none', tab);
        check(visible, `chapter ${id} tab ${tab} not visible after switchTab`);
        tabsChecked++;
      }
      // Exercises: answer everything correctly through the real UI
      await page.evaluate(t => switchTab('exercises'), 0);
      const res = await page.evaluate(async () => {
        const out = { mcq: 0, match: 0, sent: 0, trans: 0, creative: 0, problems: [] };
        for (const ex of currentChapter.exercises) {
          if (ex.type === 'mcq') {
            ex.items.forEach((it, i) => mcqPick(ex.id, i, it.correct));
            scoreMCQ(ex.id, ex.items.length);
            const chip = document.getElementById(ex.id + '-score');
            if (!chip || !/Score: (\d+) \/ \1$/.test(chip.textContent.trim())) out.problems.push(ex.id + ' mcq not full score: ' + (chip && chip.textContent));
            out.mcq++;
          } else if (ex.type === 'matching') {
            ex.pairs.forEach((p, i) => { matchClick(ex.id, 'left', i); matchClick(ex.id, 'right', i); });
            const chip = document.getElementById(ex.id + '-score');
            if (!chip || chip.style.display === 'none') out.problems.push(ex.id + ' matching did not complete');
            out.match++;
          } else if (ex.type === 'sentence') {
            ex.items.forEach((it, i) => {
              const slot = document.getElementById(`${ex.id}-slot${i}`);
              const chips = [...slot.parentElement.querySelectorAll('.word-chip')];
              it.answer.forEach(w => { const c = chips.find(ch => !ch.classList.contains('used') && ch.textContent.trim() === w); if (c) c.click(); else out.problems.push(ex.id + ' missing chip ' + w); });
            });
            scoreSentences(ex.id, ex.items.length);
            const chip = document.getElementById(ex.id + '-score');
            if (!chip || !/Score: (\d+) \/ \1$/.test(chip.textContent.trim())) out.problems.push(ex.id + ' sentence not full score: ' + (chip && chip.textContent));
            out.sent++;
          } else if (ex.type === 'translate') {
            ex.items.forEach((it, i) => { document.getElementById(`${ex.id}-in${i}`).value = it.keywords[0]; });
            scoreTranslate(ex.id, ex.items.map(i => i.keywords));
            const chip = document.getElementById(ex.id + '-score');
            if (!chip || !/Score: (\d+) \/ \1$/.test(chip.textContent.trim())) out.problems.push(ex.id + ' translate not full score: ' + (chip && chip.textContent));
            out.trans++;
          } else if (ex.type === 'creative') {
            document.getElementById(`${ex.id}-ta0`).value = 'هذا كتاب';
            submitCreative(ex.id, 0);
            out.creative++;
          }
        }
        return out;
      });
      res.problems.forEach(p => fails.push(`chapter ${id}: ${p}`));
      exChecked += res.mcq + res.match + res.sent + res.trans + res.creative;
      // Speaking: phrase navigation
      await page.evaluate(() => { nextPhrase(); prevPhrase(); });
      const ph = await page.evaluate(() => document.getElementById('spAr') ? document.getElementById('spAr').textContent.length : -1);
      check(ph !== 0, `chapter ${id} speaking phrase empty`);
    }
  }

  // Progress should now be 100% for chapters fully completed through the UI (exercises only count 70%)
  const pct = await page.evaluate(() => { selectTrack('classical'); return overallPct(); });
  check(pct > 50, 'overall progress did not advance: ' + pct);

  // Dashboard / index / tracks / test render
  for (const fn of ['showDashboard()', 'showIndex()', 'showTrackSelector()', 'startKnowledgeTest()']) {
    await page.evaluate(fn);
    const len = await page.evaluate(() => document.getElementById('pageRoot').innerText.length);
    check(len > 100, fn + ' rendered almost nothing');
  }
  // gating
  // gating, from a clean slate: chapter 2 must be locked until chapter 1 passes the threshold
  await page.evaluate(() => { progress.chapters = {}; selectTrack('classical'); toggleGating(true); });
  const gated = await page.evaluate(() => ({
    locked: [...document.querySelectorAll('.ch-card.locked')].filter(e => /to unlock/.test(e.textContent)).length,
    openable: document.querySelectorAll('button.ch-card').length }));
  check(gated.locked > 0, 'gating on: no chapter shows an unlock requirement');
  check(gated.openable > 0, 'gating on: first chapter should still be openable');
  const gatedId = await page.evaluate(() => chapters.find(c => !c.locked && c.requires != null && (c.track || 'classical') === 'classical').id);
  const blocked = await page.evaluate(id => { openChapter(id); return currentView; }, gatedId);
  check(blocked !== 'chapter', `gating on: openChapter(${gatedId}) should be refused while its prerequisite is unfinished, but view is ` + blocked);
  await page.evaluate(() => toggleGating(false));
  const allowed = await page.evaluate(id => { openChapter(id); return currentView; }, gatedId);
  check(allowed === 'chapter', `gating off: openChapter(${gatedId}) should work`);

  console.log(`chapters: ${ids.length}, tabs checked: ${tabsChecked}, exercise blocks driven: ${exChecked}`);
  console.log('errors:', errors.length ? errors.slice(0, 10) : 'none');
  console.log('failures:', fails.length ? fails.slice(0, 20) : 'none');
  await browser.close();
  process.exit(errors.length || fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
