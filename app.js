'use strict';
/* ====== Données ====== */
let DB = null;
const $ = s => document.querySelector(s);
const app = () => $('#app');
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[rnd(a.length)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
const famLabel = f => cap(f);

/* ====== Persistance ====== */
const KEY = 'ornitho-quiz-v1';
let S = load();
function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  return Object.assign({ xp: 0, cards: {}, days: [], streak: 0, lastDay: null, todayCount: 0, todayDate: null, goal: 20, stars: {}, best: {}, badges: [], answered: 0, correct: 0, badPhotos: [] }, s || {});
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

/* ====== Rangs (niveaux joueur) ====== */
const RANKS = [
  [0, 'Œuf', '🥚'], [120, 'Poussin', '🐣'], [350, 'Juvénile', '🐥'], [750, 'Premier hiver', '❄️'],
  [1400, 'Deuxième hiver', '🌨️'], [2300, 'Adulte nuptial', '🪶'], [3600, 'Bagueur', '💍'],
  [5300, 'Ornitho confirmé', '🔭'], [7500, 'Référent atlas', '🗺️'], [10500, 'Oracle du MOOC', '🦉']
];
function rank(xp = S.xp) {
  let i = 0; while (i < RANKS.length - 1 && xp >= RANKS[i + 1][0]) i++;
  const cur = RANKS[i], nxt = RANKS[i + 1];
  return { i, name: cur[1], icon: cur[2], lvl: i + 1, from: cur[0], to: nxt ? nxt[0] : null, next: nxt ? nxt[1] : null };
}

/* ====== Répétition espacée (boîtes de Leitner) ====== */
const INTERVAL = [0, 1, 2, 4, 8, 16, 35];
function card(id) { return S.cards[id] || (S.cards[id] = { b: 0, due: today(), n: 0, ok: 0 }); }
function grade(id, ok) {
  const c = card(id); c.n++; if (ok) c.ok++;
  c.b = ok ? Math.min(c.b + 1, INTERVAL.length - 1) : Math.max(0, c.b - 2);
  const d = new Date(); d.setDate(d.getDate() + (ok ? INTERVAL[c.b] : 0)); c.due = d.toISOString().slice(0, 10);
}
const spMastery = sp => { const ids = ['id:' + sp.n, 'crit:' + sp.n, 'fam:' + sp.n, 'chant:' + sp.n, 'sci:' + sp.n]; let t = 0, k = 0; ids.forEach(i => { if (S.cards[i]) { t += S.cards[i].b; k++; } }); return k ? t / k : -1; };

/* ====== Photos réelles : Wikipédia / Wikimedia Commons ====== */
const PKEY = 'ornitho-photos-v1';
let PHOTOS = {}; try { PHOTOS = JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { }
const savePhotos = () => { try { localStorage.setItem(PKEY, JSON.stringify(PHOTOS)); } catch (e) { } };
const BAD_IMG = /\.(svg|gif|tif)$|map|carte|distribution|range|aire|egg|oeuf|œuf|skull|sound|spectro|naumann|gould|audubon|dresser|illustration|drawing|painting|plate|planche|lithograph|museum|specimen|mhnt|stamp/i;
async function wikiBatch(lang, titles) {
  const u = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1&prop=pageimages&piprop=thumbnail|name&pithumbsize=720&titles=` + encodeURIComponent(titles.join('|'));
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 8000);
  const r = await fetch(u, { signal: ac.signal }).finally(() => clearTimeout(to)); if (!r.ok) throw new Error(r.status);
  const j = await r.json(); const out = {};
  const back = {}; (j.query.normalized || []).forEach(n => back[n.to] = n.from);
  const red = {}; (j.query.redirects || []).forEach(n => red[n.to] = n.from);
  (j.query.pages || []).forEach(p => {
    let t = p.title; t = red[t] || t; t = back[t] || t;
    if (p.thumbnail && p.pageimage && !BAD_IMG.test(p.pageimage)) out[t] = { src: p.thumbnail.source, file: p.pageimage, page: `https://${lang}.wikipedia.org/wiki/` + encodeURIComponent(p.title.replace(/ /g, '_')) };
  });
  return out;
}
let photoLoading = null;
async function ensurePhotos(list) {
  const need = list.filter(s => !(s.n in PHOTOS) || !PHOTOS[s.n].length);
  if (!need.length) return;
  if (photoLoading) return photoLoading;
  photoLoading = (async () => {
    for (let i = 0; i < need.length; i += 45) {
      const chunk = need.slice(i, i + 45);
      let fr = {}, en = {}, okFr = false;
      try { fr = await wikiBatch('fr', chunk.map(s => s.n)); okFr = true; } catch (e) { }
      const sci = chunk.filter(s => s.sci);
      try { if (sci.length) en = await wikiBatch('en', sci.map(s => s.sci)); } catch (e) { }
      if (!okFr) continue;
      chunk.forEach(s => {
        const arr = [];
        if (fr[s.n]) arr.push(fr[s.n]);
        if (s.sci && en[s.sci] && (!fr[s.n] || en[s.sci].file !== fr[s.n].file)) arr.push(en[s.sci]);
        PHOTOS[s.n] = arr;
      });
    }
    savePhotos();
  })();
  try { await photoLoading; } finally { photoLoading = null; }
}
function photosOf(sp) { return (PHOTOS[sp.n] || []).filter(p => !S.badPhotos.includes(p.file)); }
const creditCache = {};
async function credit(file) {
  if (creditCache[file]) return creditCache[file];
  try {
    const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&prop=imageinfo&iiprop=extmetadata&titles=' + encodeURIComponent('File:' + file);
    const j = await (await fetch(u)).json();
    const m = j.query.pages[0].imageinfo[0].extmetadata;
    const strip = h => (h || '').replace(/<[^>]*>/g, '').trim();
    return creditCache[file] = `${strip(m.Artist?.value) || 'Auteur inconnu'} · ${strip(m.LicenseShortName?.value) || 'licence libre'}`;
  } catch (e) { return creditCache[file] = 'Wikimedia Commons'; }
}

/* ====== Générateurs de questions ====== */
let LCTX = null; // contexte de leçon : familles de l'unité
const cutTxt = (t, n = 150) => { if (t.length <= n) return t; const c = t.slice(0, n); const k = Math.max(c.lastIndexOf('. '), c.lastIndexOf('; ')); return (k > 60 ? c.slice(0, k + 1).replace(/;$/, '…') : c.slice(0, c.lastIndexOf(' ')) + '…').trim(); };
const words = n => n.toLowerCase().replace(/['’]/g, ' ').split(/[\s-]+/).filter(w => w.length > 3 && !['des', 'europe', 'commun', 'petit', 'petite', 'grand', 'grande'].includes(w));
function mask(text, sp) {
  let t = text;
  const ws = words(sp.n).concat(sp.sci ? sp.sci.toLowerCase().split(' ') : []);
  ws.forEach(w => { t = t.replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*', 'gi'), '▢▢▢'); });
  return t;
}
function distract(sp, pool, k = 3, key = s => s.n) {
  const same = shuffle(pool.filter(s => s.f === sp.f && key(s) !== key(sp)));
  const grp = shuffle(pool.filter(s => s.f !== sp.f && s.grp === sp.grp && key(s) !== key(sp)));
  const cat = shuffle(pool.filter(s => s.grp !== sp.grp && s.cat === sp.cat && key(s) !== key(sp)));
  const out = []; const seen = new Set([key(sp)]);
  for (const s of [...same, ...grp, ...cat]) { if (!seen.has(key(s))) { seen.add(key(s)); out.push(s); } if (out.length >= k) break; }
  return out;
}
const SPECIES = () => DB.sp.filter(s => !/^(Oies|Cygnes|Canards|Carnards|Tadornes|Bernaches)\b/.test(s.n));

const QTYPES = {
  photo: {
    label: 'Qui est-ce ?', icon: '📷',
    ok: sp => photosOf(sp).length > 0,
    make(sp) {
      const ph = pick(photosOf(sp));
      const opts = shuffle([sp, ...distract(sp, SPECIES())]);
      return { id: 'id:' + sp.n, sp, kind: 'photo', img: ph, prompt: 'Quelle espèce ?', hint: `${famLabel(sp.f)} · ${sp.grp}`, opts: opts.map(o => o.n), answer: sp.n };
    }
  },
  crit: {
    label: 'Critères fins', icon: '🔍',
    ok: sp => sp.d && sp.d.length > 25 && !sp.solo,
    make(sp) {
      const opts = shuffle([sp, ...distract(sp, SPECIES().filter(s => s.d))]);
      return { id: 'crit:' + sp.n, sp, kind: 'text', prompt: 'À quelle espèce correspond ce portrait ?', quote: mask(sp.d, sp), opts: opts.map(o => o.n), answer: sp.n };
    }
  },
  chant: {
    label: 'À l\'oreille', icon: '🎶',
    ok: sp => (sp.v && sp.v.length > 20) || hasAud(sp.n),
    make(sp) {
      const pool = SPECIES().filter(s => (s.v && s.v.length > 20) || hasAud(s.n));
      const opts = shuffle([sp, ...distract(sp, pool)]);
      const txt = sp.v && sp.v.length > 20 ? mask(sp.v, sp) : '';
      return { id: 'chant:' + sp.n, sp, kind: 'text', audio: hasAud(sp.n), prompt: txt ? 'Qui chante ainsi ?' : 'Qui chante ainsi ? Écoute.', quote: txt, opts: opts.map(o => o.n), answer: sp.n };
    }
  },
  fam: {
    label: 'Arbre du MOOC', icon: '🌳',
    ok: sp => true,
    make(sp) {
      const fams = DB.fams;
      if (LCTX) { const opts = shuffle([sp.f, ...shuffle(LCTX.fams.filter(x => x !== sp.f)).slice(0, 3)]); const ph = photosOf(sp)[0]; return { id: 'fam:' + sp.n, sp, kind: ph ? 'photo' : 'text', img: ph, prompt: `${sp.n} : quelle famille ?`, opts: opts.map(famLabel), answer: famLabel(sp.f) }; }
      const sameG = shuffle(fams.filter(f => f.grp === sp.grp && f.n !== sp.f));
      const sameC = shuffle(fams.filter(f => f.grp !== sp.grp && f.cat === sp.cat));
      const opts = shuffle([sp.f, ...[...sameG, ...sameC].slice(0, 3).map(f => f.n)]);
      const ph = photosOf(sp)[0];
      return { id: 'fam:' + sp.n, sp, kind: ph ? 'photo' : 'text', img: ph, prompt: `${sp.n} : quelle famille ?`, opts: opts.map(famLabel), answer: famLabel(sp.f) };
    }
  },
  sci: {
    label: 'Latin', icon: '🔬',
    ok: sp => !!sp.sci,
    make(sp) {
      const pool = SPECIES().filter(s => s.sci);
      const opts = shuffle([sp, ...distract(sp, pool, 3, s => s.sci)]);
      return { id: 'sci:' + sp.n, sp, kind: 'text', prompt: `Nom scientifique : ${sp.n} ?`, opts: opts.map(o => o.sci), answer: sp.sci, italic: true };
    }
  },
  grp: {
    label: 'Groupe fonctionnel', icon: '🧭',
    ok: sp => true, famOnly: true,
    make(sp) {
      const f = DB.fams.find(x => x.n === sp.f);
      const groups = [...new Set(DB.fams.filter(x => x.cat === f.cat && x.grp && x.grp !== f.grp).map(x => x.grp))];
      const opts = shuffle([f.grp, ...shuffle(groups).slice(0, 3)]);
      return { id: 'grp:' + f.n, sp, fam: f, kind: 'text', prompt: `${famLabel(f.n)} : quel groupe fonctionnel ?`, quote: f.d ? mask(f.d, { n: f.n }) : '', opts, answer: f.grp };
    }
  },
  famdesc: {
    label: 'Portrait de famille', icon: '👪',
    ok: sp => { const f = DB.fams.find(x => x.n === sp.f); return f && f.d && f.d.length > 20; }, famOnly: true,
    make(sp) {
      const f = DB.fams.find(x => x.n === sp.f);
      const others = shuffle(DB.fams.filter(x => x.n !== f.n && x.d)).sort((a, b) => (b.grp === f.grp) - (a.grp === f.grp) || (b.cat === f.cat) - (a.cat === f.cat));
      const opts = shuffle([f.n, ...others.slice(0, 3).map(x => x.n)]).map(famLabel);
      return { id: 'famdesc:' + f.n, sp, fam: f, kind: 'text', prompt: 'Quelle famille est décrite ici ?', quote: f.d + (f.sp ? ` (${f.sp})` : ''), opts, answer: famLabel(f.n) };
    }
  },
  ref: {
    label: 'Espèce de référence', icon: '⭐',
    ok: sp => { const f = DB.fams.find(x => x.n === sp.f); return f && f.ref && f.ref.length > 2; }, famOnly: true,
    make(sp) {
      const f = DB.fams.find(x => x.n === sp.f);
      const others = shuffle(DB.fams.filter(x => x.n !== f.n && x.ref && x.ref !== f.ref)).sort((a, b) => (b.grp === f.grp) - (a.grp === f.grp));
      const opts = shuffle([f.ref, ...others.slice(0, 3).map(x => x.ref)]);
      return { id: 'ref:' + f.n, sp, fam: f, kind: 'text', prompt: `Espèce de référence du MOOC pour les ${famLabel(f.n)} ?`, opts, answer: f.ref };
    }
  },
  portrait: {
    label: 'Le bon portrait', icon: '🪞',
    ok: sp => sp.d && sp.d.length > 40 && !sp.solo && SPECIES().filter(s => s.n !== sp.n && s.d && s.d.length > 40 && !s.solo && (s.f === sp.f || s.grp === sp.grp)).length >= 3,
    make(sp) {
      const pool = SPECIES().filter(s => s.d && s.d.length > 40 && !s.solo);
      const others = distract(sp, pool);
      const all = shuffle([sp, ...others]);
      const txt = x => cutTxt(mask(x.d, x));
      const ph = photosOf(sp)[0];
      return { id: 'portrait:' + sp.n, sp, kind: 'text', long: true, prompt: `${sp.n} : quel est son portrait ?`, opts: all.map(txt), optSp: all.map(x => x.n), answer: txt(sp) };
    }
  },
  intrus: {
    label: 'L\'intrus', icon: '🚫',
    ok: sp => SPECIES().filter(s => s.f === sp.f).length >= 3 && (!LCTX || SPECIES().some(s => s.f !== sp.f && LCTX.fams.includes(s.f))), famOnly: true,
    make(sp) {
      const fam = shuffle(SPECIES().filter(s => s.f === sp.f)).slice(0, 3);
      const out = LCTX ? shuffle(SPECIES().filter(s => s.f !== sp.f && LCTX.fams.includes(s.f)))[0] : shuffle(SPECIES().filter(s => s.f !== sp.f && s.grp === sp.grp)).concat(shuffle(SPECIES().filter(s => s.f !== sp.f && s.cat === sp.cat)))[0];
      const opts = shuffle([...fam, out]);
      return { id: 'intrus:' + sp.f, sp: out, kind: 'text', prompt: `Trois sont des ${famLabel(sp.f)}. Lequel est l'intrus ?`, opts: opts.map(o => o.n), answer: out.n, intrusFam: sp.f };
    }
  }
};

/* ====== Construction d'une session ====== */
function poolFor(filter) { return SPECIES().filter(s => !filter || filter(s)); }
function buildSession(opts) {
  const { types, n = 10, filter } = opts;
  const pool = poolFor(filter);
  const cand = [];
  pool.forEach(sp => types.forEach(t => { const T = QTYPES[t]; if (T.ok(sp)) cand.push({ t, sp }); }));
  const pref = t => t === 'photo' ? 'id' : t;
  const idOf = c => (QTYPES[c.t].famOnly ? pref(c.t) + ':' + c.sp.f : pref(c.t) + ':' + c.sp.n);
  const seen = new Set(); const uniq = cand.filter(c => { const k = idOf(c); if (seen.has(k)) return false; seen.add(k); return true; });
  const t0 = today();
  const due = shuffle(uniq.filter(c => S.cards[idOf(c)] && S.cards[idOf(c)].due <= t0)).sort((a, b) => S.cards[idOf(a)].b - S.cards[idOf(b)].b);
  const fresh = shuffle(uniq.filter(c => !S.cards[idOf(c)]));
  const later = shuffle(uniq.filter(c => S.cards[idOf(c)] && S.cards[idOf(c)].due > t0));
  const nDue = Math.min(due.length, Math.ceil(n * .6));
  let chosen = [...due.slice(0, nDue), ...fresh.slice(0, n - nDue)];
  if (chosen.length < n) chosen = chosen.concat(due.slice(nDue), later).slice(0, n);
  return shuffle(chosen).map(c => QTYPES[c.t].make(c.sp));
}

function buildMixed(mix, filter) {
  let out = [];
  mix.forEach(([types, k]) => { out = out.concat(buildSession({ types, n: k, filter })); });
  const n = mix.reduce((a, m) => a + m[1], 0);
  if (out.length < n) { const seen = new Set(out.map(q => q.id)); out = out.concat(buildSession({ types: ['crit', 'chant'], n: n * 2, filter }).filter(q => !seen.has(q.id)).slice(0, n - out.length)); }
  return shuffle(out);
}
/* ====== Modes de jeu ====== */
const MODES = {
  daily: { title: 'Session du jour', icon: '🎯', desc: 'Révision espacée : photos, critères, chants', mix: [[['photo'], 4], [['crit'], 3], [['chant'], 2], [['fam', 'grp', 'famdesc', 'ref', 'intrus', 'sci'], 1]], photos: true },
  sosies: { title: 'Sosies', icon: '', desc: 'Oiseaux qui se ressemblent : le critère qui tranche', special: 'sosies' },
  photo: { title: 'Qui est-ce ?', icon: '📷', desc: 'Vraies photos, espèces proches en piège', types: ['photo'], n: 10, photos: true },
  crit: { title: 'Critères fins', icon: '🔍', desc: 'Retrouver l\'espèce à partir de tes fiches', types: ['crit'], n: 10 },
  chant: { title: 'À l\'oreille', icon: '🎶', desc: 'Descriptions de chants et cris', types: ['chant'], n: 8 },
  tree: { title: 'Arbre du MOOC', icon: '🌳', desc: 'Catégorie → groupe → famille → espèce', types: ['fam', 'grp', 'famdesc', 'ref'], n: 10, photos: true },
  intrus: { title: 'L\'intrus', icon: '🚫', desc: 'Repérer l\'espèce hors famille', types: ['intrus'], n: 8 },
  sci: { title: 'Latin', icon: '🔬', desc: 'Noms scientifiques', types: ['sci'], n: 10 },
  blitz: { title: 'Contre-la-montre', icon: '⚡', desc: '60 secondes, combos multiplicateurs', special: 'blitz' },
  pairs: { title: 'Paires', icon: '🧩', desc: 'Associer espèce et famille ou latin', special: 'pairs' },
  path: { title: 'Du groupe à l\'espèce', icon: '🪜', desc: 'Une photo, quatre étages de classification', special: 'path' },
  etho: { title: 'Éthologie', icon: '', desc: 'Les notions du pack 5, toutes unités', special: 'etho' }
};

const SEARCH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M15 15l6 6"/></svg>';
const ICONS = (() => {
  const w = d => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">${d}</svg>`;
  const r = 'style="stroke:var(--ic-accent,var(--red))"';
  return {
    sosies: w(`<circle cx="11" cy="16" r="7"/><circle cx="21" cy="16" r="7" ${r}/>`),
    photo: w(`<rect x="3" y="8" width="26" height="19"/><path d="M11 8l2-4h6l2 4"/><circle cx="16" cy="17" r="5" ${r}/>`),
    crit: w(`<circle cx="13" cy="13" r="8"/><path d="M19 19l9 9" ${r}/>`),
    chant: w(`<path d="M4 16h3M10 10v12M15 6v20M20 11v10M25 14v4" /><path d="M28 16h1" ${r}/>`),
    tree: w(`<path d="M16 4v8M16 12L7 20M16 12l9 8M7 20v8M25 20v8M16 12v16"/><rect x="13" y="2" width="6" height="4" ${r}/>`),
    intrus: w(`<circle cx="8" cy="10" r="3"/><circle cx="24" cy="10" r="3"/><circle cx="8" cy="23" r="3"/><path d="M20 19l8 8M28 19l-8 8" ${r}/>`),
    sci: w(`<path d="M9 26L15 6h2l6 20M11 19h10"/><path d="M5 28h22" ${r}/>`),
    blitz: w(`<circle cx="16" cy="18" r="11"/><path d="M16 11v7l4 3" ${r}/><path d="M13 3h6"/>`),
    pairs: w(`<rect x="3" y="5" width="11" height="15"/><rect x="18" y="12" width="11" height="15" ${r}/>`),
    path: w(`<path d="M6 28V20h7v-6h7V8h7"/><path d="M27 4v6" ${r}/>`),
    etho: w(`<path d="M4 20c2 6 22 6 24 0"/><path d="M4 20h24"/><ellipse cx="16" cy="13" rx="5" ry="6.5" ${r}/>`),
    migr: w(`<path d="M4 24c6-10 14-14 24-16"/><path d="M21 5l7 3-4 6" ${r}/>`)
  };
})();
/* ====== Récompenses ====== */
function addXP(n) {
  const before = rank().lvl; S.xp += n; const after = rank().lvl;
  const t = today();
  if (S.todayDate !== t) { S.todayDate = t; S.todayCount = 0; }
  if (S.lastDay !== t) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    S.streak = (S.lastDay === y.toISOString().slice(0, 10)) ? S.streak + 1 : 1;
    S.lastDay = t;
  }
  save();
  if (after > before) setTimeout(() => toast(`Nouveau rang : ${rank().name}`, true), 400);
}
function toast(msg, big) {
  const el = document.createElement('div'); el.className = 'toast' + (big ? ' big' : ''); el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.classList.add('on'), 10);
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 400); }, big ? 2600 : 1600);
}
function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } }
const BADGES = [
  ['first', '🌱', 'Premier envol', 'Terminer une session', s => s.sessions >= 1],
  ['streak3', '🔥', 'Fidèle', '3 jours de suite', s => S.streak >= 3],
  ['streak7', '📅', 'Assidu', '7 jours de suite', s => S.streak >= 7],
  ['perfect', '💯', 'Sans faute', 'Session parfaite', s => s.perfect],
  ['blitz15', '⚡', 'Éclair', '15 bonnes réponses en contre-la-montre', s => (S.best.blitz || 0) >= 15],
  ['hundred', '🪶', 'Cent plumes', '100 bonnes réponses', s => S.correct >= 100],
  ['thousand', '🦅', 'Mille plumes', '1.000 bonnes réponses', s => S.correct >= 1000],
  ['allstars', '🌟', 'Chapitres', '3 étoiles sur 5 chapitres', s => Object.values(S.stars).filter(v => v >= 3).length >= 5]
];
function checkBadges(ctx) {
  if (ctx && ctx.endSession) syncSoon();
  S.sessions = (S.sessions || 0) + (ctx.endSession ? 1 : 0);
  const c = Object.assign({ sessions: S.sessions }, ctx);
  BADGES.forEach(([id, ic, name, , test]) => { if (!S.badges.includes(id) && test(c)) { S.badges.push(id); setTimeout(() => toast(`${ic} Badge : ${name}`, true), 900); } });
  save();
}

