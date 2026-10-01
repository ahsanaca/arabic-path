#!/usr/bin/env node
/* Validates the chapter data in index.html so new content can't silently break the engine.
   Usage:  node scripts/validate-content.js          (no dependencies; exits 1 on errors)

   It pulls the data layer (units / tracks / chapters) out of index.html and checks the
   shape the renderer and scorers rely on: unique ids, valid unit/track/requires links,
   MCQ answer indexes, sentence-builder answers that can actually be built from their
   word bank, non-empty translate keywords, and Arabic characters the bundled font
   (fonts/Amiri-*.subset.woff2, Arabic block U+0600–06FF) can't draw. */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('<script>\n/* ====') + 9;
const end = src.lastIndexOf('</script>');
const code = src.slice(start, end);
const data = code.slice(0, code.indexOf('const firebaseConfig'));
const { units, tracks, chapters } = new Function(data + '\nreturn { units, tracks, chapters };')();

const errors = [], warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
const isStr = v => typeof v === 'string' && v.trim().length > 0;

// Sorted multiset equality (a sentence answer must use exactly the words in the bank).
const sameWords = (a, b) => a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');
const FONT_OK = /[؀-ۿ]/;
const ARABIC_ANY = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const outsideFont = s => (String(s).match(ARABIC_ANY) || []).filter(c => !FONT_OK.test(c));

const trackIds = new Set(tracks.map(t => t.id));
const unitById = new Map();
units.forEach(u => {
  if (unitById.has(u.id)) err(`unit ${u.id}`, 'duplicate unit id');
  unitById.set(u.id, u);
  if (!trackIds.has(u.track || 'classical')) err(`unit ${u.id}`, `unknown track "${u.track}"`);
  if (!isStr(u.title) || !isStr(u.desc)) err(`unit ${u.id}`, 'needs title and desc');
});

