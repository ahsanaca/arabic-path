// Generates the "Arabic for Little Learners" (kids) track and splices it into the Arabic app's index.html.
// Usage: node scripts/build-kids-track.js [path-to-index.html]   (defaults to ../index.html)
// The kids chapters in index.html are GENERATED from the word lists below — edit them here, re-run, then run
// `node scripts/validate-content.js`. Pictures are emoji; Arabic words carry full vowel marks.
// Re-runnable: everything it inserts sits between KIDS markers and is replaced on the next run.
const fs = require('fs');

const file = process.argv[2] || require('path').join(__dirname, '..', 'index.html');
let src = fs.readFileSync(file, 'utf8');

/* ---------------------------------------------------------------- helpers */
const strip = s => s.replace(/[ً-ْٰ]/g, '');          // remove vowel marks (used for speech scoring)
const norm = s => strip(s).replace(/[أإآٱ]/g, 'ا').replace(/ـ/g, '');
function rng(seed) {                                                 // small deterministic shuffler (mulberry32)
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (arr, seed) => { const r = rng(seed), a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const kidPic = icon => `<span class="kid-pic" role="img" aria-label="picture">${icon}</span>`;
const kidLetter = l => `<span class="kid-letter">${l}</span>`;
const L = l => `<span class="kid-letter-inline">${l}</span>`;

// Options for a multiple-choice item: the right answer plus two wrong ones from `pool`, right answer in a varying slot.
function options(correct, pool, seed, slot) {
  const wrong = shuffle(pool.filter(x => x !== correct), seed).slice(0, 2);
  const opts = [...wrong];
  opts.splice(slot % 3, 0, correct);
  return { options: opts, correct: opts.indexOf(correct) };
}

/* ---------------------------------------------------------------- the 28 letters */
// [letter, letter name, sound, icon, word, word transliteration, English]
const LETTERS = [
  ['أ', 'alif', 'like a short “a”', '🐰', 'أَرْنَب', 'arnab', 'rabbit'],
  ['ب', 'baa', 'like “b”', '🦆', 'بَطَّة', 'battah', 'duck'],
  ['ت', 'taa', 'like “t”', '🍎', 'تُفَّاحَة', 'tuffaahah', 'apple'],
  ['ث', 'thaa', 'like “th” in think', '🦊', 'ثَعْلَب', 'thaʻlab', 'fox'],
  ['ج', 'jiim', 'like “j”', '🐪', 'جَمَل', 'jamal', 'camel'],
  ['ح', 'haa', 'a soft, breathy “h” from the throat', '🐴', 'حِصَان', 'hisaan', 'horse'],
  ['خ', 'khaa', 'like “kh” — a soft throat-clearing', '🐑', 'خَرُوف', 'kharoof', 'sheep'],
  ['د', 'daal', 'like “d”', '🐻', 'دُبّ', 'dubb', 'bear'],
  ['ذ', 'dhaal', 'like “th” in this', '🌽', 'ذُرَة', 'dhurah', 'corn'],
  ['ر', 'raa', 'like “r”, rolled a little', '👨', 'رَجُل', 'rajul', 'man'],
  ['ز', 'zaay', 'like “z”', '🦒', 'زَرَافَة', 'zaraafah', 'giraffe'],
  ['س', 'siin', 'like “s”', '🐟', 'سَمَكَة', 'samakah', 'fish'],
  ['ش', 'shiin', 'like “sh”', '☀️', 'شَمْس', 'shams', 'sun'],
  ['ص', 'saad', 'a heavy, full-mouth “s”', '🦅', 'صَقْر', 'saqr', 'falcon'],
  ['ض', 'daad', 'a heavy, full-mouth “d”', '🐸', 'ضِفْدَع', 'difdaʻ', 'frog'],
  ['ط', 'taa (heavy)', 'a heavy, full-mouth “t”', '✈️', 'طَائِرَة', 'taaʼirah', 'aeroplane'],
  ['ظ', 'zaa (heavy)', 'a heavy “th” as in this', '🦌', 'ظَبْي', 'zabi', 'gazelle (a kind of deer)'],
  ['ع', 'ʻayn', 'a deep sound from the throat — no English match', '🐦', 'عُصْفُور', 'ʻusfoor', 'sparrow (a small bird)'],
  ['غ', 'ghayn', 'like “gh” — a soft gargle', '☁️', 'غَيْمَة', 'ghaymah', 'cloud'],
  ['ف', 'faa', 'like “f”', '🐘', 'فِيل', 'feel', 'elephant'],
  ['ق', 'qaaf', 'a deep “k” from the back of the throat', '🐱', 'قِطَّة', 'qittah', 'cat'],
  ['ك', 'kaaf', 'like “k”', '🐶', 'كَلْب', 'kalb', 'dog'],
  ['ل', 'laam', 'like “l”', '🍋', 'لَيْمُون', 'laymoon', 'lemon'],
  ['م', 'miim', 'like “m”', '🍌', 'مَوْز', 'mawz', 'banana'],
  ['ن', 'nuun', 'like “n”', '⭐', 'نَجْمَة', 'najmah', 'star'],
  ['هـ', 'haa', 'an easy “h”, like hello', '🌙', 'هِلَال', 'hilaal', 'crescent moon'],
  ['و', 'waaw', 'like “w”', '🌹', 'وَرْدَة', 'wardah', 'rose'],
  ['ي', 'yaa', 'like “y”', '✋', 'يَد', 'yad', 'hand']
];
// every picture word must start with its letter
LETTERS.forEach(([l, , , , w]) => {
  const first = norm(w)[0], want = norm(l)[0];
  const ok = first === want || (want === 'ه' && first === 'ه');
  if (!ok) throw new Error(`word ${w} does not start with ${l}`);
});

/* ---------------------------------------------------------------- topic word lists: [icon, Arabic, transliteration, English] */
const COLOURS = [
  ['🔴', 'أَحْمَر', 'ahmar', 'red'], ['🔵', 'أَزْرَق', 'azraq', 'blue'], ['🟢', 'أَخْضَر', 'akhdar', 'green'],
  ['🟡', 'أَصْفَر', 'asfar', 'yellow'], ['⚪', 'أَبْيَض', 'abyad', 'white'], ['⚫', 'أَسْوَد', 'aswad', 'black'],
  ['🟠', 'بُرْتُقَالِيّ', 'burtuqaali', 'orange'], ['🟣', 'بَنَفْسَجِيّ', 'banafsaji', 'purple'], ['🟤', 'بُنِّيّ', 'bunni', 'brown']
];
const NUMBERS = [
  ['1️⃣', 'وَاحِد', 'waahid', 'one (١)'], ['2️⃣', 'اِثْنَان', 'ithnaan', 'two (٢)'], ['3️⃣', 'ثَلَاثَة', 'thalaathah', 'three (٣)'],
  ['4️⃣', 'أَرْبَعَة', 'arbaʻah', 'four (٤)'], ['5️⃣', 'خَمْسَة', 'khamsah', 'five (٥)'], ['6️⃣', 'سِتَّة', 'sittah', 'six (٦)'],
  ['7️⃣', 'سَبْعَة', 'sabʻah', 'seven (٧)'], ['8️⃣', 'ثَمَانِيَة', 'thamaaniyah', 'eight (٨)'], ['9️⃣', 'تِسْعَة', 'tisʻah', 'nine (٩)'],
  ['🔟', 'عَشَرَة', 'ʻasharah', 'ten (١٠)']
];
const ANIMALS = [
  ['🦁', 'أَسَد', 'asad', 'lion'], ['🐄', 'بَقَرَة', 'baqarah', 'cow'], ['🐔', 'دَجَاجَة', 'dajaajah', 'hen'],
  ['🐒', 'قِرْد', 'qird', 'monkey'], ['🦋', 'فَرَاشَة', 'faraashah', 'butterfly'], ['🐝', 'نَحْلَة', 'nahlah', 'bee'],
  ['🐍', 'حَيَّة', 'hayyah', 'snake'], ['🐢', 'سُلَحْفَاة', 'sulahfaah', 'turtle'], ['🐋', 'حُوت', 'hoot', 'whale']
];
const FOOD = [
  ['🍊', 'بُرْتُقَالَة', 'burtuqaalah', 'an orange'], ['🍇', 'عِنَب', 'ʻinab', 'grapes'], ['🍓', 'فَرَاوْلَة', 'faraawlah', 'strawberry'],
  ['🍉', 'بِطِّيخ', 'bittiikh', 'watermelon'], ['🍞', 'خُبْز', 'khubz', 'bread'], ['🥛', 'حَلِيب', 'haliib', 'milk'],
  ['💧', 'مَاء', 'maaʼ', 'water'], ['🥚', 'بَيْضَة', 'baydah', 'egg'], ['🧀', 'جُبْن', 'jubn', 'cheese'], ['🍚', 'أَرُزّ', 'aruzz', 'rice']
];
const FAMILY = [
  ['👨', 'أَب', 'ab', 'father'], ['👩', 'أُمّ', 'umm', 'mother'], ['👦', 'أَخ', 'akh', 'brother'], ['👧', 'أُخْت', 'ukht', 'sister'],
  ['👴', 'جَدّ', 'jadd', 'grandfather'], ['👵', 'جَدَّة', 'jaddah', 'grandmother'], ['👶', 'طِفْل', 'tifl', 'baby / young child'], ['👪', 'عَائِلَة', 'ʻaaʼilah', 'family']
];
const BODY = [
  ['🙂', 'رَأْس', 'raʼs', 'head'], ['👁️', 'عَيْن', 'ʻayn', 'eye'], ['👂', 'أُذُن', 'udhun', 'ear'], ['👃', 'أَنْف', 'anf', 'nose'],
  ['👄', 'فَم', 'fam', 'mouth'], ['✋', 'يَد', 'yad', 'hand'], ['🦶', 'رِجْل', 'rijl', 'foot / leg'], ['🦷', 'سِنّ', 'sinn', 'tooth'], ['❤️', 'قَلْب', 'qalb', 'heart']
];
const SCHOOL = [
  ['📖', 'كِتَاب', 'kitaab', 'book'], ['✏️', 'قَلَم', 'qalam', 'pen / pencil'], ['📓', 'دَفْتَر', 'daftar', 'notebook'], ['🎒', 'حَقِيبَة', 'haqeebah', 'school bag'],
  ['🏫', 'مَدْرَسَة', 'madrasah', 'school'], ['📏', 'مِسْطَرَة', 'mistarah', 'ruler'], ['⏰', 'سَاعَة', 'saaʻah', 'clock'], ['🚪', 'بَاب', 'baab', 'door']
];
const WORLD = [
  ['☀️', 'شَمْس', 'shams', 'sun'], ['🌙', 'قَمَر', 'qamar', 'moon'], ['🌧️', 'مَطَر', 'matar', 'rain'], ['🌳', 'شَجَرَة', 'shajarah', 'tree'],
  ['🌸', 'زَهْرَة', 'zahrah', 'flower'], ['🌊', 'بَحْر', 'bahr', 'sea'], ['⛰️', 'جَبَل', 'jabal', 'mountain'], ['🏠', 'بَيْت', 'bayt', 'house'], ['🚗', 'سَيَّارَة', 'sayyaarah', 'car']
];
const MANNERS = [
  ['👋', 'السَّلَامُ عَلَيْكُم', 'as-salaamu ʻalaykum', 'hello (peace be upon you)', 'hello'],
  ['😊', 'وَعَلَيْكُمُ السَّلَام', 'wa ʻalaykumu s-salaam', 'the reply: and peace be upon you', 'the reply to hello'],
  ['🌅', 'صَبَاحُ الخَيْر', 'sabaahu l-khayr', 'good morning', 'good morning'],
  ['🌙', 'مَسَاءُ الخَيْر', 'masaaʼu l-khayr', 'good evening', 'good evening'],
  ['🙏', 'شُكْرًا', 'shukran', 'thank you', 'thank you'],
  ['🤝', 'مِنْ فَضْلِك', 'min fadlik', 'please', 'please'],
  ['🍽️', 'بِسْمِ الله', 'bismillaah', 'in the name of Allah — said before eating', 'what we say before eating'],
  ['🤲', 'الحَمْدُ لله', 'alhamdu lillaah', 'praise be to Allah — said after eating, or when you are well', 'what we say after eating'],
  ['👋', 'مَعَ السَّلَامَة', 'maʻa s-salaamah', 'goodbye', 'goodbye']
];

/* ---------------------------------------------------------------- builders */
const vocab = (icon, ar, tr, en) => ({ icon, ar, translit: tr, en });
const speak = (icon, ar, tr, en) => ({ icon, ar, plain: strip(ar), translit: tr, meaning: en });
const ALL_WORDS = [
  ...LETTERS.map(l => ['', l[4], l[5], l[6]]),
];

function chapterBase(o) {
  return Object.assign({ track: 'kids', difficulty: 1, locked: false }, o);
}

// --- a letters chapter (4 letters, each with a picture word)
function lettersChapter(idx, id, requires) {
  const group = LETTERS.slice(idx * 4, idx * 4 + 4);
  const names = group.map(g => g[1][0].toUpperCase() + g[1].slice(1).replace(' (heavy)', '')).join(', ');
  const picNames = group.map(g => g[6].replace(/ \(.*\)/, '')).join(', ');
  const content = [];
  if (idx === 0) {
    content.push({ type: 'p', text: 'This track is for children of about 5–8 who already know the Arabic letters. Every letter gets a <strong>picture friend</strong> — a word that starts with it — and then we learn first words: colours, numbers, animals, food, family and good manners.' });
    content.push({ type: 'note', html: '<strong>Sit together.</strong> You read the English; your child taps 🔊, listens and says the Arabic. Five to ten minutes a day is plenty. Don’t worry about writing or spelling yet — praise every try, and replay the sound as often as they like.' });
  }
  content.push({ type: 'p', text: `Four letters today. For each one: tap 🔊 to hear the word, say it together, then point to the <strong>first letter</strong> of the word.` });
  content.push({ type: 'h', text: 'Meet the Letters' });
  group.forEach(([l, name, sound, icon, w, tr, en]) => {
    content.push({ type: 'wordcard', icon, ar: w, translit: tr, meaning: `${en} — starts with ${L(l)} (${name}, ${sound})` });
  });
  const letterCards = group.map(([l, name, sound, icon]) => vocab(icon, l, name, `${sound}`));
  const wordCards = group.map(([l, , , icon, w, tr, en]) => vocab(icon, w, tr, `${en} (starts with ${l})`));
  const seed = id * 17;
  const q1 = group.map(([l, , , icon, w], i) => {
    const o = options(l, LETTERS.map(x => x[0]), seed + i, i + idx);
    return { icon, promptAr: w, ...o };
  });
  const q2 = group.map(([l, , , , w], i) => {
    const o = options(w, LETTERS.map(x => x[4]), seed + 40 + i, i + idx + 1);
    return { promptText: `${kidLetter(l)} Which picture word starts with this letter?`, ...o };
  });
  return chapterBase({
    id, unit: 'k-u1', label: `Letters ${idx + 1}`, requires, icon: group[0][3],
    title: names,
    arabicTitle: group.map(g => g[4]).join('، '),
    desc: `${picNames} — four letters, each with a picture word.`,
    content,
    vocabCategories: [{ name: 'The letters', words: letterCards }, { name: 'Picture words', words: wordCards }],
    exercises: [
      { id: `k${id}-ex1`, type: 'mcq', title: 'Exercise 1 — First Letter', instructions: 'Look at the picture and the word. Which letter does the word start with?', items: q1 },
      { id: `k${id}-ex2`, type: 'mcq', title: 'Exercise 2 — Find the Word', instructions: 'Which picture word starts with the big letter?', items: q2 },
      { id: `k${id}-ex3`, type: 'matching', title: 'Exercise 3 — Letter and Picture', instructions: 'Tap a letter, then tap its picture.', pairs: group.map(([l, , , icon]) => ({ left: l, right: icon })) }
    ],
    speakingPhrases: group.map(([l, , , icon, w, tr, en]) => speak(icon, w, tr, en))
  });
}

// --- a words chapter (picture + Arabic word + English)
function wordsChapter(o) {
  const { id, label, icon, title, arabicTitle, desc, intro, activity, words, requires, unit, phrase, extra } = o;
  const arList = words.map(w => w[1]);
  const content = [
    { type: 'p', text: intro },
    { type: 'h', text: 'Say It Together' },
    { type: 'examples', items: words.map(([ic, ar, tr, en]) => ({ icon: ic, ar, translit: tr, meaning: en })) },
    { type: 'note', html: `<strong>Try it:</strong> ${activity}` }
  ];
  const seed = id * 31;
  // Exercise 1: picture -> Arabic word (phrases: English -> Arabic)
  const pick = (n, off) => shuffle(words.map((_, i) => i), seed + off).slice(0, n);
  const q1 = pick(Math.min(5, words.length), 1).map((wi, i) => {
    const [ic, ar, , en] = words[wi];
    const o2 = options(ar, arList, seed + 10 + i, i + 1);
    const prompt = phrase ? `Which Arabic means “${words[wi][4]}”?` : `${kidPic(ic)} Which word is this?`;
    return { promptText: prompt, ...o2 };
  });
  // Exercise 2: Arabic word -> English meaning
  const enLabel = ([ic, , , en, short]) => phrase ? short.charAt(0).toUpperCase() + short.slice(1) : `${ic} ${en}`;
  const enList = words.map(enLabel);
  const q2 = pick(Math.min(4, words.length), 2).map((wi, i) => {
    const w = words[wi];
    const o2 = options(enLabel(w), enList, seed + 20 + i, i + 2);
    return { promptAr: w[1], icon: '', ...o2 };
  });
  const exercises = [
    { id: `k${id}-ex1`, type: 'mcq', title: phrase ? 'Exercise 1 — What Do We Say?' : 'Exercise 1 — Picture Time', instructions: phrase ? 'Tap the right Arabic words.' : 'Look at the picture. Tap the matching word.', items: q1 },
    { id: `k${id}-ex2`, type: 'mcq', title: 'Exercise 2 — What Does It Mean?', instructions: 'Tap the English that matches the Arabic.', items: q2 }
  ];
  if (extra) exercises.push(extra);
  const matchWords = pick(Math.min(5, words.length), 3).map(i => words[i]);
  exercises.push({
    id: `k${id}-ex${exercises.length + 1}`, type: 'matching', title: `Exercise ${exercises.length + 1} — Match Them Up`,
    instructions: phrase ? 'Tap the English, then tap the Arabic.' : 'Tap a picture, then tap its word.',
    pairs: matchWords.map(w => ({ left: phrase ? enLabel(w) : w[0], right: w[1] }))
  });
  return chapterBase({
    id, unit, label, requires, icon, title, arabicTitle, desc,
    content,
    vocabCategories: [{ name: title.replace(/^[^:]*:\s*/, ''), words: words.map(([ic, ar, tr, en]) => vocab(ic, ar, tr, en)) }],
    exercises,
    speakingPhrases: words.slice(0, 10).map(([ic, ar, tr, en]) => speak(ic, ar, tr, en.split(' — ')[0]))
  });
}

// --- a review chapter
function reviewChapter(id, unit, label, requires, title, arabicTitle, desc, sources, letterPool) {
  // sources: arrays of [icon, ar, tr, en] words to quiz as picture -> word
  const pool = sources.flat();
  const arPool = pool.map(w => w[1]);
  const seed = id * 13;
  const picks = shuffle(pool.map((_, i) => i), seed).slice(0, 6);
  const items = picks.map((wi, i) => {
    const [ic, ar] = pool[wi];
    return { promptText: `${kidPic(ic)} Which word is this?`, ...options(ar, arPool, seed + i, i) };
  });
  const exercises = [{ id: `k${id}-ex1`, type: 'mcq', title: 'Exercise 1 — Picture Quiz', instructions: 'Look at the picture and tap the matching word.', items }];
  if (letterPool) {
    const ls = shuffle(letterPool.map((_, i) => i), seed + 5).slice(0, 6);
    exercises.push({
      id: `k${id}-ex2`, type: 'mcq', title: 'Exercise 2 — First Letter', instructions: 'Which letter does the word start with?',
      items: ls.map((li, i) => ({ icon: letterPool[li][3], promptAr: letterPool[li][4], ...options(letterPool[li][0], letterPool.map(x => x[0]), seed + 70 + i, i + 1) }))
    });
  }
  return chapterBase({
    id, unit, label, requires, icon: '🌟', type: 'checkpoint', title, arabicTitle, desc,
    content: [{ type: 'p', text: 'Let’s see what you remember! Look at each picture and tap the right answer. If you get stuck, go back and tap 🔊 on the earlier chapters — then try again.' }],
    vocabCategories: [],
    exercises,
    speakingPhrases: []
  });
}

/* ---------------------------------------------------------------- assemble */
const chapters = [];
for (let i = 0; i < 7; i++) chapters.push(lettersChapter(i, 200 + i, i === 0 ? null : 199 + i));
chapters.push(reviewChapter(207, 'k-u1', 'Review 1', 206, 'All the Letters', 'مُرَاجَعَة', 'Pictures and first letters from the whole alphabet.',
  [LETTERS.map(l => [l[3], l[4], l[5], l[6]])], LETTERS));

chapters.push(wordsChapter({ id: 208, unit: 'k-u2', label: 'Words 1', requires: 207, icon: '🎨', title: 'Colours', arabicTitle: 'الأَلْوَان', desc: 'Nine colours, each with a coloured dot to tap and say.',
  intro: 'Colours (<em>al-alwaan</em>) are a happy first topic: you can point at things everywhere. Tap 🔊 on each one, say it together, then look around the room.',
  activity: 'find something <strong>red</strong> and say <span class="kid-letter-inline">أَحْمَر</span>; then find something blue, green, yellow…', words: COLOURS }));
chapters.push(wordsChapter({ id: 209, unit: 'k-u2', label: 'Words 2', requires: 208, icon: '🔢', title: 'Numbers 1–10', arabicTitle: 'الأَرْقَام', desc: 'Count from one to ten, with the Arabic digits too.',
  intro: 'Numbers (<em>al-arqaam</em>) from one to ten. Each has its own Arabic digit shown in brackets — Arabic digits look different from the ones we use in English.',
  activity: 'count your fingers aloud from <span class="kid-letter-inline">وَاحِد</span> to <span class="kid-letter-inline">عَشَرَة</span>, then count the stairs, toys or biscuits!', words: NUMBERS,
  extra: { id: 'k209-ex3', type: 'mcq', title: 'Exercise 3 — Count and Choose', instructions: 'Count the pictures. Tap the Arabic number word.', items: [
    [3, '⭐⭐⭐'], [5, '🍎🍎🍎🍎🍎'], [2, '🐱🐱'], [4, '🌸🌸🌸🌸'], [6, '🎈🎈🎈🎈🎈🎈']
  ].map(([n, pics], i) => ({ promptText: `<span class="kid-pic" role="img" aria-label="picture">${pics}</span> How many?`, ...options(NUMBERS[n - 1][1], NUMBERS.map(x => x[1]), 209 * 7 + i, i) })) } }));
chapters.push(wordsChapter({ id: 210, unit: 'k-u2', label: 'Words 3', requires: 209, icon: '🦁', title: 'More Animals', arabicTitle: 'الحَيَوَانَات', desc: 'Nine more animals, from a lion to a whale.',
  intro: 'Animals (<em>al-hayawaanaat</em>) are always popular. Some you met with the letters; here are nine more. Make the animal’s sound after you say its name!',
  activity: 'play “guess the animal” — you make a sound, your child says the Arabic name.', words: ANIMALS }));
chapters.push(wordsChapter({ id: 211, unit: 'k-u2', label: 'Words 4', requires: 210, icon: '🍉', title: 'Fruit & Food', arabicTitle: 'الفَوَاكِه وَالطَّعَام', desc: 'Ten everyday foods and drinks.',
  intro: 'Food and drink (<em>at-taʻaam</em>) — words your child will use at every meal. Say them while you eat!',
  activity: 'at the next meal, ask “<span class="kid-letter-inline">مَاذَا تُرِيد؟</span>” (what do you want?) and let your child answer with the Arabic word.', words: FOOD }));
chapters.push(reviewChapter(212, 'k-u2', 'Review 2', 211, 'Colours, Numbers, Animals & Food', 'مُرَاجَعَة', 'Pictures from Unit 2 — tap the right word.',
  [COLOURS, NUMBERS, ANIMALS, FOOD]));

chapters.push(wordsChapter({ id: 213, unit: 'k-u3', label: 'Words 5', requires: 212, icon: '👪', title: 'My Family', arabicTitle: 'عَائِلَتِي', desc: 'Mum, dad, brother, sister, grandparents.',
  intro: 'Family (<em>al-ʻaaʼilah</em>) — the people your child knows best. Point to each family member in photos or around the house.',
  activity: 'look at a family photo and name each person in Arabic.', words: FAMILY }));
chapters.push(wordsChapter({ id: 214, unit: 'k-u3', label: 'Words 6', requires: 213, icon: '🧍', title: 'My Body', arabicTitle: 'جِسْمِي', desc: 'Head, eyes, ears, nose, mouth, hand, foot, tooth, heart.',
  intro: 'Parts of the body (<em>al-jism</em>) are easy and fun: touch each part as you say it.',
  activity: 'play “touch your…” — say <span class="kid-letter-inline">أَنْف</span> and let your child touch their nose; swap roles!', words: BODY }));
chapters.push(wordsChapter({ id: 215, unit: 'k-u3', label: 'Words 7', requires: 214, icon: '🏫', title: 'At School', arabicTitle: 'فِي المَدْرَسَة', desc: 'Book, pen, notebook, bag, ruler, clock, door.',
  intro: 'School things (<em>al-madrasah</em>) your child sees every day. Handy for reading and writing practice later on.',
  activity: 'pack the school bag together and name each thing in Arabic as it goes in.', words: SCHOOL }));
chapters.push(wordsChapter({ id: 216, unit: 'k-u3', label: 'Words 8', requires: 215, icon: '🌳', title: 'Things Around Me', arabicTitle: 'حَوْلِي', desc: 'Sun, moon, rain, tree, flower, sea, mountain, house and car.',
  intro: 'The world around us. Say these words on a walk, in the car or looking out of the window.',
  activity: 'on your next walk, spot a tree, a flower, the sun… and name each one in Arabic.', words: WORLD }));
chapters.push(wordsChapter({ id: 217, unit: 'k-u3', label: 'Words 9', requires: 216, icon: '🤝', title: 'Good Manners', arabicTitle: 'الآدَاب', desc: 'First greetings and polite words every child can use.',
  intro: 'Nine short phrases for everyday good manners. Say <span class="kid-letter-inline">بِسْمِ الله</span> before eating and <span class="kid-letter-inline">الحَمْدُ لله</span> afterwards — the quickest way to make Arabic part of the day.',
  activity: 'use one phrase a day — greet the family with <span class="kid-letter-inline">السَّلَامُ عَلَيْكُم</span> and reply with <span class="kid-letter-inline">وَعَلَيْكُمُ السَّلَام</span>.', words: MANNERS, phrase: true }));
chapters.push(reviewChapter(218, 'k-u3', 'Review 3', 217, 'My World', 'مُرَاجَعَة', 'Family, body, school and the world around me.',
  [FAMILY, BODY, SCHOOL, WORLD]));

const units = [
  { id: 'k-u1', track: 'kids', title: 'Unit 1 — Letters & Their Pictures', desc: 'Each letter gets a picture friend. Say the word, spot the first letter.' },
  { id: 'k-u2', track: 'kids', title: 'Unit 2 — My First Words', desc: 'Colours, numbers, animals and food — all with pictures.' },
  { id: 'k-u3', track: 'kids', title: 'Unit 3 — My World', desc: 'Family, body, school, the world around me, and good manners.' }
];
const track = {
  id: 'kids', short: 'Kids', icon: '🧒', title: 'Arabic for Little Learners (ages 5–8)',
  desc: 'Picture-first Arabic for young children who know the alphabet: every letter with a picture word, then colours, numbers, animals, food, family and first manners. Short screens, lots of tapping and listening, no typing — best done together with a parent.',
  journeyTitle: 'Little Learners', tapToStart: 'Picture-first Arabic for ages 5–8. Sit together: tap 🔊, say it, point at the picture.'
};

/* ---------------------------------------------------------------- self-checks */
const ids = new Set();
chapters.forEach(c => { if (ids.has(c.id)) throw new Error('dup id ' + c.id); ids.add(c.id); });
chapters.forEach(c => (c.exercises || []).forEach(ex => (ex.items || []).forEach(it => {
  if (new Set(it.options).size !== it.options.length) throw new Error(`duplicate options in ${c.id} ${ex.id}: ${it.options.join(' | ')}`);
})));

/* ---------------------------------------------------------------- serialise + splice */
const MARK = (n, s) => `/* >>> KIDS ${n} (generated by scripts/build-kids-track.js — edit there, not here) >>> */`;
const END = n => `/* <<< KIDS ${n} <<< */`;
// Compact serialiser: small flat objects (a vocab word, a quiz item, a pair) stay on one line, like the hand-written data.
const prim = v => v === null || ['string', 'number', 'boolean'].includes(typeof v);
const flatObj = v => v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(x => prim(x) || (Array.isArray(x) && x.every(prim)));
function ser(v, ind) {
  if (prim(v)) return JSON.stringify(v);
  if (Array.isArray(v)) {
    if (v.every(prim)) return '[' + v.map(x => JSON.stringify(x)).join(', ') + ']';
    const inner = ind + '  ';
    return '[\n' + v.map(x => inner + ser(x, inner)).join(',\n') + '\n' + ind + ']';
  }
  if (flatObj(v)) return '{ ' + Object.entries(v).map(([k, x]) => `${k}: ${ser(x, ind)}`).join(', ') + ' }';
  const inner = ind + '  ';
  return '{\n' + Object.entries(v).map(([k, x]) => `${inner}${k}: ${ser(x, inner)}`).join(',\n') + '\n' + ind + '}';
}
const lit = (o, indent) => ser(o, indent);

function removeBlock(text, name) {
  const a = text.indexOf(MARK(name)), b = text.indexOf(END(name));
  if (a === -1) return text;
  // also drop the comma that was inserted just before the marker
  let start = a;
  const before = text.slice(0, a).replace(/,\s*$/, '');
  return before + text.slice(b + END(name).length);
}
function insertBeforeClose(text, arrayStart, name, body) {
  const s = text.indexOf(arrayStart);
  if (s === -1) throw new Error('missing ' + arrayStart);
  const close = text.indexOf('\n];', s);
  const head = text.slice(0, close).replace(/\s+$/, '');
  return head + ',\n  ' + MARK(name) + '\n  ' + body + '\n  ' + END(name) + text.slice(close);
}
src = removeBlock(src, 'UNITS');
src = removeBlock(src, 'TRACK');
src = removeBlock(src, 'CHAPTERS');
src = insertBeforeClose(src, 'const units = [', 'UNITS', units.map(u => lit(u, '  ')).join(',\n  '));
src = insertBeforeClose(src, 'const tracks = [', 'TRACK', lit(track, '  '));
src = insertBeforeClose(src, 'const chapters = [', 'CHAPTERS', chapters.map(c => lit(c, '  ')).join(',\n  '));
fs.writeFileSync(file, src);
console.log(`kids track written: ${chapters.length} chapters, ${units.length} units`);