/* ====== Écran d'accueil ====== */
function home() { pathHome(); }
function training() {
  const r = rank();
  const pct = r.to ? Math.round((S.xp - r.from) / (r.to - r.from) * 100) : 100;
  const t = today(); const done = S.todayDate === t ? S.todayCount : 0;
  const goalPct = Math.min(100, Math.round(done / S.goal * 100));
  const dueN = Object.values(S.cards).filter(c => c.due <= t).length;
  const groups = chapters();
  app().innerHTML = `
  ${appTop()}<div class="top"><h1>Entraînement</h1></div>
  <section class="goal">
    <div class="ring" style="--p:${goalPct}"><span>${done}/${S.goal}</span></div>
    <div><b>Objectif du jour</b><br><span class="muted">${dueN} révision${dueN > 1 ? 's' : ''} en attente</span></div>
    <button class="btn primary" data-mode="daily">Jouer</button>
  </section>
  <button class="homesearch" data-go="carnet">${SEARCH_SVG}<span>Rechercher un oiseau…</span></button>
  <h2>Jeux</h2>
  <div class="tiles">${Object.entries(MODES).filter(([k]) => k !== 'daily').map(([k, m]) => `
    <button class="tile" data-mode="${k}"><span class="ti">${ICONS[k] || ""}</span><b>${m.title}</b><small>${m.desc}</small>${S.best[k] ? `<em>Record ${S.best[k]}</em>` : ''}</button>`).join('')}
  </div>
  <h2>Chapitres du MOOC</h2>
  <p class="muted small">Chaque chapitre a trois niveaux : ★ familles, ★★ espèces sur photo, ★★★ critères fins et chants. 80 % pour décrocher l'étoile.</p>
  ${['Non-Passereau', 'Passereau'].map(cat => `<h3>${cat}x</h3><div class="chapters">${groups.filter(g => g.cat === cat).map(g => `
    <button class="chap" data-chap="${esc(g.grp)}"><span>${esc(g.grp)}</span><span class="stars">${'★'.repeat(S.stars[g.grp] || 0)}<i>${'☆'.repeat(3 - (S.stars[g.grp] || 0))}</i></span><small>${g.n} esp. · maîtrise ${g.m}%</small><span class="mbar"><i style="width:${g.m}%"></i></span></button>`).join('')}</div>`).join('')}

  <p class="foot muted small">${DB.sp.length} espèces et ${DB.fams.length} familles issues de ta base Notion « Mooc Ornitho database » (synchro du ${esc(DB.synced)}). Photos : Wikipédia / Wikimedia Commons.</p>${navBar('train')}`;
  bindNav();
  app().querySelectorAll('[data-mode]').forEach(b => b.onclick = () => startMode(b.dataset.mode));
  app().querySelectorAll('[data-chap]').forEach(b => b.onclick = () => chapterScreen(b.dataset.chap));
  app().querySelectorAll('[data-go]').forEach(b => b.onclick = () => ({ carnet, badges: badgesScreen, settings })[b.dataset.go]());
  window.scrollTo(0, 0);
}
function chapters() {
  const m = {};
  SPECIES().forEach(s => { (m[s.grp] = m[s.grp] || { grp: s.grp, cat: s.cat, n: 0, tot: 0 }); m[s.grp].n++; const v = spMastery(s); m[s.grp].tot += v < 0 ? 0 : v; });
  return Object.values(m).map(g => Object.assign(g, { m: Math.round(g.tot / (g.n * 4) * 100) > 100 ? 100 : Math.round(g.tot / (g.n * 4) * 100) })).sort((a, b) => b.n - a.n);
}
function chapterScreen(grp) {
  const st = S.stars[grp] || 0;
  const sp = SPECIES().filter(s => s.grp === grp);
  const fams = [...new Set(sp.map(s => s.f))];
  const lv = [
    { k: 1, t: 'Niveau 1 · Familles', d: 'Groupe, famille, espèce de référence', types: ['fam', 'grp', 'famdesc', 'ref', 'intrus'] },
    { k: 2, t: 'Niveau 2 · Espèces', d: 'Reconnaître sur photo', mix: [[['photo'], 8], [['crit'], 2]], photos: true },
    { k: 3, t: 'Niveau 3 · Critères fins', d: 'Portraits et chants', mix: [[['crit'], 5], [['chant'], 3], [['photo'], 2]], photos: true }
  ];
  app().innerHTML = `<div class="top"><button class="back">‹</button><h1>${esc(grp)}</h1></div>
  <p class="muted">${sp[0]?.cat || ''} · ${fams.map(famLabel).join(', ')}</p>
  <div class="levels">${lv.map(l => `<button class="level ${l.k > st + 1 ? 'locked' : ''} ${l.k <= st ? 'done' : ''}" data-l="${l.k}">
    <b>${l.k <= st ? '★' : l.k > st + 1 ? '🔒' : '☆'} ${l.t}</b><small>${l.d}</small></button>`).join('')}</div>
  <h2>Espèces du chapitre</h2>
  <div class="splist">${sp.map(s => spRow(s)).join('')}</div>`;
  app().querySelector('.back').onclick = training;
  app().querySelectorAll('.level').forEach(b => b.onclick = () => {
    const l = lv[+b.dataset.l - 1];
    if (l.k > st + 1) { toast('Décroche d\'abord le niveau précédent'); return; }
    runQuiz({ title: `${grp} · ${l.t.split('·')[1].trim()}`, types: l.types, mix: l.mix, n: 10, filter: s => s.grp === grp, photos: l.photos, chapter: grp, level: l.k });
  });
  bindRows();
}
function spRow(s) {
  const m = spMastery(s); const dots = m < 0 ? '<span class="dot new">nouveau</span>' : `<span class="dots">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i < Math.round(m) ? 'on' : ''}"></i>`).join('')}</span>`;
  return `<button class="sprow" data-sp="${esc(s.n)}"><span><b>${esc(s.n)}</b>${s.sci ? ` <i>${esc(s.sci)}</i>` : ''}<br><small>${famLabel(s.f)}</small></span>${dots}</button>`;
}
function bindRows() { app().querySelectorAll('[data-sp]').forEach(b => b.onclick = () => fiche(DB.sp.find(s => s.n === b.dataset.sp))); }

function path(sp) {
  return `<div class="path"><span>${esc(sp.cat)}</span><b>›</b><span>${esc(sp.grp)}</span><b>›</b><span>${famLabel(sp.f)}</span>${sp.sub ? `<b>›</b><span>${esc(sp.sub)}</span>` : ''}</div>`;
}
async function showPhoto(el, ph, sp, hideCredit) {
  if (!el) return;
  if (!ph) { el.innerHTML = `<div class="pframe"><div class="ph-none">Pas de photo disponible${navigator.onLine ? '' : ' (hors ligne)'}</div></div>`; return; }
  el.innerHTML = `<div class="pframe"><img class="pbg" src="${esc(ph.src)}" alt="" aria-hidden="true"><img class="pfg" src="${esc(ph.src)}" alt="" loading="eager"></div><div class="credit">${hideCredit ? '' : '…'}</div>`;
  const img = el.querySelector('.pfg');
  img.onerror = () => { el.innerHTML = '<div class="pframe"><div class="ph-none">Photo indisponible hors ligne</div></div>'; };
  if (!hideCredit) fillCredit(el, ph, sp);
}
async function fillCredit(el, ph, sp) {
  const c = await credit(ph.file);
  const cr = el.querySelector('.credit');
  if (cr) cr.innerHTML = `📷 ${esc(c)} · <a href="${esc(ph.page)}" target="_blank" rel="noopener">source</a> · <button class="link" data-bad>photo inadaptée ?</button>`;
  const b = el.querySelector('[data-bad]'); if (b) b.onclick = () => { S.badPhotos.push(ph.file); save(); toast('Photo écartée, elle ne sera plus proposée'); b.remove(); };
}

/* ====== Moteur de quiz ====== */
async function startMode(k) {
  const m = MODES[k];
  if (m.special === 'sosies') return sosHome();
  if (m.special === 'blitz') return blitz();
  if (m.special === 'pairs') return pairs();
  if (m.special === 'path') return pathGame();
  if (m.special === 'etho') return startLesson(ethoFreeUnit(), { id: 'efree', t: 'efree', free: true }, false);
  if (m.special === 'migr') return startLesson(ethoFreeUnit(), { id: 'statut', t: 'statut', free: true }, false);
  runQuiz({ title: m.title, types: m.types, n: m.n, mix: m.mix, photos: m.photos, mode: k });
}
const waitPhotos = list => Promise.race([ensurePhotos(list).catch(() => { }), new Promise(r => setTimeout(r, 9000))]);
async function loadingScreen(msg) {
  app().innerHTML = `<div class="loadsk" aria-busy="true"><p class="eyebrow">${esc(msg)}</p><div class="skeleton ph"></div><div class="skeleton" style="width:70%"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
}
async function runQuiz(cfg) {
  if (cfg.photos) { await loadingScreen('Je cherche les photos…'); await waitPhotos(poolFor(cfg.filter)); }
  const qs = (cfg.mix ? buildMixed(cfg.mix, cfg.filter) : buildSession(cfg)).filter(Boolean);
  if (!qs.length) { toast(cfg.photos ? 'Photos indisponibles : vérifie la connexion' : 'Pas assez de matière pour ce jeu'); return training(); }
  let i = 0, score = 0, combo = 0, xpGain = 0; const missed = [];
  const next = () => {
    if (i >= qs.length) return endQuiz(cfg, score, qs.length, xpGain, missed);
    const q = qs[i];
    renderQ(q, { idx: i, total: qs.length, title: cfg.title, combo }, ok => {
      grade(q.id, ok); S.answered++;
      if (ok) { score++; combo++; S.correct++; const g = 10 + Math.min(combo - 1, 5) * 2; xpGain += g; addXP(g); }
      else { combo = 0; missed.push(q.sp); addXP(1); }
      S.todayCount = (S.todayDate === today() ? S.todayCount : 0) + 1; S.todayDate = today(); save();
    }, () => { i++; next(); }, () => training());
  };
  next();
}
function renderQ(q, st, onAnswer, onNext, onQuit, timed) {
  const prog = Math.round(st.idx / st.total * 100);
  app().innerHTML = `
  <div class="qtop"><button class="back" aria-label="Quitter">✕</button><div class="bar thin"><i style="width:${prog}%"></i></div>${st.combo > 1 ? `<span class="combo">×${st.combo}</span>` : `<span class="combo ghost">${st.idx + 1}/${st.total}</span>`}</div>
  ${timed || ''}
  <div class="q">
    ${q.kind === 'photo' ? `<div class="photo-wrap q-ph" id="qph"></div>` : ''}
    <p class="prompt">${esc(q.prompt)}</p>
    ${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ''}
    ${q.quote ? `<blockquote>${esc(q.quote)}</blockquote>` : ''}
    ${q.audio ? `<button class="play big" data-aud="${esc(q.sp.n)}"><i></i>Écouter le chant</button>` : ''}
    <div class="opts">${q.opts.map((o, k) => `<button class="opt ${q.italic ? 'it' : ''} ${q.long ? 'long' : ''}" data-k="${k}">${esc(o)}</button>`).join('')}</div>
    <div id="fb"></div>
  </div>`;
  app().querySelector('.back').onclick = () => { stopAudio(); onQuit(); };
  if (q.kind === 'photo') showPhoto($('#qph'), q.img, q.sp, true);
  let done = false;
  app().querySelectorAll('.opt').forEach(b => b.onclick = () => {
    if (done) return; done = true;
    const val = q.opts[+b.dataset.k]; const ok = val === q.answer;
    app().querySelectorAll('.opt').forEach(x => { if (q.opts[+x.dataset.k] === q.answer) x.classList.add('good'); else if (x === b) x.classList.add('bad'); else x.classList.add('dim'); });
    vibrate(ok ? 15 : [30, 40, 30]);
    onAnswer(ok, val);
    feedback(q, ok, onNext, timed, val);
  });
  window.scrollTo(0, 0);
}
function feedback(q, ok, onNext, timed, chosen) {
  const sp = q.sp;
  const fb = $('#fb');
  if (timed && ok) { setTimeout(onNext, 350); return; }
  if (timed) {
    fb.innerHTML = `<div class="fbcard ko"><div class="fbh">✗ C'était ${esc(q.answer)}</div>${whyWrong(q, chosen)}<p class="small muted">Chrono en pause.</p><button class="btn primary wide" id="nx">Continuer</button></div>`;
    $('#nx').onclick = onNext; setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50); return;
  }
  const praise = ok ? pick(['Bien vu !', 'Exact.', 'Parfait.', 'Œil de lynx.', 'Oui !', 'Bonne identification.']) : pick(['Pas tout à fait.', 'Raté, mais retenu.', 'Non.']);
  let body = '';
  const why = ok ? '' : whyWrong(q, chosen);
  if (q.sosie) body = q.explain(chosen, ok);
  else if (q.intrusFam) body = `<p><b>${esc(sp.n)}</b> appartient aux ${famLabel(sp.f)}, pas aux ${famLabel(q.intrusFam)}.</p>`;
  else if (q.fam) body = `<p><b>${famLabel(q.fam.n)}</b> · ${esc(q.fam.grp)} · ${esc(q.fam.cat)}</p>${q.fam.d && q.id.startsWith('grp') ? '' : ''}${q.fam.ref ? `<p class="small">Espèce de référence : ${esc(q.fam.ref)}</p>` : ''}${q.fam.sp ? `<p class="small muted">${esc(q.fam.sp)}</p>` : ''}`;
  else body = `<p><b>${esc(sp.n)}</b>${sp.sci ? ` <i>${esc(sp.sci)}</i>` : ''}</p>${path(sp)}${sp.d && !sp.solo && !q.id.startsWith('crit') ? `<p class="small">${esc(sp.d)}</p>` : ''}${q.id.startsWith('crit') ? `<p class="small">${esc(sp.d)}</p>` : ''}${q.id.startsWith('chant') && sp.xc[0] && !hasAud(sp.n) ? `<a class="btn small" target="_blank" rel="noopener" href="${esc(sp.xc[0])}">▶ Écouter sur xeno-canto</a>` : ''}`;
  let phBlock = '';
  const spAns = !q.fam && !q.intrusFam && !q.id.startsWith('sci');
  const cN = q.optSp ? q.optSp[q.opts.indexOf(chosen)] : chosen, aN = q.optSp ? q.sp.n : q.answer;
  if (q.sosie && q.pairNames) phBlock = q.kind === 'reflex' || ok ? photoSwitch(q.pairNames.map(n => ({ label: n, ph: phOf(n) }))) : wrongRightSwitch(chosen, q.answer, false);
  else if (!ok && spAns && phOf(cN)) phBlock = wrongRightSwitch(cN, aN, q.kind === 'photo');
  else if (q.kind !== 'photo' && spAns) phBlock = `<div class="photo-wrap small" id="fbph"></div>`;
  fb.innerHTML = `<div class="fbcard ${ok ? 'ok' : 'ko'}"><div class="fbh">${ok ? '✓' : '✗'} ${praise}</div>
    ${why}
    ${q.sosie ? body : ''}
    ${phBlock}
    ${q.sosie ? '' : body}
    ${spAns && !q.sosie ? listenPair(cN, aN, ok) : ''}
    ${q.sosie && q.pairNames ? `<div class="listen"><small>Écouter</small>${q.pairNames.map(n => audBtn(n, n)).join('')}</div>`.replace('<div class="listen"><small>Écouter</small></div>', '') : ''}
    <button class="btn primary wide" id="nx">Continuer</button></div>`;
  if (q.kind === 'photo' && q.img) { const w = $('#qph'); fillCredit(w, q.img, sp); }
  if ($('#fbph')) waitPhotos([sp]).then(() => showPhoto($('#fbph'), photosOf(sp)[0], sp));
  $('#nx').onclick = () => { stopAudio(); onNext(); };
  setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}
