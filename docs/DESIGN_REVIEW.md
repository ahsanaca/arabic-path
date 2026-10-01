# Arabic Academy — design review & rework

A review of the app as it stood after commit `ebf0834`, done before building further chapters. It covers
what was wrong, what this branch changes, and what is deliberately left for you to decide.
**No lesson content was changed** — the `units` / `tracks` / `chapters` data in `index.html` is untouched
apart from two short `short:` labels on the tracks.

How it was reviewed: read all of `index.html`, `voice-module.js`, `privacy.html`, `terms.html`; ran the app
and captured every screen at 1280px and 390px, light and dark; measured contrast on the real rendered
pages; drove all 48 chapters / 168 exercises through the UI before and after the change.

---

## 1. What was wrong

### Visual design & presentation
| Finding | Evidence |
|---|---|
| **Text contrast failed WCAG AA almost everywhere.** All 16 colour pairs I measured failed 4.5:1 — white on the "Continue" card's cyan gradient was **1.39:1**, white on the green action buttons 2.87:1, muted/progress text 2.6–3.5:1. | `contrast.js` run on the old palette |
| **Dark mode had gaps.** The "Voice Setup Tips" link was dark purple on dark navy (1.87:1); several inline `#7f8c8d` / `#555` colours ignored the theme. | screenshots; `grep` of inline styles |
| **Unstyled screen.** The first-run voice-setup screen used a `.free-notice` class that has no CSS anywhere. | `grep free-notice` → 2 uses, 0 definitions |
| **Six different gradients** (slate header, blue→cyan, orange→red, purple→indigo, pink→red, purple speaking card) with no hierarchy; the two big CTA cards fought each other above the course list. | dashboard screenshot |
| **Developer copy shown to users.** Footer read "template & content engine prototype". | `index.html` footer |
| **12-star "difficulty".** `difficulty` runs 1–12 (it's really chapter order), and `'⭐'.repeat(n)` drew up to twelve emoji per card. | `difficultyStars()` |
| **No Arabic type stack.** Arabic fell back to whatever the OS chose, so vowel marks (harakat) — the point of a learning app — rendered inconsistently; sizes were small (19–26px) for a script that needs ~1.3× Latin size. | no `font-family` for `.arabic` |

### Information architecture & navigation
| Finding | Evidence |
|---|---|
| **The dashboard is an endless scroll.** 50 cards, each with a 34px emoji, title, Arabic, description, stars and a bar: **11,103px tall on a phone.** The free-app message, voice tips, lock toggle, stats and two CTAs all sit *above* the first chapter. | measured |
| **Header ate the screen on mobile.** 135px tall (nav buttons wrapped onto two rows). | measured |
| **No URLs.** No hash/history use, so the browser Back button leaves the app, reloading loses your place, and a chapter can't be linked to. | `grep hash/pushState` → none |
| **Dashboard and Index were near-duplicates** (same 50 chapters, two layouts), with no way to find a chapter. | |
| **Dead-end links.** The footer says "let us know about a typo" with nowhere to do so; `privacy.html` / `terms.html` (needed for store listing) were not linked from the app at all. | |

### Accessibility
| Finding | Evidence |
|---|---|
| **Zero ARIA, no keyboard support.** Flip cards, quiz options, matching chips, word chips and unit headings were `<div onclick>` — unreachable by keyboard or screen reader. No `lang="ar"`, no focus styles, no `prefers-reduced-motion`. | 0 `aria-`/`role=`/`tabindex` in `index.html` |
| **Colour-only feedback.** Right/wrong answers differed only by green/red. | |
| **Wrong answers explained nothing.** A missed translation just turned red; a missed sentence showed no correct order. | `scoreTranslate`, `scoreSentences` |
| **Small touch targets** (34px listen buttons, 16px progress dots). | |
| **Raw Firebase errors** ("Firebase: Error (auth/invalid-credential).") shown to learners. | `submitAuth` |

---

## 2. What this branch changes

**Design system** — every colour is now a token in `:root` with a dark-mode twin; nothing is hard-coded.
Measured result: **0 failures across 1,785 rendered text nodes** in light and dark (12 more on gradient
backgrounds were checked by colour maths, ≥ 6.0:1). One calm blue/teal palette; purple is reserved for
checkpoints, green for progress/success, red for errors.

**Arabic typography** — bundled **Amiri** (Naskh, SIL OFL; `fonts/`, licence included), subset to the Arabic
block (~80 KB per weight, all 52 distinct Arabic characters in the app verified as covered). Loaded from the
same origin — no third-party request, consistent with the privacy policy. Arabic is larger with headroom for
stacked vowel marks, and every Arabic run gets `lang="ar"`.

**Navigation & structure**
- Slim 56px top bar with a 3px overall-progress strip; on phones the main nav moves to a **bottom tab bar**.
- **Hash routing** (`#/`, `#/index`, `#/tracks`, `#/test`, `#/voice`, `#/chapter/ID/tab`): Back/Forward work,
  reload keeps your place, chapters are linkable, gated/locked/unknown chapter URLs fall back to Home.
  `showDashboard()`, `openChapter()` etc. keep their names and still render synchronously.
- **Dashboard hierarchy:** one "Continue / Up next" card (advances to the next chapter once the current one
  passes 70%) → 3 compact stats → secondary test card → **collapsible units** with per-unit progress
  (current unit open, others closed; Expand/Collapse all) → "About / settings" at the bottom. **11,103px →
  3,344px** on a phone (6,893px fully expanded). Checkpoints get their own purple treatment; "coming soon"
  units collapse into one row instead of a locked card.
- Classical/Spoken **segmented switch** on Home; Tracks page shows per-track progress.
- Course index gained a **search box** (matches title, Arabic title, description — it will matter at 100+ chapters).
- Chapter page: breadcrumb, compact hero with Exercises/Speaking progress pills, **sticky tab bar** with
  completion dots (keyboard: ←/→/Home/End), shorter labels (Lesson · Vocabulary · Exercises · Speaking).
- Footer: Privacy · Terms · **Report a mistake** (opens an email pre-filled with the chapter you're on).
- Legal pages restyled to match, with dark mode and a link back; **their wording is unchanged.**

**Interaction & accessibility**
- Flip cards, options, match chips and word chips are real `<button>`s; flip cards expose `aria-pressed` and hide
  the inactive face from screen readers; "Reveal all / Hide all" for vocab.
- Right/wrong now shows **✓ Correct / ✗ Your answer**, and misses show the expected answer (translation keywords,
  correct word order). Tapping a placed word removes it (no need to Clear everything).
- Skip link, visible focus rings, `aria-live` on scores/status, `prefers-reduced-motion` honoured, buttons, inputs and
  summaries ≥ 44px on every screen (checked at 320–390px), `viewport-fit=cover` + safe-area insets, theme-colour meta, favicon, per-view `<title>`.
- Friendly sign-in errors; nav hidden on the sign-in screen; working "Play a test word" button on the voice-tips
  screen (the screen was titled "Test Your Setup" but had nothing to test).
- Speaking screen: Listen/Record on one row, Prev/count/Next on another; progress dots are 44px buttons.

**Guard-rails for adding content**
- `scripts/validate-content.js` — no-dependency check of every chapter: unique ids, valid unit/track/`requires`,
  MCQ answer index in range, sentence answers buildable from their word bank, lowercase translate keywords,
  unknown block/exercise types, apostrophes that would break `speakWord('…')`, Arabic outside the font subset.
  Negative-tested against deliberately broken data. **Run it before every content commit.**
- `tests/` — Playwright checks: `smoke.js` (every chapter × tab, every exercise type to full score),
  `ui-checks.js` (routing, keyboard, ARIA, overflow at 320–1280px, tap targets, fonts),
  `contrast-audit.js`. Not loaded by the app. See the header of each file for how to run.

Measured: phone header 135 → 60px; ARIA attributes 0 → 278 on the rendered dashboard; `index.html` 306 KB → 338 KB
(+ 160 KB fonts, cached after first load).

---

## 3. Needs your decision (I did not change these)

1. **Terms page has a to-do note live on it:** "*Before publishing: add your governing-law / jurisdiction
   clause here…*" (`terms.html`). Privacy has a "*Note for future updates*" box about payments. Both are
   visible to the public. The legal content is yours to write, so I left it.
2. **"Progress" counts attempts, not mastery.** `chapterProgressPct` treats an exercise as done once it has *any*
   score — including 0% — and a speaking phrase as done on any attempt, even "Try again (10% match)". With
   "lock chapters in order" on, submitting every exercise blank and never speaking scores exactly 70% — the
   gate threshold (checked on Chapter 1). Decide what "done"
   should mean (e.g. ≥ 70% per exercise, or ≥ 55% similarity) — it changes saved-progress semantics, so I held off.
3. **Audio is the biggest content-quality gap.** The app teaches Emirati/Gulf Arabic but speaks with the device's
   Saudi/MSA text-to-speech (the voice-tips screen admits this). Recorded clips from a native speaker for the
   ~420 vocab words and speaking phrases (287 + 137) would do more for learners than any visual change. Also speech-recognition scoring is
   Levenshtein on unvowelled text, so it can't judge pronunciation of vowels.
4. **Alphabet chapter content.** It has 28 cards and five text blocks but **no letter-forms table** (isolated /
   initial / medial / final) even though it says letters change shape; and ح and هـ are both transliterated
   "haa". Worth fixing before Chapter 1 builds on it.
5. **Emoji as icons.** They render differently per platform and all 28 alphabet letters have an empty icon. An
   SVG icon set would look more consistent; it's a content-wide change, so not done here.
6. **`difficulty` (1–12) is no longer shown** — it's chapter order, not a rating. If you want a difficulty
   badge, define a 1–5 scale in the data.
7. **Contact address.** The report link and the legal pages use `ahsanpsr@gmail.com` (already public in your
   policy pages). It's one constant, `CONTACT_EMAIL`, near the top of the app script — change it there if you'd
   rather use a project address.
8. **Keeping "Home" and "Course" as two screens.** With collapsible units Home now covers most of what the
   index did. I kept both (Course = flat outline + search); say if you'd rather fold one into the other.

## 4. Not verified / known limits

- I could not test on a real phone or inside the Capacitor shell, so **native voice, microphone permission and
  safe-area behaviour are untested.** The Amiri font was verified in Chromium only.
- Firebase is blocked in the sandbox, so **sign-in/sync was not exercised** (the screens were rendered and the
  error mapping unit-checked). Your Firestore rules can't be verified from the repo.
- The three Firebase `<script>`s in `<head>` are render-blocking (no `defer`). The app only needs them for
  optional sync; making them non-blocking means restructuring `initApp()`, so I left it. Offline support
  (manifest + service worker) is the natural next step for a self-study app.

## 5. Suggested checklist for each new chapter

1. Copy an existing chapter object; give it the next `id`, the right `unit`/`track`/`requires`, and a short
   `label`, `title`, `desc` (one line — it appears on cards) and `arabicTitle` with full vowels.
2. Keep paragraphs under ~400 characters; use `h` blocks to break the lesson up (the longest today are ~400).
3. Every vocab word needs `ar`, `translit`, `en` (and `icon: ""` if none). Keep transliteration consistent —
   decide one scheme and apply it to letters too.
4. Exercise ids only need to be unique within the chapter.
5. `node scripts/validate-content.js`, then `node tests/smoke.js` with the app served locally.
