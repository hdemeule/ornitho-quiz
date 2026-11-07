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
  const r = await fetch(u); if (!r.ok) throw new Error(r.status);
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
  const need = list.filter(s => !(s.n in PHOTOS));
  if (!need.length) return;
  if (photoLoading) return photoLoading;
  photoLoading = (async () => {
    for (let i = 0; i < need.length; i += 45) {
      const chunk = need.slice(i, i + 45);
      let fr = {}, en = {};
      try { fr = await wikiBatch('fr', chunk.map(s => s.n)); } catch (e) { }
      const sci = chunk.filter(s => s.sci);
      try { if (sci.length) en = await wikiBatch('en', sci.map(s => s.sci)); } catch (e) { }
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
const words = n => n.toLowerCase().replace(/['’]/g, ' ').split(/[\s-]+/).filter(w => w.length > 3 && !['des', 'europe', 'commun'].includes(w));
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
    ok: sp => sp.v && sp.v.length > 20,
    make(sp) {
      const pool = SPECIES().filter(s => s.v && s.v.length > 20);
      const opts = shuffle([sp, ...distract(sp, pool)]);
      return { id: 'chant:' + sp.n, sp, kind: 'text', prompt: 'Qui chante ainsi ?', quote: mask(sp.v, sp), opts: opts.map(o => o.n), answer: sp.n };
    }
  },
  fam: {
    label: 'Arbre du MOOC', icon: '🌳',
    ok: sp => true,
    make(sp) {
      const fams = DB.fams;
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
  intrus: {
    label: 'L\'intrus', icon: '🚫',
    ok: sp => SPECIES().filter(s => s.f === sp.f).length >= 3, famOnly: true,
    make(sp) {
      const fam = shuffle(SPECIES().filter(s => s.f === sp.f)).slice(0, 3);
      const out = shuffle(SPECIES().filter(s => s.f !== sp.f && s.grp === sp.grp)).concat(shuffle(SPECIES().filter(s => s.f !== sp.f && s.cat === sp.cat)))[0];
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

/* ====== Modes de jeu ====== */
const MODES = {
  daily: { title: 'Session du jour', icon: '🎯', desc: 'Révision espacée, tous types mêlés', types: ['photo', 'crit', 'chant', 'fam', 'sci', 'grp', 'famdesc', 'ref', 'intrus'], n: 10, photos: true },
  photo: { title: 'Qui est-ce ?', icon: '📷', desc: 'Vraies photos, espèces proches en piège', types: ['photo'], n: 10, photos: true },
  crit: { title: 'Critères fins', icon: '🔍', desc: 'Retrouver l\'espèce à partir de tes fiches', types: ['crit'], n: 10 },
  chant: { title: 'À l\'oreille', icon: '🎶', desc: 'Descriptions de chants et cris', types: ['chant'], n: 8 },
  tree: { title: 'Arbre du MOOC', icon: '🌳', desc: 'Catégorie → groupe → famille → espèce', types: ['fam', 'grp', 'famdesc', 'ref'], n: 10, photos: true },
  intrus: { title: 'L\'intrus', icon: '🚫', desc: 'Repérer l\'espèce hors famille', types: ['intrus'], n: 8 },
  sci: { title: 'Latin', icon: '🔬', desc: 'Noms scientifiques', types: ['sci'], n: 10 },
  blitz: { title: 'Contre-la-montre', icon: '⚡', desc: '60 secondes, combos multiplicateurs', special: 'blitz' },
  pairs: { title: 'Paires', icon: '🧩', desc: 'Associer espèce et famille ou latin', special: 'pairs' },
  path: { title: 'Le chemin', icon: '🪜', desc: 'Une photo, quatre étages de classification', special: 'path' }
};

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
  if (after > before) setTimeout(() => toast(`${rank().icon} Nouveau rang : ${rank().name} !`, true), 400);
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
  S.sessions = (S.sessions || 0) + (ctx.endSession ? 1 : 0);
  const c = Object.assign({ sessions: S.sessions }, ctx);
  BADGES.forEach(([id, ic, name, , test]) => { if (!S.badges.includes(id) && test(c)) { S.badges.push(id); setTimeout(() => toast(`${ic} Badge : ${name}`, true), 900); } });
  save();
}

/* ====== Écran d'accueil ====== */
function home() {
  const r = rank();
  const pct = r.to ? Math.round((S.xp - r.from) / (r.to - r.from) * 100) : 100;
  const t = today(); const done = S.todayDate === t ? S.todayCount : 0;
  const goalPct = Math.min(100, Math.round(done / S.goal * 100));
  const dueN = Object.values(S.cards).filter(c => c.due <= t).length;
  const groups = chapters();
  app().innerHTML = `
  <header class="hero">
    <div class="rank"><span class="ricon">${r.icon}</span><div><div class="rname">${esc(r.name)}</div><div class="rsub">Niveau ${r.lvl} · ${S.xp.toLocaleString('fr-BE')} XP</div></div>
    <div class="streak" title="Jours d'affilée">🔥 ${S.streak || 0}</div></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="rnext">${r.to ? `${(r.to - S.xp).toLocaleString('fr-BE')} XP avant « ${esc(r.next)} »` : 'Rang maximum'}</div>
  </header>
  <section class="goal">
    <div class="ring" style="--p:${goalPct}"><span>${done}/${S.goal}</span></div>
    <div><b>Objectif du jour</b><br><span class="muted">${dueN} révision${dueN > 1 ? 's' : ''} en attente</span></div>
    <button class="btn primary" data-mode="daily">Jouer ▸</button>
  </section>
  <h2>Jeux</h2>
  <div class="grid">${Object.entries(MODES).filter(([k]) => k !== 'daily').map(([k, m]) => `
    <button class="tile" data-mode="${k}"><span class="ti">${m.icon}</span><b>${m.title}</b><small>${m.desc}</small>${S.best[k] ? `<em>Record ${S.best[k]}</em>` : ''}</button>`).join('')}
  </div>
  <h2>Chapitres du MOOC</h2>
  <p class="muted small">Chaque chapitre a trois niveaux : ★ familles, ★★ espèces sur photo, ★★★ critères fins et chants. 80 % pour décrocher l'étoile.</p>
  ${['Non-Passereau', 'Passereau'].map(cat => `<h3>${cat}x</h3><div class="chapters">${groups.filter(g => g.cat === cat).map(g => `
    <button class="chap" data-chap="${esc(g.grp)}"><span>${esc(g.grp)}</span><span class="stars">${'★'.repeat(S.stars[g.grp] || 0)}<i>${'☆'.repeat(3 - (S.stars[g.grp] || 0))}</i></span><small>${g.n} esp. · maîtrise ${g.m}%</small><span class="mbar"><i style="width:${g.m}%"></i></span></button>`).join('')}</div>`).join('')}
  <h2>Carnet</h2>
  <div class="row2">
    <button class="btn" data-go="carnet">📖 Parcourir les fiches</button>
    <button class="btn" data-go="badges">🏅 Badges (${S.badges.length}/${BADGES.length})</button>
  </div>
  <p class="foot muted small">${DB.sp.length} espèces et ${DB.fams.length} familles issues de ta base Notion « Mooc Ornitho database » (synchro du ${esc(DB.synced)}). Photos : Wikipédia / Wikimedia Commons.<br><button class="link" data-go="settings">Réglages</button></p>`;
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
    { k: 2, t: 'Niveau 2 · Espèces', d: 'Reconnaître sur photo', types: ['photo', 'fam'], photos: true },
    { k: 3, t: 'Niveau 3 · Critères fins', d: 'Portraits, chants, latin', types: ['crit', 'chant', 'sci', 'photo'], photos: true }
  ];
  app().innerHTML = `<div class="top"><button class="back">‹</button><h1>${esc(grp)}</h1></div>
  <p class="muted">${sp[0]?.cat || ''} · ${fams.map(famLabel).join(', ')}</p>
  <div class="levels">${lv.map(l => `<button class="level ${l.k > st + 1 ? 'locked' : ''} ${l.k <= st ? 'done' : ''}" data-l="${l.k}">
    <b>${l.k <= st ? '★' : l.k > st + 1 ? '🔒' : '☆'} ${l.t}</b><small>${l.d}</small></button>`).join('')}</div>
  <h2>Espèces du chapitre</h2>
  <div class="splist">${sp.map(s => spRow(s)).join('')}</div>`;
  app().querySelector('.back').onclick = home;
  app().querySelectorAll('.level').forEach(b => b.onclick = () => {
    const l = lv[+b.dataset.l - 1];
    if (l.k > st + 1) { toast('Décroche d\'abord le niveau précédent'); return; }
    runQuiz({ title: `${grp} · ${l.t.split('·')[1].trim()}`, types: l.types, n: 10, filter: s => s.grp === grp, photos: l.photos, chapter: grp, level: l.k });
  });
  bindRows();
}
function spRow(s) {
  const m = spMastery(s); const dots = m < 0 ? '<span class="dot new">nouveau</span>' : `<span class="dots">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i < Math.round(m) ? 'on' : ''}"></i>`).join('')}</span>`;
  return `<button class="sprow" data-sp="${esc(s.n)}"><span><b>${esc(s.n)}</b>${s.sci ? ` <i>${esc(s.sci)}</i>` : ''}<br><small>${famLabel(s.f)}</small></span>${dots}</button>`;
}
function bindRows() { app().querySelectorAll('[data-sp]').forEach(b => b.onclick = () => fiche(DB.sp.find(s => s.n === b.dataset.sp))); }

/* ====== Fiche ====== */
async function fiche(sp, back) {
  const f = DB.fams.find(x => x.n === sp.f) || {};
  app().innerHTML = `<div class="top"><button class="back">‹</button><h1>${esc(sp.n)}</h1></div>
  ${sp.sci ? `<p class="sci">${esc(sp.sci)}</p>` : ''}
  <div class="photo-wrap" id="fph"><div class="ph-loading">Chargement de la photo…</div></div>
  ${path(sp)}
  ${sp.d && !sp.solo ? `<div class="block"><h4>Critères</h4><p>${esc(sp.d)}</p></div>` : ''}
  ${sp.v ? `<div class="block"><h4>Vocalisation${sp.vt ? ' · ' + esc(sp.vt) : ''}</h4><p>${esc(sp.v)}</p>${sp.xc[0] ? `<a class="btn small" target="_blank" rel="noopener" href="${esc(sp.xc[0])}">▶ Écouter sur xeno-canto</a>` : ''}</div>` : ''}
  ${f.d ? `<div class="block fam"><h4>Famille ${famLabel(f.n)}</h4><p>${esc(f.d)}</p>${f.sp ? `<p class="muted small">${esc(f.sp)}</p>` : ''}${f.ref ? `<p class="small">Espèce de référence : <b>${esc(f.ref)}</b></p>` : ''}</div>` : ''}`;
  app().querySelector('.back').onclick = back || carnet;
  window.scrollTo(0, 0);
  await ensurePhotos([sp]);
  showPhoto($('#fph'), photosOf(sp)[0], sp);
}
function path(sp) {
  return `<div class="path"><span>${esc(sp.cat)}</span><b>›</b><span>${esc(sp.grp)}</span><b>›</b><span>${famLabel(sp.f)}</span>${sp.sub ? `<b>›</b><span>${esc(sp.sub)}</span>` : ''}</div>`;
}
async function showPhoto(el, ph, sp, hideCredit) {
  if (!el) return;
  if (!ph) { el.innerHTML = `<div class="ph-none">Pas de photo disponible${navigator.onLine ? '' : ' (hors ligne)'}</div>`; return; }
  el.innerHTML = `<img src="${esc(ph.src)}" alt="" loading="eager"><div class="credit">${hideCredit ? '' : '…'}</div>`;
  const img = el.querySelector('img');
  img.onerror = () => { el.innerHTML = '<div class="ph-none">Photo indisponible hors ligne</div>'; };
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
  if (m.special === 'blitz') return blitz();
  if (m.special === 'pairs') return pairs();
  if (m.special === 'path') return pathGame();
  runQuiz({ title: m.title, types: m.types, n: m.n, photos: m.photos, mode: k });
}
async function loadingScreen(msg) {
  app().innerHTML = `<div class="center"><div class="spinner"></div><p class="muted">${esc(msg)}</p></div>`;
}
async function runQuiz(cfg) {
  if (cfg.photos) { await loadingScreen('Je cherche les photos…'); await ensurePhotos(poolFor(cfg.filter)); }
  const qs = buildSession(cfg).filter(Boolean);
  if (!qs.length) { toast('Pas assez de matière pour ce jeu'); return home(); }
  let i = 0, score = 0, combo = 0, xpGain = 0; const missed = [];
  const next = () => {
    if (i >= qs.length) return endQuiz(cfg, score, qs.length, xpGain, missed);
    const q = qs[i];
    renderQ(q, { idx: i, total: qs.length, title: cfg.title, combo }, ok => {
      grade(q.id, ok); S.answered++;
      if (ok) { score++; combo++; S.correct++; const g = 10 + Math.min(combo - 1, 5) * 2; xpGain += g; addXP(g); }
      else { combo = 0; missed.push(q.sp); addXP(1); }
      S.todayCount = (S.todayDate === today() ? S.todayCount : 0) + 1; S.todayDate = today(); save();
    }, () => { i++; next(); }, () => home());
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
    <div class="opts">${q.opts.map((o, k) => `<button class="opt ${q.italic ? 'it' : ''}" data-k="${k}">${esc(o)}</button>`).join('')}</div>
    <div id="fb"></div>
  </div>`;
  app().querySelector('.back').onclick = onQuit;
  if (q.kind === 'photo') showPhoto($('#qph'), q.img, q.sp, true);
  let done = false;
  app().querySelectorAll('.opt').forEach(b => b.onclick = () => {
    if (done) return; done = true;
    const val = q.opts[+b.dataset.k]; const ok = val === q.answer;
    app().querySelectorAll('.opt').forEach(x => { if (q.opts[+x.dataset.k] === q.answer) x.classList.add('good'); else if (x === b) x.classList.add('bad'); else x.classList.add('dim'); });
    vibrate(ok ? 15 : [30, 40, 30]);
    onAnswer(ok);
    feedback(q, ok, onNext, timed);
  });
  window.scrollTo(0, 0);
}
function feedback(q, ok, onNext, timed) {
  const sp = q.sp;
  const fb = $('#fb');
  if (timed) { setTimeout(onNext, ok ? 350 : 1100); return; }
  const praise = ok ? pick(['Bien vu !', 'Exact.', 'Parfait.', 'Œil de lynx.', 'Oui !', 'Bonne identification.']) : pick(['Pas tout à fait.', 'Raté, mais retenu.', 'Non.']);
  let body = '';
  if (q.intrusFam) body = `<p><b>${esc(sp.n)}</b> appartient aux ${famLabel(sp.f)}, pas aux ${famLabel(q.intrusFam)}.</p>`;
  else if (q.fam) body = `<p><b>${famLabel(q.fam.n)}</b> · ${esc(q.fam.grp)} · ${esc(q.fam.cat)}</p>${q.fam.d && q.id.startsWith('grp') ? '' : ''}${q.fam.ref ? `<p class="small">Espèce de référence : ${esc(q.fam.ref)}</p>` : ''}${q.fam.sp ? `<p class="small muted">${esc(q.fam.sp)}</p>` : ''}`;
  else body = `<p><b>${esc(sp.n)}</b>${sp.sci ? ` <i>${esc(sp.sci)}</i>` : ''}</p>${path(sp)}${sp.d && !sp.solo && !q.id.startsWith('crit') ? `<p class="small">${esc(sp.d)}</p>` : ''}${q.id.startsWith('crit') ? `<p class="small">${esc(sp.d)}</p>` : ''}${q.id.startsWith('chant') && sp.xc[0] ? `<a class="btn small" target="_blank" rel="noopener" href="${esc(sp.xc[0])}">▶ Écouter sur xeno-canto</a>` : ''}`;
  fb.innerHTML = `<div class="fbcard ${ok ? 'ok' : 'ko'}"><div class="fbh">${ok ? '✓' : '✗'} ${praise}</div>
    ${q.kind !== 'photo' && !q.fam && !q.intrusFam ? `<div class="photo-wrap small" id="fbph"></div>` : ''}
    ${body}
    <button class="btn primary wide" id="nx">Continuer</button></div>`;
  if (q.kind === 'photo' && q.img) { const w = $('#qph'); fillCredit(w, q.img, sp); }
  if ($('#fbph')) ensurePhotos([sp]).then(() => showPhoto($('#fbph'), photosOf(sp)[0], sp));
  $('#nx').onclick = onNext;
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
    <div class="big">${pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '👍' : '🌱'}</div>
    <h1>${score} / ${total}</h1>
    <p class="muted">${esc(cfg.title)} · +${xp} XP</p>
    ${star}
    ${cfg.chapter && pct < 80 ? `<p class="small">Encore ${Math.ceil(total * .8) - score} bonne${Math.ceil(total * .8) - score > 1 ? 's' : ''} réponse${Math.ceil(total * .8) - score > 1 ? 's' : ''} pour l'étoile.</p>` : ''}
    ${uniq.length ? `<h2>À revoir</h2><div class="splist">${uniq.map(spRow).join('')}</div>` : '<p>Aucune erreur.</p>'}
    <div class="row2"><button class="btn" id="home">Accueil</button><button class="btn primary" id="again">Rejouer</button></div></div>`;
  $('#home').onclick = home; $('#again').onclick = () => runQuiz(cfg);
  bindRows();
}

/* ====== Contre-la-montre ====== */
async function blitz() {
  await loadingScreen('Je cherche les photos…'); await ensurePhotos(SPECIES());
  const types = ['photo', 'fam', 'sci', 'crit', 'grp'];
  let end = Date.now() + 60000, score = 0, combo = 0, xp = 0, total = 0, timer;
  const next = () => {
    if (Date.now() >= end) return finish();
    const sp = pick(SPECIES()); const t = pick(types.filter(t => QTYPES[t].ok(sp)));
    const q = QTYPES[t].make(sp); total++;
    const bar = `<div class="timer"><i id="tbar"></i><span id="tsec"></span><b>${score} pts</b></div>`;
    renderQ(q, { idx: total - 1, total: total, title: 'Blitz', combo }, ok => {
      if (ok) { combo++; const pts = Math.min(combo, 5); score += pts; xp += 3 + pts; S.correct++; }
      else { combo = 0; end -= 3000; }
      grade(q.id, ok); S.answered++;
    }, next, () => { clearInterval(timer); home(); }, bar);
  };
  const tick = () => { const left = Math.max(0, end - Date.now()); const b = $('#tbar'), s = $('#tsec'); if (b) b.style.width = (left / 600) + '%'; if (s) s.textContent = Math.ceil(left / 1000) + ' s'; if (left <= 0) { clearInterval(timer); finish(); } };
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true; clearInterval(timer); addXP(xp);
    const best = parseInt(S.best.blitz || 0); const rec = score > best; if (rec) S.best.blitz = score;
    checkBadges({ endSession: true }); save();
    app().innerHTML = `<div class="end"><div class="big">⚡</div><h1>${score} points</h1><p class="muted">${total} questions · +${xp} XP</p>${rec ? '<p class="newstar">Nouveau record !</p>' : `<p class="muted">Record : ${best}</p>`}
    <p class="small muted">Combo : chaque bonne réponse vaut 1 à 5 points selon la série. Une erreur coûte 3 secondes.</p>
    <div class="row2"><button class="btn" id="home">Accueil</button><button class="btn primary" id="again">Rejouer</button></div></div>`;
    $('#home').onclick = home; $('#again').onclick = blitz;
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
  app().innerHTML = `<div class="qtop"><button class="back">✕</button><b>🧩 Paires · ${variant === 'fam' ? 'espèce ↔ famille' : 'espèce ↔ latin'}</b><span class="combo ghost" id="err">0 erreur</span></div>
  <div class="pairs">${cards.map((c, k) => `<button class="pc ${c.kind}" data-k="${k}">${esc(c.t)}</button>`).join('')}</div>`;
  app().querySelector('.back').onclick = home;
  app().querySelectorAll('.pc').forEach(b => b.onclick = () => {
    const c = cards[+b.dataset.k]; if (b.classList.contains('found')) return;
    if (!sel) { sel = b; b.classList.add('sel'); return; }
    if (sel === b) { b.classList.remove('sel'); sel = null; return; }
    const c0 = cards[+sel.dataset.k];
    if (c0.i === c.i && c0.kind !== c.kind) { [sel, b].forEach(x => { x.classList.remove('sel'); x.classList.add('found'); }); found++; vibrate(15); grade((variant === 'fam' ? 'fam:' : 'sci:') + chosen[c.i].n, true); }
    else { errors++; $('#err').textContent = errors + ' erreur' + (errors > 1 ? 's' : ''); [sel, b].forEach(x => x.classList.add('shake')); const a = sel; setTimeout(() => { a.classList.remove('sel', 'shake'); b.classList.remove('shake'); }, 450); vibrate([30, 40, 30]); }
    sel = null;
    if (found === 6) {
      const sec = Math.round((Date.now() - t0) / 1000); const xp = Math.max(20, 70 - errors * 8 - Math.floor(sec / 6));
      addXP(xp); S.correct += 6; const best = S.best.pairs; if (!best || sec < parseInt(best)) S.best.pairs = sec + ' s'; checkBadges({ endSession: true }); save();
      setTimeout(() => {
        app().innerHTML = `<div class="end"><div class="big">🧩</div><h1>${sec} s</h1><p class="muted">${errors} erreur${errors > 1 ? 's' : ''} · +${xp} XP</p>
        <div class="splist">${chosen.map(spRow).join('')}</div>
        <div class="row2"><button class="btn" id="home">Accueil</button><button class="btn primary" id="again">Rejouer</button></div></div>`;
        $('#home').onclick = home; $('#again').onclick = pairs; bindRows();
      }, 500);
    }
  });
}

/* ====== Le chemin : 4 étages sur une photo ====== */
async function pathGame() {
  await loadingScreen('Je cherche les photos…'); await ensurePhotos(SPECIES());
  const withPh = SPECIES().filter(s => photosOf(s).length);
  if (!withPh.length) { toast('Photos indisponibles hors ligne'); return home(); }
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
      app().querySelector('.back').onclick = home;
      showPhoto($('#qph'), ph, sp, true);
      let done = false;
      app().querySelectorAll('.opt').forEach(b => b.onclick = () => {
        if (done) return; done = true; const ok = s.opts[+b.dataset.j] === s.a;
        app().querySelectorAll('.opt').forEach(x => { if (s.opts[+x.dataset.j] === s.a) x.classList.add('good'); else if (x === b) x.classList.add('bad'); else x.classList.add('dim'); });
        vibrate(ok ? 15 : [30, 40, 30]);
        if (ok) { pts += (k + 1) * 3; k++; if (k < 4) return setTimeout(step, 450); grade('id:' + sp.n, true); grade('fam:' + sp.n, true); }
        else { if (k >= 2) grade(k === 2 ? 'fam:' + sp.n : 'id:' + sp.n, false); }
        const fb = $('#fb');
        fb.innerHTML = `<div class="fbcard ${ok ? 'ok' : 'ko'}"><div class="fbh">${ok ? '✓ Chemin complet' : `✗ Arrêt à l'étage ${k + 1}`}</div><p><b>${esc(sp.n)}</b>${sp.sci ? ` <i>${esc(sp.sci)}</i>` : ''}</p>${path(sp)}<button class="btn primary wide" id="nx">Continuer</button></div>`;
        fillCredit($('#qph'), ph, sp);
        $('#nx').onclick = () => { round++; play(); };
      });
    };
    step();
  };
  const fin = () => {
    addXP(pts); const best = parseInt(S.best.path || 0); if (pts > best) S.best.path = pts + ' pts'; checkBadges({ endSession: true }); save();
    app().innerHTML = `<div class="end"><div class="big">🪜</div><h1>${pts} points</h1><p class="muted">sur ${ROUNDS * 30} possibles · +${pts} XP</p>
    <p class="small muted">Chaque étage vaut plus que le précédent : 3, 6, 9, 12 points.</p>
    <div class="row2"><button class="btn" id="home">Accueil</button><button class="btn primary" id="again">Rejouer</button></div></div>`;
    $('#home').onclick = home; $('#again').onclick = pathGame;
  };
  play();
}

/* ====== Carnet, badges, réglages ====== */
function carnet() {
  const groups = chapters();
  app().innerHTML = `<div class="top"><button class="back">‹</button><h1>Carnet</h1></div>
  <input class="search" placeholder="Chercher une espèce ou une famille…" id="q">
  <div id="list"></div>`;
  app().querySelector('.back').onclick = home;
  const draw = (f = '') => {
    const t = f.toLowerCase();
    $('#list').innerHTML = groups.map(g => { const sp = SPECIES().filter(s => s.grp === g.grp && (!t || (s.n + ' ' + s.sci + ' ' + s.f).toLowerCase().includes(t))); return sp.length ? `<h3>${esc(g.grp)}</h3><div class="splist">${sp.map(spRow).join('')}</div>` : ''; }).join('') || '<p class="muted">Rien trouvé.</p>';
    bindRows();
  };
  $('#q').oninput = e => draw(e.target.value); draw();
}
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
  app().querySelector('.back').onclick = home;
  app().querySelectorAll('[data-g]').forEach(b => b.onclick = () => { S.goal = +b.dataset.g; save(); settings(); });
  $('#rp').onclick = () => { PHOTOS = {}; savePhotos(); toast('Photos rechargées au prochain jeu'); };
  $('#ex').onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(S)); toast('Progression copiée'); } catch (e) { prompt('Copie ce texte :', JSON.stringify(S)); } };
  $('#im').onclick = () => { const t = prompt('Colle ici ta progression :'); if (!t) return; try { S = Object.assign(load(), JSON.parse(t)); save(); toast('Progression importée'); home(); } catch (e) { toast('Texte invalide'); } };
  $('#rz').onclick = () => { if (confirm('Effacer définitivement XP, étoiles et révisions ?')) { localStorage.removeItem(KEY); S = load(); home(); } };
}

/* ====== Démarrage ====== */
(async function init() {
  DB = await (await fetch('data.json')).json();
  DB.sp.forEach(s => { const f = DB.fams.find(x => x.n === s.f) || {}; s.grp = f.grp; s.cat = f.cat; s.xc = s.xc || []; s.d = s.d || ''; s.v = s.v || ''; s.vt = s.vt || ''; s.sci = s.sci || ''; });
  home();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  // préchargement discret des photos
  setTimeout(() => ensurePhotos(SPECIES()).catch(() => { }), 1500);
})();