function endQuiz(cfg, score, total, xp, missed) {
  const pct = Math.round(score / total * 100);
  let star = '';
  if (cfg.chapter && pct >= 80 && (S.stars[cfg.chapter] || 0) < cfg.level) { S.stars[cfg.chapter] = cfg.level; star = `<div class="newstar">${'★'.repeat(cfg.level)}<br><small>Niveau ${cfg.level} décroché</small></div>`; xp += 50; addXP(50); }
  const key = cfg.mode || (cfg.chapter ? null : null);
  if (key && (!S.best[key] || pct > parseInt(S.best[key]))) S.best[key] = pct + ' %';
  checkBadges({ endSession: true, perfect: score === total && total >= 8 });
  save();
  const uniq = [...new Map(missed.map(s => [s.n, s])).values()];
  app().innerHTML = `<div class="end">
    <div class="big">${pct >= 90 ? 'Excellent' : pct >= 70 ? 'Très bien' : pct >= 50 ? 'Correct' : 'À revoir'}</div>
    <h1>${score} / ${total}</h1>
    <p class="muted">${esc(cfg.title)} · +${xp} XP</p>
    ${star}
    ${cfg.chapter && pct < 80 ? `<p class="small">Encore ${Math.ceil(total * .8) - score} bonne${Math.ceil(total * .8) - score > 1 ? 's' : ''} réponse${Math.ceil(total * .8) - score > 1 ? 's' : ''} pour l'étoile.</p>` : ''}
    ${uniq.length ? `<h2>À revoir</h2><div class="splist">${uniq.map(spRow).join('')}</div>` : '<p>Aucune erreur.</p>'}
    <div class="row2"><button class="btn" id="home">Entraînement</button><button class="btn primary" id="again">Rejouer</button></div></div>`;
  $('#home').onclick = training; $('#again').onclick = () => runQuiz(cfg);
  bindRows();
}

/* ====== Contre-la-montre ====== */
async function blitz() {
  await loadingScreen('Je cherche les photos…'); await waitPhotos(SPECIES());
  const types = ['photo', 'photo', 'photo', 'crit', 'crit', 'chant', 'fam'];
  let end = Date.now() + 60000, score = 0, combo = 0, xp = 0, total = 0, timer, paused = null;
  const next = () => {
    if (paused) { end += Date.now() - paused; paused = null; }
    if (Date.now() >= end) return finish();
    const sp = pick(SPECIES()); const t = pick(types.filter(t => QTYPES[t].ok(sp)));
    const q = QTYPES[t].make(sp); total++;
    const bar = `<div class="timer"><i id="tbar"></i><span id="tsec"></span><b>${score} pts</b></div>`;
    renderQ(q, { idx: total - 1, total: total, title: 'Blitz', combo }, ok => {
      if (ok) { combo++; const pts = Math.min(combo, 5); score += pts; xp += 3 + pts; S.correct++; }
      else { combo = 0; end -= 3000; paused = Date.now(); }
      grade(q.id, ok); S.answered++;
    }, next, () => { clearInterval(timer); training(); }, bar);
  };
  const tick = () => { if (paused) return; const left = Math.max(0, end - Date.now()); const b = $('#tbar'), s = $('#tsec'); if (b) b.style.width = (left / 600) + '%'; if (s) s.textContent = Math.ceil(left / 1000) + ' s'; if (left <= 0) { clearInterval(timer); finish(); } };
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true; clearInterval(timer); addXP(xp);
    const best = parseInt(S.best.blitz || 0); const rec = score > best; if (rec) S.best.blitz = score;
    checkBadges({ endSession: true }); save();
    app().innerHTML = `<div class="end"><div class="big">Contre-la-montre</div><h1>${score} points</h1><p class="muted">${total} questions · +${xp} XP</p>${rec ? '<p class="newstar">Nouveau record !</p>' : `<p class="muted">Record : ${best}</p>`}
    <p class="small muted">Combo : chaque bonne réponse vaut 1 à 5 points selon la série. Une erreur coûte 3 secondes.</p>
    <div class="row2"><button class="btn" id="home">Entraînement</button><button class="btn primary" id="again">Rejouer</button></div></div>`;
    $('#home').onclick = training; $('#again').onclick = blitz;
  };
  timer = setInterval(tick, 200); next();
}

/* ====== Paires (memory) ====== */
function pairs() {
  const variant = pick(['fam', 'sci', 'fam']);
  let pool = SPECIES().filter(s => variant === 'sci' ? s.sci : true);
  const chosen = []; const usedF = new Set();
  for (const s of shuffle(pool)) { const k = variant === 'fam' ? s.f : s.sci; if (!usedF.has(k)) { usedF.add(k); chosen.push(s); } if (chosen.length === 6) break; }
  const cards = shuffle(chosen.flatMap((s, i) => [{ i, t: s.n, kind: 'sp' }, { i, t: variant === 'fam' ? famLabel(s.f) : s.sci, kind: variant }]));
  let sel = null, found = 0, errors = 0; const t0 = Date.now();
  app().innerHTML = `<div class="qtop"><button class="back">✕</button><b>Paires · ${variant === 'fam' ? 'espèce ↔ famille' : 'espèce ↔ latin'}</b><span class="combo ghost" id="err">0 erreur</span></div>
  <div class="pairs">${cards.map((c, k) => `<button class="pc ${c.kind}" data-k="${k}">${esc(c.t)}</button>`).join('')}</div>`;
  app().querySelector('.back').onclick = training;
  app().querySelectorAll('.pc').forEach(b => b.onclick = () => {
    const c = cards[+b.dataset.k]; if (b.classList.contains('found')) return;
    if (!sel) { sel = b; b.classList.add('sel'); return; }
    if (sel === b) { b.classList.remove('sel'); sel = null; return; }
    const c0 = cards[+sel.dataset.k];
    if (c0.i === c.i && c0.kind !== c.kind) { [sel, b].forEach(x => { x.classList.remove('sel'); x.classList.add('found'); }); found++; vibrate(15); grade((variant === 'fam' ? 'fam:' : 'sci:') + chosen[c.i].n, true); }
    else { const spc = [c0, c].find(x => x.kind === 'sp'); if (spc && c0.kind !== c.kind) { const S0 = chosen[spc.i]; toast(variant === 'fam' ? `${S0.n} : ${famLabel(S0.f)}` : `${S0.n} : ${S0.sci}`); } errors++; $('#err').textContent = errors + ' erreur' + (errors > 1 ? 's' : ''); [sel, b].forEach(x => x.classList.add('shake')); const a = sel; setTimeout(() => { a.classList.remove('sel', 'shake'); b.classList.remove('shake'); }, 450); vibrate([30, 40, 30]); }
    sel = null;
    if (found === 6) {
      const sec = Math.round((Date.now() - t0) / 1000); const xp = Math.max(20, 70 - errors * 8 - Math.floor(sec / 6));
      addXP(xp); S.correct += 6; const best = S.best.pairs; if (!best || sec < parseInt(best)) S.best.pairs = sec + ' s'; checkBadges({ endSession: true }); save();
      setTimeout(() => {
        app().innerHTML = `<div class="end"><div class="big">Paires</div><h1>${sec} s</h1><p class="muted">${errors} erreur${errors > 1 ? 's' : ''} · +${xp} XP</p>
        <div class="splist">${chosen.map(spRow).join('')}</div>
        <div class="row2"><button class="btn" id="home">Entraînement</button><button class="btn primary" id="again">Rejouer</button></div></div>`;
        $('#home').onclick = training; $('#again').onclick = pairs; bindRows();
      }, 500);
    }
  });
}

/* ====== Le chemin : 4 étages sur une photo ====== */
async function pathGame() {
  await loadingScreen('Je cherche les photos…'); await waitPhotos(SPECIES());
  const withPh = SPECIES().filter(s => photosOf(s).length);
  if (!withPh.length) { toast('Photos indisponibles hors ligne'); return training(); }
  let round = 0, pts = 0; const ROUNDS = 5;
  const play = () => {
    if (round >= ROUNDS) return fin();
    const sp = pick(withPh); const ph = pick(photosOf(sp));
    const steps = [
      { p: 'Passereau ou non ?', opts: ['Passereau', 'Non-Passereau'], a: sp.cat },
      { p: 'Groupe fonctionnel ?', opts: shuffle([sp.grp, ...shuffle([...new Set(DB.fams.filter(f => f.cat === sp.cat && f.grp !== sp.grp).map(f => f.grp))]).slice(0, 3)]), a: sp.grp },
      { p: 'Famille ?', opts: shuffle([sp.f, ...shuffle(DB.fams.filter(f => f.grp === sp.grp && f.n !== sp.f)).concat(shuffle(DB.fams.filter(f => f.cat === sp.cat && f.grp !== sp.grp))).slice(0, 3).map(f => f.n)]).map(famLabel), a: famLabel(sp.f) },
      { p: 'Espèce ?', opts: shuffle([sp, ...distract(sp, SPECIES())]).map(s => s.n), a: sp.n }
    ];
    let k = 0;
    const step = () => {
      const s = steps[k];
      app().innerHTML = `<div class="qtop"><button class="back">✕</button><div class="ladder">${steps.map((_, j) => `<i class="${j < k ? 'on' : j === k ? 'cur' : ''}"></i>`).join('')}</div><span class="combo ghost">${round + 1}/${ROUNDS}</span></div>
      <div class="q"><div class="photo-wrap q-ph" id="qph"></div><p class="prompt">${s.p}</p>
      <div class="path small">${steps.slice(0, k).map(x => `<span>${esc(x.a)}</span>`).join('<b>›</b>')}</div>
      <div class="opts">${s.opts.map((o, j) => `<button class="opt" data-j="${j}">${esc(o)}</button>`).join('')}</div><div id="fb"></div></div>`;
      app().querySelector('.back').onclick = training;
      showPhoto($('#qph'), ph, sp, true);
      let done = false;
      app().querySelectorAll('.opt').forEach(b => b.onclick = () => {
        if (done) return; done = true; const ok = s.opts[+b.dataset.j] === s.a;
        app().querySelectorAll('.opt').forEach(x => { if (s.opts[+x.dataset.j] === s.a) x.classList.add('good'); else if (x === b) x.classList.add('bad'); else x.classList.add('dim'); });
        vibrate(ok ? 15 : [30, 40, 30]);
        if (ok) { pts += (k + 1) * 3; k++; if (k < 4) return setTimeout(step, 450); grade('id:' + sp.n, true); grade('fam:' + sp.n, true); }
        else { if (k >= 2) grade(k === 2 ? 'fam:' + sp.n : 'id:' + sp.n, false); }
        const fb = $('#fb');
        const chosenP = s.opts[+b.dataset.j]; const F = DB.fams.find(f => f.n === sp.f);
        const whyP = ok ? '' : k === 0 ? `<p class="why">${esc(sp.n)} est un <b>${esc(sp.cat)}</b>, pas un ${esc(chosenP)}.</p>` : whyWrong({ id: ['', 'grp', 'fam', 'id'][k] + ':x', sp, fam: F, answer: s.a }, chosenP);
        fb.innerHTML = `<div class="fbcard ${ok ? 'ok' : 'ko'}"><div class="fbh">${ok ? '✓ Chemin complet' : `✗ Arrêt à l'étage ${k + 1}`}</div>${whyP}${!ok && k === 3 ? wrongRightSwitch(chosenP, sp.n, true) : ''}<p><b>${esc(sp.n)}</b>${sp.sci ? ` <i>${esc(sp.sci)}</i>` : ''}</p>${path(sp)}<button class="btn primary wide" id="nx">Continuer</button></div>`;
        fillCredit($('#qph'), ph, sp);
        $('#nx').onclick = () => { round++; play(); };
      });
    };
    step();
  };
  const fin = () => {
    addXP(pts); const best = parseInt(S.best.path || 0); if (pts > best) S.best.path = pts + ' pts'; checkBadges({ endSession: true }); save();
    app().innerHTML = `<div class="end"><div class="big">Du groupe à l'espèce</div><h1>${pts} points</h1><p class="muted">sur ${ROUNDS * 30} possibles · +${pts} XP</p>
    <p class="small muted">Chaque étage vaut plus que le précédent : 3, 6, 9, 12 points.</p>
    <div class="row2"><button class="btn" id="home">Entraînement</button><button class="btn primary" id="again">Rejouer</button></div></div>`;
    $('#home').onclick = training; $('#again').onclick = pathGame;
  };
  play();
}

/* ====== Carnet, badges, réglages ====== */
const carnet = () => guide();
function badgesScreen() {
  app().innerHTML = `<div class="top"><button class="back">‹</button><h1>Badges</h1></div>
  <div class="badges">${BADGES.map(([id, ic, n, d]) => `<div class="badge ${S.badges.includes(id) ? 'on' : ''}"><span>${ic}</span><b>${n}</b><small>${d}</small></div>`).join('')}</div>
  <h2>Statistiques</h2><p>${S.correct} bonnes réponses sur ${S.answered} · ${Object.keys(S.cards).length} cartes vues · série record ${S.streak} j</p>`;
  app().querySelector('.back').onclick = home;
}
function settings() {
  app().innerHTML = `<div class="top"><button class="back">‹</button><h1>Réglages</h1></div>
  <div class="block"><h4>Objectif quotidien</h4><div class="row2">${[10, 20, 30, 50].map(n => `<button class="btn ${S.goal === n ? 'primary' : ''}" data-g="${n}">${n} questions</button>`).join('')}</div></div>
  <div class="block"><h4>Photos</h4><p class="small">Les photos viennent de l'image principale de l'article Wikipédia (français, puis anglais via le nom scientifique). ${S.badPhotos.length} photo(s) écartée(s).</p><button class="btn" id="rp">Recharger les photos</button></div>
  <div class="block"><h4>Sauvegarde</h4><p class="small">Ta progression vit sur ce téléphone. Copie-la pour la transférer.</p><div class="row2"><button class="btn" id="ex">Copier ma progression</button><button class="btn" id="im">Coller une progression</button></div></div>
  <div class="block"><h4>Remise à zéro</h4><button class="btn danger" id="rz">Effacer toute la progression</button></div>`;
  app().querySelector('.back').onclick = profile;
  app().querySelectorAll('[data-g]').forEach(b => b.onclick = () => { S.goal = +b.dataset.g; save(); settings(); });
  $('#rp').onclick = () => { PHOTOS = {}; savePhotos(); location.reload(); };
  $('#ex').onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(S)); toast('Progression copiée'); } catch (e) { prompt('Copie ce texte :', JSON.stringify(S)); } };
  $('#im').onclick = () => { const t = prompt('Colle ici ta progression :'); if (!t) return; try { S = Object.assign(load(), JSON.parse(t)); save(); toast('Progression importée'); home(); } catch (e) { toast('Texte invalide'); } };
  $('#rz').onclick = () => { if (confirm('Effacer définitivement XP, étoiles et révisions ?')) { localStorage.removeItem(KEY); S = load(); home(); } };
}

/* ====== Sons ====== */
let AUDIO = {};
const audKey = n => AUDIO[n] ? n : (SOS_INDEX[n] && SOS_INDEX[n].s.w && AUDIO[SOS_INDEX[n].s.w] ? SOS_INDEX[n].s.w : null);
const hasAud = n => !!audKey(n);
let PLAYER = null, PLAYBTN = null;
function stopAudio() { if (PLAYER) { PLAYER.pause(); } if (PLAYBTN) PLAYBTN.classList.remove('playing'); PLAYBTN = null; }
function playAudio(n, btn) {
  const k = audKey(n); if (!k) return;
  if (PLAYBTN === btn && PLAYER && !PLAYER.paused) { stopAudio(); return; }
  stopAudio();
  PLAYER = PLAYER || new Audio(); PLAYER.src = AUDIO[k].u; PLAYBTN = btn; btn.classList.add('playing', 'loading');
  PLAYER.oncanplay = () => btn.classList.remove('loading');
  PLAYER.onended = () => stopAudio();
  PLAYER.onerror = () => { btn.classList.remove('loading'); stopAudio(); toast(navigator.onLine ? 'Son indisponible' : 'Pas de son hors ligne'); };
  PLAYER.play().catch(() => { });
}
function audBtn(n, label, cls) { return hasAud(n) ? `<button class="play ${cls || ''}" data-aud="${esc(n)}"><i></i>${esc(label)}</button>` : ''; }
function audCredit(n) { const k = audKey(n); if (!k) return ''; const a = AUDIO[k]; return `<a class="audcredit" href="${esc(a.page)}" target="_blank" rel="noopener">Son${a.type ? ' (' + esc(a.type) + ')' : ''} : ${esc(a.by)}</a>`; }
document.addEventListener('click', e => { const b = e.target.closest('[data-aud]'); if (b) { e.preventDefault(); playAudio(b.dataset.aud, b); } });
function listenPair(chosen, right, ok) {
  const parts = [];
  if (!ok && chosen && hasAud(chosen)) parts.push(audBtn(chosen, 'Ton choix · ' + chosen, 'w'));
  if (hasAud(right)) parts.push(audBtn(right, (ok ? '' : 'Bonne réponse · ') + right, 'r'));
  if (!parts.length) return '';
  return `<div class="listen"><small>Écouter</small>${parts.join('')}${audCredit(right)}</div>`;
}

/* ====== Comparateur de photos ====== */
let PSW = 0;
function photoSwitch(items, start) {
  const id = 'psw' + (++PSW);
  setTimeout(() => bindSwitch(id, items, start || 0), 0);
  return `<div class="pswitch" id="${id}"><div class="photo-wrap small" data-ph><div class="pframe"><div class="ph-loading">Chargement…</div></div></div>
  <div class="ptabs">${items.map((it, i) => `<button class="ptab ${it.cls || ''}" data-i="${i}"><small>${esc(it.sub || '')}</small>${esc(it.label)}</button>`).join('')}</div>
  ${items.length > 1 ? '<p class="small muted ptip">Touche un nom pour changer de photo.</p>' : ''}</div>`;
}
async function bindSwitch(id, items, start) {
  await waitPhotos(items.map(i => i.ph));
  const root = document.getElementById(id); if (!root) return;
  const show = i => {
    root.querySelectorAll('.ptab').forEach((b, j) => b.classList.toggle('on', j === i));
    showPhoto(root.querySelector('[data-ph]'), photosOf(items[i].ph)[0], items[i].ph);
  };
  root.querySelectorAll('.ptab').forEach(b => b.onclick = () => show(+b.dataset.i));
  show(start);
}
const phOf = n => { const d = DB.sp.find(s => s.n === n); if (d) return { n: d.n, sci: d.sci }; const x = SOS_INDEX[n]; return x ? sosPh(x.s) : null; };
function wrongRightSwitch(chosenName, rightName, startOnChosen) {
  const c = phOf(chosenName), r = phOf(rightName);
  if (!r) return '';
  if (!c) return photoSwitch([{ label: rightName, sub: 'Bonne réponse', cls: 'r', ph: r }]);
  return photoSwitch([{ label: chosenName, sub: 'Ton choix', cls: 'w', ph: c }, { label: rightName, sub: 'Bonne réponse', cls: 'r', ph: r }], startOnChosen ? 0 : 1);
}

/* ====== Pourquoi c'est faux ====== */
const shortTxt = (t, n = 190) => { t = t || ''; if (t.length <= n) return t; const cut = t.slice(0, n); const p = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; ')); return (p > 60 ? cut.slice(0, p + 1) : cut.replace(/\s+\S*$/, '') + '…'); };
const famByLabel = l => DB.fams.find(f => famLabel(f.n) === l);
function twoCol(a, ta, b, tb) {
  if (!ta && !tb) return '';
  return `<div class="duo">${ta ? `<div class="w"><small>Ton choix · ${esc(a)}</small>${esc(shortTxt(ta))}</div>` : ''}${tb ? `<div class="r"><small>Bonne réponse · ${esc(b)}</small>${esc(shortTxt(tb))}</div>` : ''}</div>`;
}
function whyWrong(q, chosen) {
  if (!chosen || chosen === q.answer) return '';
  const id = q.id.split(':')[0];
  const head = `<p class="why">Tu as choisi <b>${esc(chosen)}</b>, mais c'est <b>${esc(q.answer)}</b>.</p>`;
  const r = q.sp;
  if (q.sosie) return '';
  if (id === 'portrait') {
    const c = DB.sp.find(s => s.n === (q.optSp || [])[q.opts.indexOf(chosen)]);
    return `<p class="why">Le portrait choisi est celui de <b>${esc(c ? c.n : '?')}</b>.</p>` + (c ? twoCol(c.n, c.d, r.n, r.d) : '');
  }
  if (id === 'intrus') {
    return `<p class="why"><b>${esc(chosen)}</b> fait bien partie des ${famLabel(q.intrusFam)}. L'intrus est <b>${esc(r.n)}</b>, qui fait partie des ${famLabel(r.f)} (groupe ${esc(r.grp)}).</p>`;
  }
  if (id === 'sci') {
    const c = DB.sp.find(s => s.sci === chosen);
    const g1 = chosen.split(' ')[0], g2 = (q.answer || '').split(' ')[0];
    return `<p class="why"><i>${esc(chosen)}</i>, c'est ${c ? `le nom de <b>${esc(c.n)}</b>` : 'une autre espèce'}. ${esc(r.n)} se dit <i>${esc(q.answer)}</i>.${g1 === g2 ? ` Même genre <i>${esc(g1)}</i> : c'est le second mot qu'il faut retenir.` : ''}</p>`;
  }
  if (id === 'fam' || id === 'famdesc') {
    const cf = famByLabel(chosen), rf = q.fam || DB.fams.find(f => f.n === r.f);
    const lead = id === 'fam' ? `<p class="why">${esc(r.n)} fait partie des <b>${famLabel(rf.n)}</b>, pas des ${esc(chosen)}.</p>` : head;
    return lead + twoCol(chosen + (cf && cf.grp ? ` (${cf.grp})` : ''), cf && cf.d, famLabel(rf.n) + (rf.grp ? ` (${rf.grp})` : ''), rf.d);
  }
  if (id === 'grp') {
    const rf = q.fam || DB.fams.find(f => f.n === r.f);
    const inG = DB.fams.filter(f => f.grp === chosen).map(f => famLabel(f.n)).slice(0, 6);
    return `<p class="why">Les ${famLabel(rf.n)} sont des <b>${esc(rf.grp)}</b>.${inG.length ? ` Le groupe « ${esc(chosen)} » réunit plutôt : ${inG.join(', ')}.` : ''}</p>`;
  }
  if (id === 'ref') {
    const cf = DB.fams.find(f => f.ref === chosen);
    return `<p class="why"><b>${esc(chosen)}</b> est l'espèce de référence ${cf ? `des ${famLabel(cf.n)}` : 'd\'une autre famille'}. Pour les ${famLabel(q.fam.n)}, c'est ${esc(q.answer)}.</p>`;
  }
  // réponses qui sont des noms d'espèces : photo, critères, chant
  const c = DB.sp.find(s => s.n === chosen);
  const sc = SOS_INDEX[chosen], sr = SOS_INDEX[r.n];
  if (sc && sr && sc.g === sr.g) return head + sosCompare(sc.g, sc.s, sr.s);
  if (!c) return head;
  let t = head;
  t += c.f !== r.f ? `<p>${esc(c.n)} fait partie des ${famLabel(c.f)} (${esc(c.grp)}), la bonne réponse des ${famLabel(r.f)} (${esc(r.grp)}).</p>` : `<p>Même famille (${famLabel(c.f)}) : la différence est dans les critères fins.</p>`;
  t += id === 'chant' ? twoCol(c.n, c.v, r.n, r.v) : twoCol(c.n, c.d, r.n, r.d);
  return t;
}