const chapterIds = new Set();
let exerciseCount = 0;
chapters.forEach(c => {
  const w = `chapter ${c.id} (${c.label})`;
  if (chapterIds.has(c.id)) err(w, 'duplicate chapter id');
  chapterIds.add(c.id);
  const unit = unitById.get(c.unit);
  if (!unit) { err(w, `unit "${c.unit}" does not exist`); return; }
  if ((unit.track || 'classical') !== (c.track || 'classical')) err(w, `track "${c.track || 'classical'}" differs from its unit's track "${unit.track || 'classical'}"`);
  ['label', 'title', 'icon', 'desc'].forEach(k => { if (!isStr(c[k])) err(w, `missing "${k}"`); });
  if (!isStr(c.arabicTitle)) err(w, 'missing "arabicTitle"');
  if (c.locked) return; // "coming soon" placeholders have no content to check

  if (c.requires != null && !chapters.some(x => x.id === c.requires)) err(w, `requires chapter ${c.requires}, which does not exist`);
  if (!Array.isArray(c.content) || !c.content.length) err(w, 'needs a non-empty content array');
  const blockTypes = new Set(['p', 'h', 'wordcard', 'charlist', 'pattern', 'examples', 'note']);
  (c.content || []).forEach((b, i) => { if (!blockTypes.has(b.type)) err(w, `content[${i}] has unknown block type "${b.type}" (renderer would drop it)`); });

  (c.vocabCategories || []).forEach((cat, ci) => (cat.words || []).forEach((wd, wi) => {
    ['ar', 'translit', 'en'].forEach(k => { if (!isStr(wd[k])) err(w, `vocabCategories[${ci}].words[${wi}] missing "${k}"`); });
    if (typeof wd.icon !== 'string') err(w, `vocabCategories[${ci}].words[${wi}] needs an "icon" string (use "" for none)`);
  }));
  (c.speakingPhrases || []).forEach((p, i) => {
    ['ar', 'plain', 'translit', 'meaning'].forEach(k => { if (!isStr(p[k])) err(w, `speakingPhrases[${i}] missing "${k}" (plain = unvowelled text used for scoring)`); });
  });

  // Exercise ids only need to be unique within a chapter: progress is stored per chapter and
  // only one chapter's exercises are in the DOM at a time (e.g. "ex1" can repeat across chapters).
  const idsInChapter = new Set();
  (c.exercises || []).forEach(ex => {
    const ew = `${w} ${ex.id}`;
    if (!isStr(ex.id)) { err(w, 'exercise without an id'); return; }
    if (idsInChapter.has(ex.id)) err(ew, 'duplicate exercise id within the chapter (progress and DOM lookups use it)');
    idsInChapter.add(ex.id);
    exerciseCount++;
    if (!isStr(ex.title) || !isStr(ex.instructions)) err(ew, 'needs title and instructions');
    switch (ex.type) {
      case 'mcq':
        (ex.items || []).forEach((it, i) => {
          if (!isStr(it.promptAr) && !isStr(it.promptText)) err(ew, `item ${i} needs promptAr or promptText`);
          if (!Array.isArray(it.options) || it.options.length < 2) err(ew, `item ${i} needs at least 2 options`);
          else if (!Number.isInteger(it.correct) || it.correct < 0 || it.correct >= it.options.length) err(ew, `item ${i} "correct" (${it.correct}) is not a valid option index`);
          else if (new Set(it.options).size !== it.options.length) warn(ew, `item ${i} has duplicate options`);
        });
        break;
      case 'matching':
        if (!Array.isArray(ex.pairs) || ex.pairs.length < 2) err(ew, 'needs at least 2 pairs');
        (ex.pairs || []).forEach((p, i) => { if (!isStr(p.left) || !isStr(p.right)) err(ew, `pair ${i} needs left and right`); });
        { const rights = (ex.pairs || []).map(p => p.right); if (new Set(rights).size !== rights.length) warn(ew, 'two pairs share the same right-hand text, so matching is ambiguous'); }
        break;
      case 'translate':
        (ex.items || []).forEach((it, i) => {
          if (!isStr(it.ar)) err(ew, `item ${i} missing "ar"`);
          if (!Array.isArray(it.keywords) || !it.keywords.length) err(ew, `item ${i} needs a non-empty keywords array`);
          else if (it.keywords.some(k => k !== String(k).toLowerCase())) err(ew, `item ${i} keywords must be lowercase (answers are lowercased before matching)`);
        });
        break;
      case 'sentence':
        (ex.items || []).forEach((it, i) => {
          if (!Array.isArray(it.words) || !Array.isArray(it.answer)) { err(ew, `item ${i} needs words[] and answer[]`); return; }
          if (!sameWords(it.words, it.answer)) err(ew, `item ${i} answer cannot be built from its word bank (words: ${it.words.join(' ')} | answer: ${it.answer.join(' ')})`);
          if (it.words.some(x => /['"<>&]/.test(x))) err(ew, `item ${i} has a word containing a quote, <, > or & — it is placed in an inline handler and would break`);
        });
        break;
      case 'creative':
        (ex.items || []).forEach((it, i) => { if (!isStr(it.prompt)) err(ew, `item ${i} missing "prompt"`); });
        break;
      default:
        err(ew, `unknown exercise type "${ex.type}"`);
    }
  });

  // Arabic the bundled font can't draw (falls back to a system font, so vowel marks may render differently).
  const bad = new Set(outsideFont(JSON.stringify(c)));
  if (bad.size) warn(w, `Arabic characters outside the bundled font subset: ${[...bad].map(ch => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(', ')} — extend the subset in fonts/`);
});

// speakWord('…') inline handlers break on apostrophes in the Arabic string.
chapters.forEach(c => {
  const strs = [];
  (c.content || []).forEach(b => { if (b.ar) strs.push(b.ar); (b.items || []).forEach(i => i && i.ar && strs.push(i.ar)); });
  (c.vocabCategories || []).forEach(cat => (cat.words || []).forEach(wd => strs.push(wd.ar)));
  strs.filter(s => /'/.test(s)).forEach(s => err(`chapter ${c.id} (${c.label})`, `Arabic string "${s}" contains an apostrophe and would break its speakWord('…') handler`));
});

const real = chapters.filter(c => !c.locked).length;
console.log(`Checked ${real} built chapters (${chapters.length} total), ${units.length} units, ${tracks.length} tracks, ${exerciseCount} exercises.`);
warnings.forEach(m => console.log('  warning:', m));
errors.forEach(m => console.log('  ERROR:  ', m));
console.log(errors.length ? `\n${errors.length} error(s), ${warnings.length} warning(s).` : `\nOK — 0 errors, ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