/* ====== Sosies ====== */
const sosVal = v => Array.isArray(v) ? v[0] : (v || '');
const sosKey = v => Array.isArray(v) ? v[1] : (v || '');
const SOS_INDEX = {};
function sosInit() { SOSIES.forEach(g => g.sp.forEach(s => { [s.n, s.w].forEach(k => { if (k && !SOS_INDEX[k]) SOS_INDEX[k] = { g, s }; }); })); }
const dimLabel = (g, k) => (g.dims.find(d => d[0] === k) || [k, k])[1];
const sosPair = (g, a, b) => g.pairs.find(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
const sosSp = (g, n) => g.sp.find(s => s.n === n);
const sosPh = s => ({ n: s.w || s.n, sci: s.sci });
const readRank = (g, k) => { const i = g.read.indexOf(k); return i < 0 ? 9 : i; };
function sosTable(g, A, B, keys, la, lb, keyFirst) {
  const rows = keys.map((k, i) => `<tr class="${keyFirst && i === 0 ? 'key' : ''}"><th>${esc(dimLabel(g, k))}${keyFirst && i === 0 ? '<small>ce qui tranche</small>' : ''}</th><td class="w">${esc(sosVal(A.v[k]))}</td><td class="r">${esc(sosVal(B.v[k]))}</td></tr>`).join('');
  return `<div class="cmpwrap"><table class="cmp"><thead><tr><th></th><th class="w">${esc(A.n)}${la ? `<small>${la}</small>` : ''}</th><th class="r">${esc(B.n)}${lb ? `<small>${lb}</small>` : ''}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function sosCompare(g, wrong, right, focus) {
  const p = sosPair(g, wrong.n, right.n);
  const key = focus || (p && p[2]) || g.read.find(k => sosKey(wrong.v[k]) !== sosKey(right.v[k])) || g.read[0];
  const others = g.dims.map(d => d[0]).filter(k => k !== key && sosKey(wrong.v[k]) !== sosKey(right.v[k])).sort((a, b) => readRank(g, a) - readRank(g, b)).slice(0, 2);
  return sosTable(g, wrong, right, [key, ...others], 'ton choix', 'la bonne réponse', true) + (p ? `<p class="retiens"><b>À retenir</b>${esc(p[3])}</p>` : '');
}
const SOS_TRAP = 'La teinte générale du plumage';
function sosReflex(g) {
  const p = pick(g.pairs); const key = p[2]; const lab = dimLabel(g, key);
  const others = shuffle(g.dims.map(d => d[0]).filter(k => k !== key)).slice(0, 2).map(k => dimLabel(g, k));
  const A = sosSp(g, p[0]), B = sosSp(g, p[1]);
  return {
    id: `sos:${g.id}:r:${g.pairs.indexOf(p)}`, sosie: true, kind: 'reflex', sp: sosPh(B), pairNames: [p[0], p[1]],
    prompt: `${p[0]} ou ${p[1]} : que regardes-tu en premier ?`, hint: g.name,
    opts: shuffle([lab, SOS_TRAP, ...others]), answer: lab,
    explain(ch, ok) {
      let t = '';
      if (!ok && ch === SOS_TRAP) t += `<p class="why">La couleur trompe : la lumière, l'usure et l'âge la changent. Regarde d'abord <b>${esc(lab.toLowerCase())}</b>.</p>`;
      else if (!ok) t += `<p class="why">${esc(ch)} peut aider ensuite, mais ce qui tranche d'abord, c'est <b>${esc(lab.toLowerCase())}</b>.</p>`;
      const ck = g.dims.find(d => d[1] === ch); const keys = [key]; if (!ok && ck && ck[0] !== key) keys.push(ck[0]);
      return t + sosTable(g, A, B, keys, '', '', true) + `<p class="retiens"><b>À retenir</b>${esc(p[3])}</p>`;
    }
  };
}
function sosDuel(g) {
  const p = pick(g.pairs); const key = p[2];
  const [A, B] = shuffle([sosSp(g, p[0]), sosSp(g, p[1])]);
  return {
    id: `sos:${g.id}:d:${g.pairs.indexOf(p)}`, sosie: true, kind: 'text', sp: sosPh(A), pairNames: [A.n, B.n],
    prompt: `Lequel a : ${sosVal(A.v[key]).toLowerCase()} ?`, hint: `${g.name} · ${dimLabel(g, key)}`,
    opts: shuffle([A.n, B.n]), answer: A.n,
    explain(ch, ok) {
      if (ok) return sosTable(g, A, B, [key], '', '', true) + `<p class="retiens"><b>À retenir</b>${esc(p[3])}</p>`;
      return `<p class="why">Tu as choisi <b>${esc(B.n)}</b>, mais lui a : ${esc(sosVal(B.v[key]).toLowerCase())}.</p>` + sosTable(g, B, A, [key], 'ton choix', 'la bonne réponse', true) + `<p class="retiens"><b>À retenir</b>${esc(p[3])}</p>`;
    }
  };
}
async function sosRun(groups, title, gidForBest) {
  await loadingScreen('Je prépare les sosies…');
  await waitPhotos(groups.flatMap(g => g.sp.map(sosPh)));
  const items = [];
  for (let i = 0; i < 8; i++) {
    const g = pick(groups); const t = [0, 1, 2, 0, 1, 2, 1, 2][i];
    items.push(t === 2 ? { clue: true, g, s: pick(g.sp) } : { q: t === 0 ? sosReflex(g) : sosDuel(g) });
  }
  const its = shuffle(items);
  let i = 0, score = 0, xp = 0; const missed = [];
  const next = () => {
    if (i >= its.length) return sosEnd(title, score, its.length, xp, gidForBest, () => sosRun(groups, title, gidForBest));
    const it = its[i]; const st = { idx: i, total: its.length, combo: 0 };
    const done = (ok, gain) => { if (ok) { score++; S.correct++; } S.answered++; xp += gain; addXP(gain); S.todayCount = (S.todayDate === today() ? S.todayCount : 0) + 1; S.todayDate = today(); save(); };
    const go = () => { i++; next(); };
    if (it.clue) return sosClue(it.g, it.s, st, done, go);
    renderQ(it.q, st, ok => { grade(it.q.id, ok); done(ok, ok ? 12 : 1); }, go, () => training());
  };
  next();
}
function sosClue(g, s, st, done, go) {
  let n = 1; const max = g.dims.length; let answered = false;
  const opts = shuffle(g.sp.map(x => x.n));
  const draw = () => {
    const pts = max - n + 1;
    app().innerHTML = `<div class="qtop"><button class="back" aria-label="Quitter">✕</button><div class="ladder">${g.dims.map((_, j) => `<i class="${j < n ? 'on' : ''}"></i>`).join('')}</div><span class="combo ghost">${st.idx + 1}/${st.total}</span></div>
    <div class="q"><p class="hint">${esc(g.name)} · indice par indice</p><p class="prompt">Qui est-ce ?</p>
    <div class="clues">${g.dims.slice(0, n).map(d => `<div class="clue"><small>${esc(d[1])}</small>${esc(sosVal(s.v[d[0]]))}${d[0] === 'voix' && hasAud(s.n) ? `<button class="play" data-aud="${esc(s.n)}"><i></i>Écouter</button>` : ''}</div>`).join('')}</div>
    ${n < max && !answered ? `<button class="btn wide" id="more">Indice suivant · ${pts - 1} pt${pts - 1 > 1 ? 's' : ''} si tu trouves</button>` : ''}
    <p class="small muted">${answered ? '' : `Réponds maintenant : ${pts} point${pts > 1 ? 's' : ''}.`}</p>
    <div class="opts">${opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div><div id="fb"></div></div>`;
    app().querySelector('.back').onclick = training;
    if ($('#more')) $('#more').onclick = () => { n++; draw(); };
    app().querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (answered) return; answered = true;
      const ch = opts[+b.dataset.k]; const ok = ch === s.n;
      app().querySelectorAll('.opt').forEach(x => { const v = opts[+x.dataset.k]; if (v === s.n) x.classList.add('good'); else if (x === b) x.classList.add('bad'); else x.classList.add('dim'); });
      if ($('#more')) $('#more').remove();
      vibrate(ok ? 15 : [30, 40, 30]);
      grade(`sos:${g.id}:c:${s.n}`, ok); done(ok, ok ? pts * 3 : 1);
      const c = sosSp(g, ch);
      $('#fb').innerHTML = `<div class="fbcard ${ok ? 'ok' : 'ko'}"><div class="fbh">${ok ? `✓ Trouvé avec ${n} indice${n > 1 ? 's' : ''}` : '✗ Pas cette fois'}</div>
        ${ok ? `<p><b>${esc(s.n)}</b> <i>${esc(s.sci)}</i></p>` : `<p class="why">Tu as choisi <b>${esc(ch)}</b>, mais c'est <b>${esc(s.n)}</b>.</p>${sosCompare(g, c, s)}`}
        ${ok ? photoSwitch([{ label: s.n, sub: 'Bonne réponse', cls: 'r', ph: sosPh(s) }]) : wrongRightSwitch(ch, s.n, false)}
        ${listenPair(ch, s.n, ok)}
        <button class="btn primary wide" id="nx">Continuer</button></div>`;
      $('#nx').onclick = () => { stopAudio(); go(); };
      setTimeout(() => $('#fb').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    });
  };
  draw();
}
function sosEnd(title, score, total, xp, gid, again) {
  const pct = Math.round(score / total * 100);
  S.sos = S.sos || {};
  if (gid && (!S.sos[gid] || pct > S.sos[gid])) S.sos[gid] = pct;
  checkBadges({ endSession: true, perfect: score === total }); save();
  app().innerHTML = `<div class="end"><div class="big">${esc(title)}</div><h1>${score} / ${total}</h1><p class="muted">+${xp} XP</p>
  <p class="small muted">Relis la fiche comparative pour ancrer les critères qui tranchent.</p>
  <div class="row2"><button class="btn" id="home">Sosies</button><button class="btn primary" id="again">Rejouer</button></div></div>`;
  $('#home').onclick = sosHome; $('#again').onclick = again;
}
function sosHome() {
  S.sos = S.sos || {};
  app().innerHTML = `<div class="top"><button class="back">‹</button><h1>Sosies</h1></div>
  <p class="muted">Des oiseaux qui se ressemblent, et le critère qui les sépare. Trois épreuves : le bon réflexe (que regarder d'abord), le duel (lequel a ce critère) et l'indice par indice.</p>
  <button class="btn primary wide" id="all">Tout mélanger</button>
  <h2>Les groupes</h2>
  <div class="chapters">${SOSIES.map((g, i) => `<button class="chap" data-g="${i}"><span>${esc(g.name)}</span><span class="stars">${S.sos[g.id] != null ? S.sos[g.id] + ' %' : ''}</span><small>${esc(g.sub)} · ${g.sp.length} espèces</small></button>`).join('')}</div>`;
  app().querySelector('.back').onclick = training;
  $('#all').onclick = () => sosRun(SOSIES, 'Sosies', null);
  app().querySelectorAll('[data-g]').forEach(b => b.onclick = () => sosGroup(SOSIES[+b.dataset.g]));
  window.scrollTo(0, 0);
}
async function sosGroup(g, back) {
  const order = [...g.dims].sort((a, b) => readRank(g, a[0]) - readRank(g, b[0]));
  app().innerHTML = `<div class="top"><button class="back">‹</button><h1>${esc(g.name)}</h1></div>
  <p class="muted">${esc(g.ctx)}</p>
  <div class="readorder"><small>Ordre de lecture</small>${g.read.map((k, i) => `<span><b>${i + 1}</b>${esc(dimLabel(g, k))}</span>`).join('')}</div>
  <button class="btn primary wide" id="play">Jouer ce groupe</button>
  <h2>Les duels classiques</h2>
  <div class="duels">${g.pairs.map(p => `<div class="block"><h4>${esc(p[0])} / ${esc(p[1])} · ${esc(dimLabel(g, p[2]))}</h4><p>${esc(p[3])}</p></div>`).join('')}</div>
  <h2>Fiche comparative</h2>
  <div class="sosph">${g.sp.map((s, i) => `<figure><div class="photo-wrap small" id="sph${i}"></div><figcaption>${esc(s.n)}</figcaption></figure>`).join('')}</div>
  ${order.map(d => `<div class="block dimblock"><h4>${readRank(g, d[0]) < 9 ? `${readRank(g, d[0]) + 1}. ` : ''}${esc(d[1])}</h4>${g.sp.map(s => `<p><b>${esc(s.n)}</b> ${esc(sosVal(s.v[d[0]]))}${d[0] === 'voix' ? ' ' + audBtn(s.n, 'Écouter', 'mini') : ''}</p>`).join('')}</div>`).join('')}
  <p class="small muted">Critères alignés sur Le Guide ornitho : ouvre la planche du groupe pour les voir dessinés.</p>`;
  app().querySelector('.back').onclick = back || sosHome;
  $('#play').onclick = () => sosRun([g], g.name, g.id);
  window.scrollTo(0, 0);
  await waitPhotos(g.sp.map(sosPh));
  g.sp.forEach((s, i) => { const el = $('#sph' + i); if (el) showPhoto(el, photosOf(sosPh(s))[0], sosPh(s), true); });
}

/* ====== Guide des espèces ====== */
const norm = t => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
const GUIDE = { q: '', grp: '', y: 0 };
function guideFams() {
  const order = { 'Non-Passereau': 0, 'Passereau': 1 };
  const fams = [...new Set(SPECIES().map(s => s.f))].map(n => DB.fams.find(f => f.n === n) || { n, grp: '', cat: '' });
  return fams.sort((a, b) => (order[a.cat] ?? 2) - (order[b.cat] ?? 2) || (a.grp || '').localeCompare(b.grp || '', 'fr') || a.n.localeCompare(b.n));
}
function guide() {
  const groups = [...new Set(guideFams().map(f => f.grp).filter(Boolean))];
  app().innerHTML = `${appTop()}<div class="gbar"><button class="back" aria-label="Retour">‹</button><input class="search" id="gq" type="search" placeholder="Recherche…" value="${esc(GUIDE.q)}" autocomplete="off"><button class="gfilter ${GUIDE.grp ? 'on' : ''}" id="gf" aria-label="Filtrer"><i></i><i></i><i></i></button></div>
  <div class="gchips" id="gchips" ${GUIDE.showF ? '' : 'hidden'}><button class="chip ${!GUIDE.grp ? 'on' : ''}" data-grp="">Tous</button>${groups.map(g => `<button class="chip ${GUIDE.grp === g ? 'on' : ''}" data-grp="${esc(g)}">${esc(g)}</button>`).join('')}</div>
  <div id="glist"></div>${navBar('guide')}`;
  app().querySelector('.back').onclick = home;
  bindNav();
  $('#gf').onclick = () => { GUIDE.showF = !GUIDE.showF; $('#gchips').hidden = !GUIDE.showF; };
  app().querySelectorAll('[data-grp]').forEach(b => b.onclick = () => { GUIDE.grp = b.dataset.grp; app().querySelectorAll('[data-grp]').forEach(x => x.classList.toggle('on', x === b)); $('#gf').classList.toggle('on', !!GUIDE.grp); draw(); });
  const draw = () => {
    const t = norm(GUIDE.q);
    const html = guideFams().filter(f => !GUIDE.grp || f.grp === GUIDE.grp).map(f => {
      const sp = SPECIES().filter(s => s.f === f.n && (!t || norm(s.n + ' ' + s.sci + ' ' + s.f + ' ' + s.grp).includes(t)));
      if (!sp.length) return '';
      return `<section class="gfam"><div class="gfh"><div><h2>${esc(famLabel(f.n))}</h2><small>${esc(f.grp || '')}${f.cat ? ' · ' + esc(f.cat) : ''}</small></div>${f.d ? `<button class="ginfo" data-fam="${esc(f.n)}">Info</button>` : ''}</div>
      <div class="gcards">${sp.map(s => `<button class="gcard" data-sp="${esc(s.n)}"><b>${esc(s.n)}</b><i>${esc(s.sci)}</i><span class="gimg" data-img="${esc(s.n)}">${gThumb(s)}</span></button>`).join('')}</div></section>`;
    }).join('');
    $('#glist').innerHTML = html || '<p class="muted center-txt">Aucun oiseau ne correspond.</p>';
    $('#glist').querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { GUIDE.y = window.scrollY; fiche(DB.sp.find(s => s.n === b.dataset.sp), () => { guide(); window.scrollTo(0, GUIDE.y); }); });
    $('#glist').querySelectorAll('[data-fam]').forEach(b => b.onclick = () => { GUIDE.y = window.scrollY; famInfo(b.dataset.fam); });
  };
  $('#gq').oninput = e => { GUIDE.q = e.target.value; draw(); };
  draw();
  if (!SPECIES().every(s => s.n in PHOTOS)) waitPhotos(SPECIES()).then(() => app().querySelectorAll('[data-img]').forEach(el => { const s = DB.sp.find(x => x.n === el.dataset.img); if (s) el.innerHTML = gThumb(s); }));
}
function gThumb(s) { const p = photosOf(s)[0]; return p ? `<img src="${esc(p.src)}" alt="" loading="lazy">` : ''; }
function famInfo(fn) {
  const f = DB.fams.find(x => x.n === fn); const sp = SPECIES().filter(s => s.f === fn);
  app().innerHTML = `<div class="fhead"><button class="back" aria-label="Retour">‹</button><div><h1>${esc(famLabel(f.n))}</h1><p>${esc(f.grp || '')} · ${esc(f.cat || '')}</p></div></div>
  <div class="fbody"><p>${esc(f.d)}</p>${f.sp ? `<p class="muted">${esc(f.sp)}</p>` : ''}${f.ref ? `<p>Espèce de référence : <b>${esc(f.ref)}</b></p>` : ''}
  <h3>${sp.length} espèce${sp.length > 1 ? 's' : ''} dans ta base</h3><div class="splist">${sp.map(spRow).join('')}</div></div>`;
  app().querySelector('.back').onclick = () => { guide(); window.scrollTo(0, GUIDE.y); };
  app().querySelectorAll('[data-sp]').forEach(b => b.onclick = () => fiche(DB.sp.find(s => s.n === b.dataset.sp), () => famInfo(fn)));
  window.scrollTo(0, 0);
}
const FTAB_ICONS = {
  oiseau: '<svg viewBox="0 0 32 32"><path d="M4 22c4 0 6-2 8-5 2-4 5-7 10-7 2 0 3 1 4 2l3 1-3 1c0 6-5 10-12 10H8l-4 2z" fill="currentColor"/></svg>',
  voix: '<svg viewBox="0 0 32 32"><path d="M5 12h5l7-6v20l-7-6H5z" fill="currentColor"/><path d="M21 11c2 3 2 7 0 10M24 8c4 5 4 11 0 16" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
  famille: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="2.5" fill="none"/><path d="M16 14v9M16 9v2" stroke="currentColor" stroke-width="3"/></svg>',
  sosies: '<svg viewBox="0 0 32 32"><circle cx="11" cy="16" r="7" stroke="currentColor" stroke-width="2.5" fill="none"/><circle cx="21" cy="16" r="7" stroke="currentColor" stroke-width="2.5" fill="none"/></svg>'
};
function autoNote(sp, k) { if (!sp.auto || (sp.auto.f && !sp.auto.f.includes(k))) return ''; const h = u => { try { return new URL(u).hostname.replace('www.', ''); } catch (e) { return u; } }; return `<p class="autonote">Texte ajouté hors de ta base Notion, vérifié sur ${sp.auto.src.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(h(u))}</a>`).join(', ')}${sp.auto.conf && sp.auto.conf !== 'haute' ? ' · fiabilité ' + esc(sp.auto.conf) : ''}. À relire avec Le Guide ornitho.</p>`; }
let FICHE_GO = null;
async function fiche(sp, back, tab) {
  FICHE_GO = null;
  const f = DB.fams.find(x => x.n === sp.f) || {};
  const sos = SOS_INDEX[sp.n];
  const tabs = [['oiseau', 'Oiseau'], ['voix', 'Voix'], ['famille', 'Famille']].concat(sos ? [['sosies', 'Sosies']] : []);
  const cur = tab || 'oiseau';
  const panes = {
    oiseau: `${hasAud(sp.n) ? `<div class="fsound">${audBtn(sp.n, sp.vt ? sp.vt.toLowerCase() : 'écouter', 'flat')}</div>` : ''}
      ${path(sp)}
      ${sp.d && !sp.solo ? `<p class="ftext">${esc(sp.d)}</p>` : '<p class="muted">Pas encore de critères dans ta base Notion pour cette espèce.</p>'}
      ${sp.d && !sp.solo ? autoNote(sp, 'd') : ''}${sos ? sosRowsFor(sos) : ''}`,
    voix: `${hasAud(sp.n) ? audBtn(sp.n, 'Écouter') + audCredit(sp.n) : ''}
      ${sp.v ? `<p class="ftext">${sp.vt ? `<b>${esc(sp.vt)}.</b> ` : ''}${esc(sp.v)}</p>` : '<p class="muted">Pas encore de description du chant dans ta base.</p>'}${sp.v ? autoNote(sp, 'v') : ''}
      ${sp.xc[0] ? `<a class="btn small" target="_blank" rel="noopener" href="${esc(sp.xc[0])}">Ouvrir sur xeno-canto</a>` : ''}`,
    famille: f.d ? `<h3>${esc(famLabel(f.n))} · ${esc(f.grp || '')}</h3><p class="ftext">${esc(f.d)}</p>${f.sp ? `<p class="muted">${esc(f.sp)}</p>` : ''}${f.ref ? `<p>Espèce de référence : <b>${esc(f.ref)}</b></p>` : ''}` : '<p class="muted">Pas de description de famille.</p>',
    sosies: sos ? `<p class="ftext">${esc(sos.g.ctx)}</p>${sos.g.pairs.filter(p => p[0] === sp.n || p[1] === sp.n || p[0] === sos.s.n || p[1] === sos.s.n).map(p => `<div class="block"><h4>${esc(p[0])} / ${esc(p[1])} · ${esc(dimLabel(sos.g, p[2]))}</h4><p>${esc(p[3])}</p></div>`).join('')}<button class="btn primary wide" id="tosos">Fiche comparative et jeu</button>` : ''
  };
  const phs = photosOf(sp);
  app().innerHTML = `<div class="fhead"><button class="back" aria-label="Retour">‹</button><div><h1>${esc(sp.n)}</h1>${sp.sci ? `<p><i>${esc(sp.sci)}</i></p>` : ''}</div></div>
  <div class="fgrid"><div class="fphoto photo-wrap" id="fph"><div class="pframe"><div class="ph-loading">Chargement de la photo…</div></div></div>
  <div class="fcol"><div class="ftabs">${tabs.map(([k, l]) => `<button class="ftab ${k === cur ? 'on' : ''}" data-tab="${k}">${FTAB_ICONS[k]}<span>${l}</span></button>`).join('')}</div>
  <div class="fbody">${panes[cur]}</div></div></div>`;
  const backFn = back || guide;
  app().querySelector('.back').onclick = () => { stopAudio(); backFn(); };
  app().querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { stopAudio(); fiche(sp, back, b.dataset.tab); });
  if ($('#tosos')) $('#tosos').onclick = () => sosGroup(sos.g, () => fiche(sp, back, 'sosies'));
  if (!tab) window.scrollTo(0, 0);
  await waitPhotos([sp]);
  const list = photosOf(sp); let pi = 0;
  const fph = $('#fph');
  const showP = () => {
    showPhoto(fph, list[pi], sp);
    if (list.length < 2) return;
    const nav = document.createElement('div'); nav.className = 'pnav';
    nav.innerHTML = `<button class="parr l" aria-label="Photo précédente">‹</button><span class="pcount">${pi + 1} / ${list.length}</span><button class="parr r" aria-label="Photo suivante">›</button>`;
    fph.appendChild(nav);
    nav.querySelector('.l').onclick = e => { e.stopPropagation(); go(-1); };
    nav.querySelector('.r').onclick = e => { e.stopPropagation(); go(1); };
  };
  const go = d => { if (list.length < 2) return; pi = (pi + d + list.length) % list.length; showP(); };
  let x0 = null, y0 = 0;
  fph.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  fph.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1); }, { passive: true });
  FICHE_GO = go;
  showP();
}
function sosRowsFor(sos) {
  const g = sos.g, s = sos.s;
  return `<div class="block"><h4>Critères qui tranchent · ${esc(g.name)}</h4>${g.read.map(k => `<p><b>${esc(dimLabel(g, k))}</b> ${esc(sosVal(s.v[k]))}</p>`).join('')}</div>`;
}

/* ====== Chemin façon Duolingo ====== */
const UNIT_DEF = [
  ['Les évidents et les pigeons', ['Evidents', 'Pigeons']],
  ['Pics et coucous', ['Pics', 'Coucous']],
  ['Les aériens', ['Aériens']],
  ['Les colorés', ['Colorés']],
  ['Mésanges et petits grimpeurs', ['Mésanges', 'Petits grimpeurs']],
  ['Granivores', ['Granivores']],
  ['Opportunistes', ['Opportunistes']],
  ['Insectivores terrestres et percheurs', ['Insectivores terrestres/percheurs']],
  ['Insectivores acrobatiques', ['Insectivores acrobatiques/farfouilleurs']],
  ['Nageurs', ['Nageurs']],
  ['Grands échassiers', ['Grands échassiers']],
  ['Râles et poules', ['Râles', 'Poules']],
  ['Limicoles', ['Limicoles']],
  ['Mouettes et goélands', ['Mouettes']],
  ['Rapaces diurnes', ['Rapaces diurnes']],
  ['Rapaces nocturnes', ['Nocturnes']],
  ['Carnivores', ['Carnivores']]
];
const NODE_INFO = {
  fam: ['Portraits', 'Le bon portrait, familles et intrus', 'tree'],
  photo: ['Reconnaître', 'Identifier sur photo', 'photo'],
  crit: ['Critères et chants', 'Portraits et écoute', 'chant'],
  sos: ['Sosies', 'Le critère qui tranche', 'sosies'],
  trophy: ['Bilan de l\'unité', 'Tout mélangé, avec des révisions', 'trophy'],
  el1: ['Les notions', 'Première moitié du cours', 'etho'],
  el2: ['Approfondir', 'Seconde moitié du cours, détails fins', 'etho'],
  statut: ['Statut migratoire', 'Lu sur la carte du Guide ornitho', 'migr'],
  efree: ['Éthologie', 'Toutes les unités du pack 5', 'etho']
};
/* ====== Éthologie (pack 5) ====== */
let ETHO = { units: [], q: [], statuts: [] }, ETHO_UNITS = [];
const STATUTS = ['Présent toute l\'année', 'Présent toute l\'année / hivernant', 'Migrateur partiel', 'Migrateur courte distance', 'Migrateur transsaharien'];
function buildEthoUnits() {
  ETHO_UNITS = ETHO.units.map((u, i) => {
    const nodes = [{ id: `e${i}-l1`, t: 'el1' }, { id: `e${i}-l2`, t: 'el2' }];
    if (u.id === 'migration' && ETHO.statuts.length >= 8) nodes.push({ id: `e${i}-statut`, t: 'statut' });
    nodes.push({ id: `e${i}-trophy`, t: 'trophy' });
    const sp = u.id === 'migration' ? ETHO.statuts.map(x => DB.sp.find(s => s.n === x.n)).filter(Boolean) : [];
    return { i, etho: true, id: u.id, name: u.name, sub: u.sub, grps: [], fams: [], sos: [], sp, nodes };
  });
}
function ethoFreeUnit() { return { i: ETHO_UNITS.length, etho: true, id: 'all', name: 'Éthologie', grps: [], fams: [], sos: [], sp: ETHO.statuts.map(x => DB.sp.find(s => s.n === x.n)).filter(Boolean), nodes: [] }; }
function ethoQ(e) {
  const multi = e.type === 'multi';
  const opts = e.type === 'vf' ? e.opts.slice() : shuffle(e.opts.slice());
  const good = e.ans.map(k => e.opts[k]);
  const q = { id: 'etho:' + e.id, etho: e, kind: 'text', fam: e.type !== 'esp', prompt: e.prompt, opts, answer: good[0], multi, good, long: e.opts.some(o => o.length > 42), hint: multi && !/^coche/i.test(e.prompt) ? 'Coche tout ce que dit le cours' : '' };
  if (e.type === 'esp') { q.sp = DB.sp.find(s => s.n === good[0]); if (!q.sp) q.fam = true; }
  return q;
}
function statutQ(x) {
  const sp = DB.sp.find(s => s.n === x.n); const ph = sp ? photosOf(sp)[0] : null;
  return { id: 'statut:' + x.n, etho: { why: x.why || '', src: x.src }, statut: true, fam: true, sp, kind: ph ? 'photo' : 'text', img: ph, hint: `Carte du Guide ornitho · ${x.pays || 'Belgique'}`, prompt: `${x.n} : quel statut ?`, opts: STATUTS.slice(), answer: x.statut, good: [x.statut], long: true };
}
function ethoLesson(u, n, gold) {
  const N = gold ? 12 : 10;
  const unitQs = id => ETHO.q.filter(e => e.unit === id);
  if (n.t === 'statut') return shuffle(ETHO.statuts).slice(0, N).map(statutQ);
  if (n.t === 'efree') return shuffle(ETHO.q).slice(0, N).map(ethoQ);
  const all = unitQs(u.id); const half = Math.ceil(all.length / 2);
  let pool;
  if (n.t === 'el1') pool = shuffle(all.slice(0, half)).slice(0, N);
  else if (n.t === 'el2') pool = shuffle(all.slice(half)).slice(0, N);
  else { const prev = ETHO_UNITS.slice(0, u.i).flatMap(x => unitQs(x.id)); pool = shuffle(all).slice(0, prev.length ? 10 : 14).concat(shuffle(prev).slice(0, 4)); }
  let qs = pool.map(ethoQ);
  if (n.t === 'trophy' && u.id === 'migration' && ETHO.statuts.length) qs = qs.concat(shuffle(ETHO.statuts).slice(0, 2).map(statutQ));
  return shuffle(qs);
}
let UNITS = [];
function buildUnits() {
  const allGrp = new Set(SPECIES().map(s => s.grp));
  const used = new Set(UNIT_DEF.flatMap(u => u[1]));
  const defs = UNIT_DEF.map(u => [u[0], u[1].filter(g => allGrp.has(g))]).filter(u => u[1].length);
  [...allGrp].filter(g => g && !used.has(g)).forEach(g => defs.push([g, [g]]));
  const sosOf = g => { const c = {}; g.sp.forEach(s => { const d = DB.sp.find(x => x.n === (s.w || s.n)); if (d) c[d.grp] = (c[d.grp] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0]; };
  UNITS = defs.map(([name, grps], i) => {
    const sos = SOSIES.filter(g => grps.includes(sosOf(g)));
    const sp = SPECIES().filter(s => grps.includes(s.grp));
    const fams = [...new Set(sp.map(s => s.f))];
    const nodes = ['fam', 'photo', 'crit'].concat(sos.length ? ['sos'] : []).concat(['trophy']).map(t => ({ id: `u${i}-${t}`, t }));
    return { i, name, grps, sos, sp, fams, nodes };
  });
}
const P = () => (S.path = S.path || { done: {} });
const nodeDone = id => P().done[id] || 0;
const TRACK = () => (S.track === 'etho' && ETHO_UNITS.length ? 'etho' : 'id');
const trackUnits = () => TRACK() === 'etho' ? ETHO_UNITS : UNITS;
function allNodes() { return trackUnits().flatMap(u => u.nodes.map(n => ({ u, n }))); }
function anyNode(id) { return UNITS.concat(ETHO_UNITS).flatMap(u => u.nodes.map(n => ({ u, n }))).find(a => a.n.id === id); }
function currentNode() { return allNodes().find(x => !nodeDone(x.n.id)); }
function migrateStars() {
  const p = P(); if (p.migrated) return; p.migrated = true;
  UNITS.forEach(u => { const st = Math.min(...u.grps.map(g => S.stars[g] || 0)); if (st >= 1) p.done[`u${u.i}-fam`] = 1; if (st >= 2) p.done[`u${u.i}-photo`] = 1; if (st >= 3) p.done[`u${u.i}-crit`] = 1; });
  save();
}

const appTop = () => `<header class="pbar apptop"><span class="wordmark">Birds<em>.</em></span></header>`;
/* Barre d'onglets */
function navBar(cur) {
  const it = [['chemin', 'Chemin', '<path d="M8 28c0-6 16-6 16-12S8 10 8 4" stroke="currentColor" stroke-width="2.5" fill="none"/><circle cx="8" cy="28" r="2.5" fill="currentColor"/><circle cx="8" cy="4" r="2.5" fill="currentColor"/>'],
    ['train', 'Entraînement', '<rect x="4" y="5" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none"/><rect x="18" y="5" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none"/><rect x="4" y="19" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none"/><rect x="18" y="19" width="10" height="10" fill="currentColor"/>'],
    ['guide', 'Guide', '<path d="M5 6h9c2 0 2 2 2 3v19c0-2-1-3-3-3H5zM27 6h-9c-2 0-2 2-2 3v19c0-2 1-3 3-3h8z" stroke="currentColor" stroke-width="2.5" fill="none"/>'],
    ['profil', 'Profil', '<circle cx="16" cy="11" r="6" stroke="currentColor" stroke-width="2.5" fill="none"/><path d="M5 28c1-6 6-9 11-9s10 3 11 9" stroke="currentColor" stroke-width="2.5" fill="none"/>']];
  return `<nav class="tabbar" aria-label="Navigation principale"><span class="tlogo">Birds<em style="font-style:normal;color:var(--red)">.</em></span>${it.map(([k, l, svg]) => `<button ${k === cur ? 'aria-current="page"' : ''} data-nav="${k}"><svg viewBox="0 0 32 32" aria-hidden="true">${svg}</svg><span>${l}</span></button>`).join('')}</nav>`;
}
function bindNav() { app().querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { stopAudio(); ({ chemin: pathHome, train: training, guide, profil: profile })[b.dataset.nav](); }); }

function pathHome() {
  if (!UNITS.length) buildUnits();
  migrateStars();
  const cur = currentNode();
  const t = today(); const done = S.todayDate === t ? S.todayCount : 0;
  let k = 0;
  const etho = TRACK() === 'etho';
  const unitHTML = trackUnits().map(u => {
    const unitDone = u.nodes.every(n => nodeDone(n.id));
    const unitOpen = u.nodes.some(n => nodeDone(n.id)) || (cur && cur.u === u);
    const locked = !unitDone && !unitOpen;
    return `<section class="unit ${locked ? 'locked' : ''}" id="unit${u.i}">
      <div class="ubanner"><div><small>${etho ? 'Éthologie · unité' : 'Unité'} ${u.i + 1}</small><h2>${esc(u.name)}</h2><p>${etho ? esc(u.sub || '') : u.fams.slice(0, 4).map(famLabel).join(', ') + (u.fams.length > 4 ? '…' : '')}</p></div>
      ${etho ? '' : `<button class="uguide" data-unitguide="${u.i}" aria-label="Fiches de l'unité"><svg viewBox="0 0 32 32"><path d="M5 6h9c2 0 2 2 2 3v19c0-2-1-3-3-3H5zM27 6h-9c-2 0-2 2-2 3v19c0-2 1-3 3-3h8z" stroke="currentColor" stroke-width="2.5" fill="none"/></svg></button>`}</div>
      ${locked && !etho ? `<button class="uskip" data-skip="${u.i}">Tu connais déjà ? Passe le test pour sauter ici</button>` : ''}
      <ol class="stations">${u.nodes.map(n => {
        const st = nodeDone(n.id); const isCur = cur && cur.n.id === n.id;
        const cls = st === 2 ? 'gold' : st ? 'done' : isCur ? 'cur' : 'lock';
        const lab = st === 2 ? 'Dorée' : st ? 'Faite' : isCur ? 'Commencer' : 'Verrouillée';
        return `<li><button class="station ${cls} ${n.t === 'trophy' ? 'trophy' : ''}" data-node="${n.id}"><span class="sq" aria-hidden="true">${nodeIcon(n.t, st)}</span><span class="st-l"><b>${esc(NODE_INFO[n.t][0])}</b><small>${esc(NODE_INFO[n.t][1])}</small></span><span class="st-s">${lab}</span></button></li>`;
      }).join('')}</ol></section>`;
  }).join('');
  app().innerHTML = `<header class="pbar"><span class="wordmark">Birds<em>.</em></span><span class="pstats"><span class="pstat streak"><b>${S.streak || 0}</b>j</span><span class="pstat"><b>${S.xp.toLocaleString('fr-BE')}</b>XP</span><span class="pstat"><b>${done}/${S.goal}</b></span></span></header>
  <div class="pwrap"><div class="trail">${ETHO_UNITS.length ? '' : '<!--'}<div class="track" role="group" aria-label="Parcours"><button class="chip" data-track="id" aria-pressed="${!etho}">Identification</button><button class="chip" data-track="etho" aria-pressed="${etho}">Éthologie</button></div>${ETHO_UNITS.length ? '' : '-->'}${unitHTML}</div>${pathSide(cur, done)}</div>${navBar('chemin')}`;
  app().querySelectorAll('[data-track]').forEach(b => b.onclick = () => { S.track = b.dataset.track; save(); pathHome(); window.scrollTo(0, 0); });
  bindNav();
  app().querySelectorAll('[data-node]').forEach(b => b.onclick = () => nodeSheet(b.dataset.node));
  app().querySelectorAll('[data-skip]').forEach(b => b.onclick = () => skipSheet(+b.dataset.skip));
  app().querySelectorAll('[data-side]').forEach(b => b.onclick = () => b.dataset.side === 'sos' ? sosHome() : guide());
  app().querySelectorAll('[data-unitguide]').forEach(b => b.onclick = () => { const u = UNITS[+b.dataset.unitguide]; GUIDE.q = ''; GUIDE.grp = u.grps.length === 1 ? u.grps[0] : ''; guide(); });
  const target = cur ? app().querySelector(`[data-node="${cur.n.id}"]`) : null;
  if (target) setTimeout(() => target.scrollIntoView({ block: 'center' }), 30); else window.scrollTo(0, 0);
}
function pathSide(cur, done) {
  const r = rank(); const pct = r.to ? Math.round((S.xp - r.from) / (r.to - r.from) * 100) : 100;
  const nd = allNodes().filter(x => nodeDone(x.n.id)).length; const tot = allNodes().length;
  return `<aside class="pside">
    <div class="pcard prow"><span class="pstat streak"><b>${S.streak || 0}</b>jour${(S.streak || 0) > 1 ? 's' : ''} d'affilée</span><span class="pstat"><b>${S.xp.toLocaleString('fr-BE')}</b>XP</span></div>
    <div class="pcard"><small>Rang</small><h3>${esc(r.name)}</h3><div class="bar"><i style="width:${pct}%"></i></div><p class="muted small">${r.to ? `${(r.to - S.xp).toLocaleString('fr-BE')} XP avant « ${esc(r.next)} »` : 'Rang maximum'}</p></div>
    <div class="pcard"><small>Objectif du jour</small><div class="prow"><div class="ring" style="--p:${Math.min(100, Math.round(done / S.goal * 100))}"><span>${done}/${S.goal}</span></div><p class="small">${done >= S.goal ? 'Objectif atteint.' : `Encore ${S.goal - done} question${S.goal - done > 1 ? 's' : ''}.`}</p></div></div>
    <div class="pcard"><small>Parcours</small><p class="small"><b>${nd}</b> leçons sur ${tot}${cur ? ` · en cours : ${esc(cur.u.name)}` : ''}</p>
      ${cur ? `<button class="btn primary wide" data-node="${cur.n.id}">Continuer : ${esc(NODE_INFO[cur.n.t][0])}</button>` : ''}</div>
    <div class="pcard"><small>Raccourcis</small><div class="pside-links"><button class="btn" data-side="sos">Sosies</button><button class="btn" data-side="guide">Guide</button></div></div>
    <p class="muted small kbdhint">Au clavier pendant une leçon : 1 à 6 pour répondre, Entrée pour continuer, Échap pour quitter.</p>
  </aside>`;
}
function nodeIcon(t, st) {
  const ck = '<svg viewBox="0 0 32 32"><path d="M8 17l5 5 11-12" stroke="currentColor" stroke-width="4" fill="none"/></svg>';
  if (st && t !== 'trophy') return ck;
  if (t === 'trophy') return '<svg viewBox="0 0 32 32"><path d="M9 5h14v6c0 5-3 8-7 8s-7-3-7-8zM9 8H4c0 4 2 6 5 6M23 8h5c0 4-2 6-5 6M16 19v5M10 28h12M12 24h8" stroke="currentColor" stroke-width="2.5" fill="none"/></svg>';
  if (t === 'fam') return '<svg viewBox="0 0 32 32"><path d="M16 3l3.6 8 8.4.8-6.4 5.6 2 8.4L16 21.4 8.4 25.8l2-8.4L4 11.8l8.4-.8z" fill="currentColor"/></svg>';
  return ICONS[NODE_INFO[t][2]] || '';
}
function sheet(html) {
  const el = document.createElement('div'); el.className = 'sheetbg';
  el.innerHTML = `<div class="sheet">${html}</div>`;
  el.onclick = e => { if (e.target === el) el.remove(); };
  document.body.appendChild(el); return el;
}
function nodeSheet(id) {
  const x = anyNode(id); if (!x) return;
  const st = nodeDone(id); const cur = currentNode(); const isCur = cur && cur.n.id === id;
  const [title, desc] = NODE_INFO[x.n.t];
  if (!st && !isCur) { toast('Termine d\'abord les leçons précédentes'); return; }
  const el = sheet(`<small>Unité ${x.u.i + 1} · ${esc(x.u.name)}</small><h2>${esc(title)}</h2><p class="muted">${esc(desc)}</p>
    ${!st ? `<button class="btn primary wide" data-go="1">Commencer · +${x.n.t === 'trophy' ? 40 : 20} XP</button>` : st === 1 ? `<button class="btn primary wide gold" data-go="2">Révision dorée · 3 cœurs</button><button class="btn wide" data-go="1">Rejouer</button>` : `<p class="goldtag">Leçon dorée</p><button class="btn wide" data-go="1">Rejouer</button>`}`);
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { el.remove(); startLesson(x.u, x.n, +b.dataset.go === 2); });
}
function skipSheet(ui) {
  const u = UNITS[ui];
  const el = sheet(`<small>Unité ${ui + 1}</small><h2>Sauter jusqu'à « ${esc(u.name)} »</h2><p class="muted">Un test de 12 questions sur toutes les unités précédentes, avec 3 cœurs. Réussi, il valide les leçons d'avant.</p><button class="btn primary wide" id="go">Passer le test</button>`);
  el.querySelector('#go').onclick = () => { el.remove(); startLesson(u, { id: 'skip' + ui, t: 'skip' }, true); };
}

/* Composition d'une leçon */
function sosQs(groups, n) {
  const out = [];
  for (let i = 0; i < n; i++) { const g = pick(groups); const r = i % 5; out.push(r === 4 ? sosClueQ(g, pick(g.sp)) : r % 2 ? sosDuel(g) : sosReflex(g)); }
  return out;
}
function sosClueQ(g, s) {
  return { id: `sos:${g.id}:c:${s.n}`, sosie: true, kind: 'clue', sp: sosPh(s), g, s, prompt: 'Qui est-ce ?', hint: `${g.name} · indice par indice`, opts: shuffle(g.sp.map(x => x.n)), answer: s.n, pairNames: null,
    clues: g.dims.map(d => ({ label: d[1], val: sosVal(s.v[d[0]]), aud: d[0] === 'voix' && hasAud(s.n) ? s.n : null })),
    explain(ch, ok) { return ok ? `<p><b>${esc(s.n)}</b> <i>${esc(s.sci)}</i></p>` : sosCompare(g, sosSp(g, ch), s); } };
}
function buildLesson(u, n, gold) {
  if (u.etho) return ethoLesson(u, n, gold);
  const f = s => u.grps.includes(s.grp);
  const prevGrps = UNITS.slice(0, u.i).flatMap(x => x.grps);
  const fPrev = s => prevGrps.includes(s.grp);
  const N = gold ? 12 : 10;
  let qs = [];
  const uf = [...new Set(SPECIES().filter(f).map(s => s.f))];
  LCTX = { fams: uf };
  if (n.t === 'fam') {
    if (uf.length >= 3) qs = buildMixed([[['fam', 'famdesc', 'ref', 'intrus'], 4], [['portrait'], 4], [['crit'], N - 8]], f);
    else { qs = buildMixed([[['portrait'], 5], [['intrus'], 1], [['crit'], N - 6]], f); LCTX = null; if (prevGrps.length) qs = qs.concat(buildMixed([[['fam', 'famdesc', 'ref'], 2]], fPrev)); LCTX = { fams: uf }; }
  }
  if (n.t === 'photo') qs = buildMixed([[['photo'], N - 3], [['crit'], 3]], f);
  if (n.t === 'crit') qs = buildMixed([[['crit'], Math.ceil(N / 2)], [['chant'], Math.floor(N / 2)]], f);
  if (n.t === 'sos') qs = sosQs(u.sos, N);
  if (n.t === 'trophy') { qs = buildMixed([[['photo'], 4], [['crit'], 2], [['chant'], 2], [['portrait', 'intrus'], 1]], f).concat(u.sos.length ? sosQs(u.sos, 2) : []); if (prevGrps.length) qs = qs.concat(buildMixed([[['photo', 'crit'], 3]], fPrev)); }
  if (n.t === 'skip') LCTX = null;
  if (n.t === 'skip') qs = buildMixed([[['photo'], 5], [['crit'], 4], [['fam', 'grp'], 3]], fPrev.length ? fPrev : f);
  const seen = new Set(qs.map(q => q.id));
  if (qs.length < 6) {
    const pad = buildMixed([[['photo', 'crit', 'chant'], 8]], prevGrps.length ? fPrev : null).filter(q => !seen.has(q.id));
    qs = qs.concat(pad.slice(0, 8 - qs.length));
  }
  LCTX = null;
  return shuffle(qs).slice(0, n.t === 'trophy' ? 14 : N);
}
async function startLesson(u, n, gold) {
  await loadingScreen('Je prépare la leçon…');
  const pool = n.t === 'skip' ? SPECIES() : u.etho ? (n.t === 'statut' || n.t === 'trophy' ? u.sp : []) : u.sp.concat(u.sos.flatMap(g => g.sp.map(sosPh)));
  await waitPhotos(pool);
  const qs = buildLesson(u, n, gold);
  if (!qs.length) { toast('Pas assez de matière pour cette leçon'); return pathHome(); }
  runLesson({ u, n, gold, qs });
}

/* Moteur de leçon */
let LESSON_FREE = false;
function runLesson(L) {
  LESSON_FREE = !!L.n.free;
  const queue = L.qs.slice(); const total = queue.length;
  let hearts = L.gold ? 3 : 5, okCount = 0, errors = 0, combo = 0, xp = 0; const t0 = Date.now(); const retried = new Set();
  const next = () => {
    if (hearts <= 0) return lessonFail(L);
    if (!queue.length) return lessonEnd(L, { total, errors, xp, sec: Math.round((Date.now() - t0) / 1000) });
    const q = queue.shift();
    lessonQ(q, { prog: okCount / total, hearts, retry: retried.has(q.id), combo }, (ok, chosen) => {
      grade(q.id, ok); S.answered++;
      S.todayCount = (S.todayDate === today() ? S.todayCount : 0) + 1; S.todayDate = today();
      if (ok) { okCount++; combo++; S.correct++; const g = 5 + Math.min(combo, 5); xp += g; addXP(g); if (combo === 5 || combo === 10) toast(`${combo} d'affilée !`); }
      else { errors++; combo = 0; hearts--; retried.add(q.id); queue.push(Object.assign({}, q, { opts: shuffle(q.opts) })); save(); }
    }, next);
  };
  next();
}
function lessonQ(q, st, onAnswer, onNext) {
  let shown = 1;
  const heartsHTML = `<span class="hearts ${st.hearts <= 1 ? 'low' : ''}"><svg viewBox="0 0 32 32"><path d="M16 28S3 20 3 11a7 7 0 0 1 13-3 7 7 0 0 1 13 3c0 9-13 17-13 17z" fill="currentColor"/></svg>${st.hearts}</span>`;
  const draw = () => {
    app().innerHTML = `<div class="ltop"><button class="back" aria-label="Quitter">✕</button><div class="bar thin"><i style="width:${Math.round(st.prog * 100)}%"></i></div>${heartsHTML}</div>
    <div class="q lq">
      ${st.retry ? '<p class="retry">Erreur précédente · deuxième essai</p>' : ''}
      ${q.kind === 'photo' ? `<div class="photo-wrap q-ph" id="qph"></div>` : ''}
      ${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ''}
      <p class="prompt">${esc(q.prompt)}</p>
      ${q.quote ? `<blockquote>${esc(q.quote)}</blockquote>` : ''}
      ${q.clues ? `<div class="clues">${q.clues.slice(0, shown).map(c => `<div class="clue"><small>${esc(c.label)}</small>${esc(c.val)}${c.aud ? `<button class="play" data-aud="${esc(c.aud)}"><i></i>Écouter</button>` : ''}</div>`).join('')}</div>${shown < q.clues.length ? '<button class="btn wide" id="more">Indice suivant</button>' : ''}` : ''}
      ${q.audio ? `<button class="play big" data-aud="${esc(q.sp.n)}"><i></i>Écouter</button>` : ''}
      <div class="opts ${q.multi ? 'multi' : ''}">${q.opts.map((o, k) => `<button class="opt ${q.italic ? 'it' : ''} ${q.long ? 'long' : ''}" data-k="${k}" ${q.multi ? 'aria-pressed="false"' : ''}>${esc(o)}</button>`).join('')}</div>
      ${q.multi ? '<button class="btn primary wide" id="valid" disabled>Valider</button>' : ''}
    </div>`;
    app().querySelector('.back').onclick = () => quitSheet();
    if (q.multi) {
      app().querySelectorAll('.opt').forEach(b => b.onclick = () => { if (done) return; b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); $('#valid').disabled = !app().querySelector('.opt[aria-pressed="true"]'); });
      $('#valid').onclick = validate;
      return;
    }
    if (q.kind === 'photo') showPhoto($('#qph'), q.img, q.sp, true);
    if ($('#more')) $('#more').onclick = () => { shown++; draw(); };
    app().querySelectorAll('.opt').forEach(b => b.onclick = () => answer(b));
  };
  let done = false;
  const validate = () => {
    if (done) return; done = true;
    const sel = [...app().querySelectorAll('.opt')].filter(x => x.getAttribute('aria-pressed') === 'true').map(x => q.opts[+x.dataset.k]);
    const ok = sel.length === q.good.length && sel.every(x => q.good.includes(x));
    app().querySelectorAll('.opt').forEach(x => { const o = q.opts[+x.dataset.k]; const isG = q.good.includes(o), isS = sel.includes(o); x.classList.add(isG ? 'good' : isS ? 'bad' : 'dim'); if (isG && !isS) x.classList.add('missed'); x.removeAttribute('aria-pressed'); });
    $('#valid').remove();
    vibrate(ok ? 15 : [30, 40, 30]);
    onAnswer(ok, sel);
    lessonSheet(q, ok, sel, onNext);
  };
  const answer = b => {
    if (done) return; done = true; stopAudio();
    const chosen = q.opts[+b.dataset.k]; const ok = chosen === q.answer;
    app().querySelectorAll('.opt').forEach(x => { if (q.opts[+x.dataset.k] === q.answer) x.classList.add('good'); else if (x === b) x.classList.add('bad'); else x.classList.add('dim'); });
    if ($('#more')) $('#more').remove();
    vibrate(ok ? 15 : [30, 40, 30]);
    onAnswer(ok, chosen);
    lessonSheet(q, ok, chosen, onNext);
  };
  draw(); window.scrollTo(0, 0);
}
function lessonSheet(q, ok, chosen, onNext) {
  const praise = ok ? pick(['Excellent !', 'Bien vu !', 'Parfait !', 'Bravo !', 'Exact !']) : q.multi ? 'Pas tout à fait' : 'Réponse : ' + (q.optSp ? q.sp.n : q.answer);
  const cN = q.optSp ? q.optSp[q.opts.indexOf(chosen)] : chosen, aN = q.optSp ? q.sp.n : q.answer;
  let body = '';
  if (q.etho) body = ethoExplain(q, ok, chosen);
  else if (q.sosie) body = q.explain(chosen, ok);
  else if (!ok) body = whyWrong(q, chosen);
  else if (q.id.startsWith('crit') || q.id.startsWith('chant')) body = `<p class="small">${esc(q.sp.n)}${q.sp.sci ? ` <i>${esc(q.sp.sci)}</i>` : ''}</p>`;
  const spAns = !q.fam && !q.intrusFam && !q.id.startsWith('sci') && q.kind !== 'reflex';
  let ph = '';
  if (!ok && spAns && phOf(cN)) ph = wrongRightSwitch(cN, aN, q.kind === 'photo');
  else if (!ok && q.sosie && q.pairNames) ph = photoSwitch(q.pairNames.map(n => ({ label: n, ph: phOf(n) })));
  const listen = spAns ? listenPair(cN, aN, ok) : '';
  const el = document.createElement('div'); el.className = `lsheet ${ok ? 'ok' : 'ko'}`;
  el.innerHTML = `<div class="lsin"><div class="lsh"><span class="lsicon">${ok ? '✓' : '✗'}</span>${esc(praise)}</div>
    <div class="lsbody">${body}${ph}${listen}</div>
    <button class="btn wide ${ok ? 'okbtn' : 'kobtn'}" id="nx">Continuer</button></div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  if (q.kind === 'photo' && q.img) fillCredit($('#qph'), q.img, q.sp);
  el.querySelector('#nx').onclick = () => { stopAudio(); el.remove(); onNext(); };
}
function ethoExplain(q, ok, chosen) {
  const e = q.etho; let h = '';
  if (q.multi) {
    const miss = q.good.filter(x => !chosen.includes(x)), extra = chosen.filter(x => !q.good.includes(x));
    if (!ok) h += `<div class="duo">${miss.length ? `<div class="r"><small>Oubliés · le cours le dit</small>${miss.map(esc).join('<br>')}</div>` : ''}${extra.length ? `<div class="w"><small>En trop · pas dans le cours</small>${extra.map(esc).join('<br>')}</div>` : ''}</div>`;
  } else if (!ok && q.statut) h += `<p class="why">Tu as choisi « ${esc(chosen)} ».</p>`;
  if (e.why) h += `<p class="why">${esc(e.why)}</p>`;
  if (e.src) h += `<p class="autonote">Source : ${esc(e.src)}</p>`;
  return h;
}
function quitSheet() {
  const el = sheet(`<h2>Quitter la leçon ?</h2><p class="muted">Ta progression dans cette leçon sera perdue. L'XP gagnée reste acquise.</p><button class="btn primary wide" id="stay">Continuer la leçon</button><button class="btn wide" id="quit">Quitter</button>`);
  el.querySelector('#stay').onclick = () => el.remove();
  el.querySelector('#quit').onclick = () => { el.remove(); stopAudio(); document.querySelectorAll('.lsheet').forEach(x => x.remove()); (LESSON_FREE ? training : pathHome)(); };
}
function lessonFail(L) {
  document.querySelectorAll('.lsheet').forEach(x => x.remove());
  app().innerHTML = `<div class="end"><div class="big">Plus de cœurs</div><h1>Presque</h1><p class="muted">${L.u.etho ? 'Les erreurs reviennent en priorité à la prochaine tentative.' : 'Relis les fiches de l\'unité puis réessaie : les erreurs reviennent en priorité.'}</p>
  <div class="row2"><button class="btn" id="g">Fiches de l'unité</button><button class="btn primary" id="r">Réessayer</button></div><button class="btn wide" id="h">Retour au chemin</button></div>`;
  $('#r').onclick = () => startLesson(L.u, L.n, L.gold); $('#h').onclick = pathHome;
  if (L.u.etho) $('#g').remove();
  $('#g') && ($('#g').onclick = () => { GUIDE.q = ''; GUIDE.grp = L.u.grps.length === 1 ? L.u.grps[0] : ''; guide(); });
  if (L.n.free) { $('#h').textContent = 'Retour à l\'entraînement'; $('#h').onclick = training; }
}
function lessonEnd(L, r) {
  const p = P(); const bonus = L.n.t === 'trophy' ? 20 : 10;
  if (L.n.t === 'skip') { allNodes().filter(x => x.u.i < L.u.i).forEach(x => { if (!p.done[x.n.id]) p.done[x.n.id] = 1; }); }
  else if (!L.n.free) p.done[L.n.id] = Math.max(p.done[L.n.id] || 0, L.gold ? 2 : 1);
  addXP(bonus); const perfect = r.errors === 0;
  checkBadges({ endSession: true, perfect: perfect && r.total >= 8 }); save();
  const acc = Math.round(r.total / (r.total + r.errors) * 100);
  const mm = `${Math.floor(r.sec / 60)}:${String(r.sec % 60).padStart(2, '0')}`;
  app().innerHTML = `<div class="end lend"><div class="big">${L.n.t === 'skip' ? 'Test réussi' : perfect ? 'Leçon parfaite' : L.gold ? 'Leçon dorée' : 'Leçon terminée'}</div>
    <h1>${esc(L.n.t === 'skip' ? L.u.name : NODE_INFO[L.n.t][0])}</h1>
    <div class="lstats"><div><small>XP</small><b>+${r.xp + bonus}</b></div><div><small>Précision</small><b>${acc} %</b></div><div><small>Temps</small><b>${mm}</b></div></div>
    <p class="muted">🔥 Série : ${S.streak} jour${S.streak > 1 ? 's' : ''}</p>
    <button class="btn primary wide" id="c">Continuer</button></div>`;
  $('#c').onclick = L.n.free ? training : pathHome;
}

/* Profil */
function profile() {
  const r = rank(); const pct = r.to ? Math.round((S.xp - r.from) / (r.to - r.from) * 100) : 100;
  const nd = Object.values(P().done).filter(Boolean).length, ng = Object.values(P().done).filter(v => v === 2).length;
  app().innerHTML = `${appTop()}<div class="top"><h1>Profil</h1></div>
  <div class="phero"><div class="rsub">Niveau ${r.lvl} · ${S.xp.toLocaleString('fr-BE')} XP</div><div class="rank"><span class="rname">${esc(r.name)}</span></div><div class="bar"><i style="width:${pct}%"></i></div><div class="rnext">${r.to ? `${(r.to - S.xp).toLocaleString('fr-BE')} XP avant « ${esc(r.next)} »` : 'Rang maximum'}</div></div>
  <div class="lstats"><div><small>Série</small><b>${S.streak || 0} j</b></div><div><small>Leçons</small><b>${nd}</b></div><div><small>Dorées</small><b>${ng}</b></div><div><small>Réussite</small><b>${S.answered ? Math.round(S.correct / S.answered * 100) : 0} %</b></div></div>
  <h2>Badges</h2><div class="badges">${BADGES.map(([id, ic, n, d]) => `<div class="badge ${S.badges.includes(id) ? 'on' : ''}"><span>${ic}</span><b>${n}</b><small>${d}</small></div>`).join('')}</div>
  <h2>Mes appareils</h2>${syncBlock()}
  <h2>Réglages</h2><button class="btn wide" id="set">Ouvrir les réglages</button>
  <p class="foot muted small">${DB.sp.length} espèces et ${DB.fams.length} familles issues de ta base Notion (synchro du ${esc(DB.synced)}). Photos et sons : Wikipédia, Wikimedia Commons, xeno-canto.</p>${navBar('profil')}`;
  bindNav(); $('#set').onclick = () => window.hs ? window.hs.openSettings() : settings(); bindSync(profile); window.scrollTo(0, 0);
  app().querySelectorAll('[data-theme-set]').forEach(b => b.onclick = () => { themeSet(b.dataset.themeSet); app().querySelectorAll('[data-theme-set]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
}
function themeGet() { try { return JSON.parse(localStorage.getItem('birds.theme')) || 'auto'; } catch (e) { return 'auto'; } }
function themeSet(t) {
  try { localStorage.setItem('birds.theme', JSON.stringify(t)); } catch (e) { }
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#1B232C' : '#FFFFFF'));
}

/* ====== Synchronisation entre appareils ====== */
const SKEY = 'ornitho-sync-v1';
let SYNC = {}; try { SYNC = JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { }
const saveSync = () => { try { localStorage.setItem(SKEY, JSON.stringify(SYNC)); } catch (e) { } };
async function syncHash(code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ornitho-quiz:' + code.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function mergeState(a, b) {
  const m = Object.assign({}, b, a);
  ['xp', 'correct', 'answered', 'sessions'].forEach(k => m[k] = Math.max(a[k] || 0, b[k] || 0));
  if ((b.lastDay || '') > (a.lastDay || '')) { m.lastDay = b.lastDay; m.streak = b.streak; } else if (b.lastDay === a.lastDay) m.streak = Math.max(a.streak || 0, b.streak || 0);
  if ((b.todayDate || '') > (a.todayDate || '')) { m.todayDate = b.todayDate; m.todayCount = b.todayCount; } else if (b.todayDate === a.todayDate) m.todayCount = Math.max(a.todayCount || 0, b.todayCount || 0);
  m.cards = Object.assign({}, b.cards || {});
  Object.entries(a.cards || {}).forEach(([id, c]) => { const o = m.cards[id]; if (!o || (c.n || 0) >= (o.n || 0)) m.cards[id] = c; });
  const maxMap = (x, y) => { const r = Object.assign({}, y || {}); Object.entries(x || {}).forEach(([k, v]) => { r[k] = Math.max(v || 0, r[k] || 0); }); return r; };
  m.stars = maxMap(a.stars, b.stars); m.sos = maxMap(a.sos, b.sos);
  m.best = Object.assign({}, b.best || {});
  Object.entries(a.best || {}).forEach(([k, v]) => { const o = m.best[k]; if (o == null) { m.best[k] = v; return; } const va = parseInt(v), vb = parseInt(o); m.best[k] = (k === 'pairs' ? va < vb : va > vb) ? v : o; });
  m.badges = [...new Set([...(a.badges || []), ...(b.badges || [])])];
  m.badPhotos = [...new Set([...(a.badPhotos || []), ...(b.badPhotos || [])])];
  m.path = { done: maxMap((a.path || {}).done, (b.path || {}).done), migrated: !!((a.path || {}).migrated || (b.path || {}).migrated) };
  m.goal = a.goal || b.goal;
  return m;
}
let syncing = null;
async function syncNow() {
  if (!SYNC.k) return { ok: false, why: 'off' };
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const url = 'api/progress?k=' + SYNC.k;
      const r = await fetch(url, { cache: 'no-store' });
      if (r.status === 503) return { ok: false, why: 'server' };
      if (r.ok) { const remote = await r.json(); S = mergeState(S, remote); save(); }
      else if (r.status !== 404) return { ok: false, why: 'net' };
      const w = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S) });
      if (!w.ok) return { ok: false, why: w.status === 503 ? 'server' : 'net' };
      SYNC.at = Date.now(); saveSync();
      return { ok: true };
    } catch (e) { return { ok: false, why: 'net' }; }
    finally { setTimeout(() => { syncing = null; }, 0); }
  })();
  return syncing;
}
let syncTimer = null;
function syncSoon() { if (!SYNC.k) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(), 1500); }
const syncWhy = w => ({ server: 'La synchronisation n\'est pas encore branchée sur le serveur.', net: 'Pas de connexion : ta progression partira plus tard.', off: '' })[w] || '';
function syncBlock() {
  if (!SYNC.k) return `<div class="block"><h4>Synchronisation entre appareils</h4>
    <p class="small">Choisis un code et tape le même sur ton téléphone et ton PC. Ta progression sera alors commune. Au moins 6 caractères, et pas un mot de passe important.</p>
    <input class="search" id="scode" type="text" autocomplete="off" autocapitalize="off" placeholder="Ton code, ex. martinet-1970">
    <button class="btn primary wide" id="son">Activer la synchronisation</button></div>`;
  const at = SYNC.at ? new Date(SYNC.at).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'jamais';
  return `<div class="block"><h4>Synchronisation entre appareils</h4><p class="small">Activée sur cet appareil. Dernière synchro : <b id="sat">${esc(at)}</b>.</p>
    <div class="row2"><button class="btn" id="snow">Synchroniser</button><button class="btn" id="soff">Désactiver ici</button></div></div>`;
}
function bindSync(rerender) {
  if ($('#son')) $('#son').onclick = async () => {
    const c = ($('#scode').value || '').trim();
    if (c.length < 6) { toast('Au moins 6 caractères'); return; }
    SYNC = { k: await syncHash(c) }; saveSync();
    const r = await syncNow();
    toast(r.ok ? 'Synchronisation activée' : syncWhy(r.why)); rerender();
  };
  if ($('#snow')) $('#snow').onclick = async () => { const r = await syncNow(); toast(r.ok ? 'Synchronisé' : syncWhy(r.why)); rerender(); };
  if ($('#soff')) $('#soff').onclick = () => { SYNC = {}; saveSync(); toast('Synchronisation désactivée sur cet appareil'); rerender(); };
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && SYNC.k && (!SYNC.at || Date.now() - SYNC.at > 60000)) syncNow().then(r => { if (r.ok && document.querySelector('.trail')) pathHome(); });
});

/* ====== Clavier (ordinateur) ====== */
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea') return;
  const nx = document.querySelector('.lsheet #nx') || document.querySelector('#fb #nx');
  if ((e.key === 'Enter' || e.key === ' ') && nx) { e.preventDefault(); nx.click(); return; }
  const va = document.querySelector('#valid:not([disabled])'); if (e.key === 'Enter' && va) { e.preventDefault(); va.click(); return; }
  if (e.key === 'Escape') { const sb = document.querySelector('.sheetbg'); if (sb) { sb.remove(); return; } const bk = document.querySelector('.ltop .back, .qtop .back'); if (bk) bk.click(); return; }
  if (/^[1-9]$/.test(e.key)) { const opts = [...document.querySelectorAll('.opt')]; if (opts.some(o => o.classList.contains('good'))) return; const o = opts[+e.key - 1]; if (o) { e.preventDefault(); o.click(); } return; }
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && FICHE_GO && document.querySelector('#fph')) { e.preventDefault(); FICHE_GO(e.key === 'ArrowRight' ? 1 : -1); return; }
  if ((e.key === 'e' || e.key === 'E')) { const pl = document.querySelector('.play.big, .clue .play'); if (pl) pl.click(); }
});


/* ====== Retour du téléphone, titre d'onglet, hors connexion ====== */
(function shell() {
  let pushing = false;
  const sync = () => {
    const b = document.querySelector('#app .back');
    if (b && !(history.state && history.state.sub)) { pushing = true; history.pushState({ sub: 1 }, ''); pushing = false; }
    const h = document.querySelector('#app h1');
    const t = document.querySelector('#app .ltop') ? 'Leçon' : document.querySelector('#app .gbar') ? 'Guide' : document.querySelector('#app .trail') ? 'Chemin' : h ? h.textContent.trim() : '';
    document.title = t && !/^ornitho/i.test(t) ? `${t.charAt(0) + t.slice(1).toLowerCase()} · Birds.` : 'Birds.';
  };
  new MutationObserver(() => { clearTimeout(sync.t); sync.t = setTimeout(sync, 60); }).observe(document.getElementById('app'), { childList: true });
  addEventListener('popstate', () => {
    const sb = document.querySelector('.sheetbg'); if (sb) { sb.remove(); history.pushState({ sub: 1 }, ''); return; }
    const b = document.querySelector('#app .back'); if (b) b.click();
  });
  const net = () => {
    let el = document.getElementById('offline');
    if (navigator.onLine) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'offline'; el.className = 'banner offline'; el.setAttribute('role', 'status'); el.textContent = 'Hors connexion : les leçons déjà chargées restent jouables, certaines photos et les sons peuvent manquer.'; document.body.prepend(el); }
  };
  addEventListener('online', net); addEventListener('offline', net); net();
})();

/* ====== Démarrage ====== */
(async function init() {
  DB = await (await fetch('data.json')).json();
  DB.sp.forEach(s => { const f = DB.fams.find(x => x.n === s.f) || {}; s.grp = f.grp; s.cat = f.cat; s.xc = s.xc || []; s.d = s.d || ''; s.v = s.v || ''; s.vt = s.vt || ''; s.sci = s.sci || ''; });
  sosInit(); buildUnits();
  try { AUDIO = await (await fetch('audio.json')).json(); } catch (e) { AUDIO = {}; }
  try { ETHO = await (await fetch('etho.json')).json(); buildEthoUnits(); } catch (e) { ETHO = { units: [], q: [], statuts: [] }; }
  try { const V = await (await fetch('photos.json')).json(); Object.entries(V).forEach(([n, l]) => { PHOTOS[n] = l.map(f => ({ src: 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(f) + '?width=720', file: f, ok: 1, page: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(f.replace(/ /g, '_')) })); }); } catch (e) { }
  if (SYNC.k) await Promise.race([syncNow(), new Promise(r => setTimeout(r, 4000))]);
  home();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  // préchargement discret des photos
  setTimeout(() => ensurePhotos(SPECIES()).catch(() => { }), 1500);
})();


/* ====== Rubrique propre à Birds. dans l'écran Réglages commun ====== */
window.hsSections = window.hsSections || [];
window.hsSections.push({ title: 'Entraînement', render(el, ui) {
  el.innerHTML = `<button class="hs-row" id="hsBirds"><span><b>Objectif, photos, sauvegarde</b><small>Objectif quotidien : ${S.goal} questions</small></span><span aria-hidden="true">›</span></button>`;
  el.querySelector('#hsBirds').onclick = () => { ui.close(); settings(); };
} });
addEventListener('hs-theme', e => themeSet(e.detail));
