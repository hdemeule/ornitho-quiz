/* Socle commun des apps de Hugues sur Vercel.
   Fournit window.claude.use(...) avec les mêmes fonctions que les artefacts claude.ai
   (db, assets, sample, dictation, user), branchées sur les fonctions /api de l'app.
   Ajoute : connexion de l'appareil (code ou empreinte), verrou à l'ouverture en option,
   hors ligne, invitation à installer, import des données d'un ancien artefact. */
(function () {
  'use strict';
  const META = n => document.querySelector(`meta[name="${n}"]`)?.content || '';
  const APP = META('app-id') || 'app';
  const NAME = META('app-name') || APP;
  const K = k => `${APP}.${k}`;
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(K(k))) ?? d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(K(k), JSON.stringify(v)); } catch {} };
  const err = (code, message) => Object.assign(new Error(message || code), { code });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Connexion de l'appareil ---------- */
  const auth = {
    st: { unlocked: false, passkeys: 0, online: true },
    async call(action, extra = {}) {
      const r = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw err('auth', j.error || 'Le serveur ne répond pas.');
      return j;
    },
    async refresh() { if (META('hs-device') === 'off') { auth.st.online = false; return auth.st; } try { auth.st = { ...(await auth.call('status')), online: true }; } catch { auth.st.online = false; } return auth.st; },
    async code(c) { await auth.call('code', { code: c }); await auth.refresh(); },
    async passkey() {
      const W = window.SimpleWebAuthnBrowser; if (!W || !window.PublicKeyCredential) throw err('x', 'Ce navigateur ne gère pas les empreintes.');
      const { id, options } = await auth.call('auth-options');
      let response; try { response = await W.startAuthentication({ optionsJSON: options }); } catch { throw err('x', 'Empreinte annulée.'); }
      await auth.call('auth-verify', { id, response }); await auth.refresh();
    },
    async addPasskey() {
      const W = window.SimpleWebAuthnBrowser; if (!W || !window.PublicKeyCredential) throw err('x', 'Ce navigateur ne gère pas les empreintes.');
      const { id, options } = await auth.call('reg-options');
      let response; try { response = await W.startRegistration({ optionsJSON: options }); } catch (e) { throw err('x', e?.name === 'InvalidStateError' ? 'Cet appareil a déjà une empreinte enregistrée.' : 'Empreinte annulée.'); }
      await auth.call('reg-verify', { id, response, device: /android/i.test(navigator.userAgent) ? 'Android' : /iphone|ipad/i.test(navigator.userAgent) ? 'iPhone' : 'Ordinateur' });
      await auth.refresh();
    },
    async logout() { await auth.call('logout'); sessionStorage.removeItem(K('open')); location.reload(); }
  };

  /* ---------- Feuille commune (connexion, verrou, réglages appareil) ---------- */
  function sheet(html, opts = {}) {
    close();
    const bg = document.createElement('div'); bg.className = 'hs-bg' + (opts.full ? ' full' : '') + (opts.page ? ' page' : ''); bg.id = 'hs';
    bg.innerHTML = `<div class="hs" role="dialog" aria-modal="true" aria-label="${esc(opts.label || NAME)}">${html}</div>`;
    document.body.appendChild(bg);
    if (!opts.full) { bg.addEventListener('click', e => { if (e.target === bg) close(); }); bg.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }); }
    setTimeout(() => bg.querySelector('button, input, a')?.focus(), 30);
    return bg;
  }
  function close() { document.getElementById('hs')?.remove(); }
  const logo = `<span class="hs-logo">${esc(NAME.replace(/\.$/, ''))}<em>.</em></span>`;

  function gateSheet(locked) {
    return new Promise(resolve => {
      const st = auth.st;
      const bg = sheet(`${logo}<p class="hs-muted">${locked ? `${esc(NAME)} est verrouillée.` : `Connecte cet appareil pour retrouver tes données. Une seule fois par appareil.`}</p>
        ${st.passkeys ? '<button class="hs-btn primary" id="hsPk">Utiliser mon empreinte</button>' : ''}
        <form id="hsF"><label for="hsC">${st.passkeys ? 'Ou avec ton code' : "Code d'accès"}</label>
        <input id="hsC" type="password" autocomplete="current-password" required>
        <p class="hs-err" id="hsE" role="alert" hidden></p>
        <button class="hs-btn ${st.passkeys ? '' : 'primary'}" id="hsGo">${locked ? 'Déverrouiller' : 'Connecter cet appareil'}</button></form>`, { full: true, label: 'Connexion' });
      const fail = m => { const e = bg.querySelector('#hsE'); e.hidden = false; e.textContent = m; };
      const ok = () => { sessionStorage.setItem(K('open'), '1'); close(); resolve(); };
      const pk = async silent => { try { await auth.passkey(); ok(); } catch (x) { if (!silent) fail(x.message); } };
      bg.querySelector('#hsPk') && (bg.querySelector('#hsPk').onclick = () => pk(false));
      bg.querySelector('#hsF').onsubmit = async e => {
        e.preventDefault(); const b = bg.querySelector('#hsGo'); b.setAttribute('aria-busy', 'true');
        try { await auth.code(bg.querySelector('#hsC').value.trim()); ok(); } catch (x) { fail(x.message); } finally { b.removeAttribute('aria-busy'); }
      };
      if (st.passkeys && locked) setTimeout(() => pk(true), 300); else bg.querySelector('#hsC').focus();
    });
  }

  // Au lancement : état de la connexion, puis verrou si l'app le demande (réglage propre à chaque app).
  const domReady = new Promise(r => document.readyState === 'loading' ? addEventListener('DOMContentLoaded', r) : r());
  const boot = (async () => {
    const st = await auth.refresh();
    await domReady;
    if (!st.online) return;
    if (st.unlocked && META('hs-lock') !== 'off' && lsGet('lock', false) && !sessionStorage.getItem(K('open'))) await gateSheet(true);
    if (st.unlocked) { sessionStorage.setItem(K('open'), '1'); lsSet('everUnlocked', true); }
  })();
  // Connexion exigée seulement quand l'app touche aux données ou à Claude.
  let gateP = null;
  function ensureConnected() {
    if (!gateP) gateP = (async () => {
      await boot;
      const st = auth.st;
      if (!st.online) { if (lsGet('everUnlocked', false)) return; throw err('unavailable'); }
      if (!st.unlocked) await gateSheet(false);
      sessionStorage.setItem(K('open'), '1'); lsSet('everUnlocked', true);
    })().catch(e => { gateP = null; throw e; });
    return gateP;
  }
  const gate = ensureConnected;

  /* ---------- Base de documents (même interface que les artefacts) ---------- */
  const cache = new Map(Object.entries(lsGet('docs', {})));
  let since = lsGet('since', 0);
  const outbox = lsGet('outbox', []);
  const listeners = new Set();
  const persist = () => { lsSet('docs', Object.fromEntries(cache)); lsSet('since', since); lsSet('outbox', outbox); };
  const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
  const docSnap = (path) => ({ id: path.split('/').pop(), exists: cache.has(path), data: () => clone(cache.get(path)), ref: { id: path.split('/').pop(), path } });
  function colSnap(col, order) {
    let docs = [...cache.keys()].filter(p => p.startsWith(col + '/') && p.split('/').length === 2).map(docSnap);
    if (order) { const [f, dir] = order; docs.sort((a, b) => { const x = a.data()?.[f], y = b.data()?.[f]; const c = x == null ? -1 : y == null ? 1 : x < y ? -1 : x > y ? 1 : 0; return dir === 'desc' ? -c : c; }); }
    return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn) };
  }
  let notifyT = null;
  function notify() { clearTimeout(notifyT); notifyT = setTimeout(() => listeners.forEach(l => { try { l.fire(); } catch (e) { console.warn(e); } }), 0); }
  let loaded = false;
  async function pull() {
    try {
      const r = await fetch('/api/docs?since=' + since);
      if (r.status === 401) return;
      if (!r.ok) throw 0;
      const { items, now } = await r.json();
      const pending = new Set(outbox.map(o => o.path));
      for (const it of items) { if (pending.has(it.path)) continue; it.deleted ? cache.delete(it.path) : cache.set(it.path, it.data); }
      since = Math.max(since, now - 5000); loaded = true; persist();
      const rg = cache.get('_appareil/reglages'); if (rg && typeof rg.lock === 'boolean') lsSet('lock', rg.lock); if (rg && rg.theme) { lsSet('theme', rg.theme); applyTheme(rg.theme); }
      lsSet('lastPull', Date.now());
      notify();
    } catch { loaded = true; notify(); }
  }
  let flushing = false;
  async function flush() {
    if (flushing || !outbox.length || !navigator.onLine) return;
    flushing = true;
    try {
      while (outbox.length) {
        const batch = outbox.slice(0, 200);
        const r = await fetch('/api/docs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ops: batch }) });
        if (!r.ok) throw err(r.status === 413 ? 'too_large' : 'unavailable');
        outbox.splice(0, batch.length); persist();
      }
    } catch (e) { flushing = false; throw e; }
    flushing = false;
  }
  function write(path, op, data) {
    if (op === 'delete') cache.delete(path); else cache.set(path, clone(data));
    outbox.push({ op, path, data: op === 'delete' ? null : clone(data) }); persist(); notify();
    return flush().catch(() => { if (!navigator.onLine) return; throw err('unavailable', 'Pas enregistré sur le serveur.'); });
  }
  function setDeep(obj, key, val) {
    const parts = key.split('.'); let o = obj;
    while (parts.length > 1) { const p = parts.shift(); if (typeof o[p] !== 'object' || o[p] == null) o[p] = {}; o = o[p]; }
    if (val === undefined) delete o[parts[0]]; else o[parts[0]] = val;
  }
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), b => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join('');
  function docRef(path) {
    return {
      id: path.split('/').pop(), path,
      async get() { return docSnap(path); },
      set(data, o) { return write(path, 'set', o?.merge ? { ...(cache.get(path) || {}), ...data } : data); },
      update(data) { if (!cache.has(path)) return Promise.reject(err('not_found')); const cur = clone(cache.get(path)); for (const [k, v] of Object.entries(data)) setDeep(cur, k, v); return write(path, 'set', cur); },
      delete() { return write(path, 'delete'); },
      onSnapshot(cb, onErr) { const l = { fire: () => cb(docSnap(path)) }; listeners.add(l); if (loaded) setTimeout(l.fire, 0); return () => listeners.delete(l); }
    };
  }
  function colRef(col, order) {
    return {
      id: col, path: col,
      doc(id) { return docRef(col + '/' + (id || rid())); },
      async add(data) { const ref = docRef(col + '/' + rid()); await ref.set(data); return ref; },
      orderBy(f, dir) { return colRef(col, [f, dir || 'asc']); },
      limit() { return this; },
      async get() { return colSnap(col, order); },
      onSnapshot(cb, onErr) { const l = { fire: () => cb(colSnap(col, order)) }; listeners.add(l); if (loaded) setTimeout(l.fire, 0); return () => listeners.delete(l); }
    };
  }
  const db = { collection: c => colRef(c), doc: p => docRef(p) };
  addEventListener('online', () => { flush().catch(() => {}); pull(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { flush().catch(() => {}); pull(); } });
  setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 60000);

  /* ---------- Photos ---------- */
  const assets = {
    async upload(blob, opt = {}) {
      const r = await fetch('/api/blob', { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-mime': opt.type || blob.type || 'image/jpeg' }, body: blob });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw err(r.status === 413 ? 'too_large' : 'quota_or_state', j.error);
      return j;
    }
  };

  /* ---------- Claude ---------- */
  const toDataUrl = b => new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = ko; fr.readAsDataURL(b); });
  async function shrink(b) {
    try {
      if (!(b instanceof Blob) || b.size < 1.2e6) return b;
      const bmp = await createImageBitmap(b); const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
    } catch { return b; }
  }
  async function ask(prompt, opt = {}, format) {
    if (!navigator.onLine) throw err('offline', 'Pas de connexion.');
    const images = [];
    for (const im of (opt.images || []).slice(0, 6)) images.push(typeof im === 'string' ? im : await toDataUrl(await shrink(im)));
    const r = await fetch('/api/sample', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: opt.signal, body: JSON.stringify({ prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt), images, tier: opt.modelTier === 'complex' ? 'complex' : 'default', format }) })
      .catch(e => { throw err(e?.name === 'AbortError' ? 'cancelled' : 'unavailable'); });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw err(j.code || 'unavailable', j.error);
    return format === 'text' ? j.text : j.json;
  }
  const sample = { json: (p, o) => ask(p, o, 'json'), text: (p, o) => ask(p, o, 'text'), limits: async () => ({ images: { maxCount: 6, maxBytes: 8e6 } }) };

  /* ---------- Dictée (reconnaissance vocale du navigateur) ---------- */
  function makeDictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    let rec = null; const fin = new Set(), sts = new Set();
    const state = s => sts.forEach(f => f({ state: s }));
    return {
      onFinal(f) { fin.add(f); return () => fin.delete(f); },
      onState(f) { sts.add(f); return () => sts.delete(f); },
      start() {
        return new Promise((ok, ko) => {
          try { rec?.abort(); } catch {}
          rec = new SR(); rec.lang = 'fr-BE'; rec.interimResults = false; rec.continuous = false;
          rec.onstart = () => { state('listening'); ok(); };
          rec.onresult = e => { const t = Array.from(e.results).filter(r => r.isFinal).map(r => r[0].transcript).join(' ').trim(); if (t) fin.forEach(f => f({ text: t })); };
          rec.onerror = e => { state('idle'); if (e.error === 'not-allowed' || e.error === 'service-not-allowed') ko(err('not_granted')); };
          rec.onend = () => state('idle');
          rec.start();
        });
      },
      async stop() { try { rec?.stop(); } catch {} }
    };
  }

  const user = { isOwner: async () => true, can: async () => true, me: async () => ({ id: 'hugues', name: 'Hugues' }) };

  /* ---------- window.claude ---------- */
  const NS = {};
  window.claude = Object.freeze({
    async use(name) {
      try { await gate(); } catch { if (name !== 'db') return null; }
      if (name === 'db') { if (!NS.db) { NS.db = db; await pull(); flush().catch(() => {}); } return db; }
      if (name === 'assets') return assets;
      if (name === 'sample') return sample;
      if (name === 'dictation') return (NS.dict ||= makeDictation());
      if (name === 'user') return user;
      if (name === 'downloads') return { save: async ({ filename, data }) => { const a = document.createElement('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data])); a.download = filename; a.click(); } };
      return null;
    }
  });

  /* ---------- Thème (Comme le téléphone, Clair, Sombre) ---------- */
  function applyTheme(t) { t = t || lsGet('theme', 'auto'); if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; }
  applyTheme();

  /* ---------- Réglages standard (même écran dans toutes les apps) ---------- */
  const sections = (window.hsSections = window.hsSections || []);
  const OPT = n => META('hs-' + n) !== 'off';
  const VERSION = META('app-version');
  function settings() {
    const st = auth.st, lock = !!lsGet('lock', false), out = outbox.length, theme = lsGet('theme', 'auto');
    const last = lsGet('lastPull', 0);
    const when = last ? new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }).format(last) : '';
    const bg = sheet(`<div class="hs-head"><span class="hs-logo sm">${esc(NAME.replace(/\.$/, ''))}<em>.</em></span><button class="hs-x" id="hsClose" aria-label="Fermer">×</button></div>
      <h1 class="hs-title">Réglages</h1>
      <h2 class="hs-h">Affichage</h2>
      <div class="hs-chips" role="group" aria-label="Thème">${[['auto', 'Comme le téléphone'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) => `<button class="hs-chip" data-th="${v}" aria-pressed="${theme === v}">${l}</button>`).join('')}</div>
      ${OPT('device') ? `<h2 class="hs-h">Cet appareil</h2>
      ${st.unlocked ? `<p class="hs-ok">Appareil connecté.</p>` : `<p class="hs-muted">Appareil non connecté. Saisis ton code une seule fois sur cet appareil.</p>
        <form id="hsCF"><label for="hsCC">Code d'accès</label><input id="hsCC" type="password" autocomplete="current-password" required><button class="hs-btn primary">Connecter cet appareil</button></form>`}
      ${OPT('lock') && st.unlocked ? `<div class="hs-row"><span><b>Verrouiller ${esc(NAME)} à l'ouverture</b><small>Empreinte ou code à chaque lancement. Désactivé par défaut.</small></span>
        <button class="hs-sw" id="hsLock" role="switch" aria-checked="${lock}" aria-label="Verrouiller à l'ouverture"><i></i></button></div>
      <button class="hs-row" id="hsAdd"><span><b>Ajouter l'empreinte de cet appareil</b><small>${st.passkeys ? st.passkeys + ' empreinte' + (st.passkeys > 1 ? 's enregistrées' : ' enregistrée') : 'Aucune enregistrée'}</small></span><span aria-hidden="true">›</span></button>` : ''}
      ${st.unlocked ? `<button class="hs-row" id="hsOut"><span><b>Déconnecter cet appareil</b></span><span aria-hidden="true">›</span></button>` : ''}` : ''}
      ${OPT('data') && OPT('device') ? `<h2 class="hs-h">Données</h2>
      <p class="hs-muted">${st.unlocked ? `Synchronisées entre tes appareils${when ? ' · dernière fois ' + when : ''}${out ? ` · ${out} modification${out > 1 ? 's' : ''} en attente` : ''}.` : 'Connecte cet appareil pour synchroniser tes données.'}</p>
      ${st.unlocked ? `<button class="hs-row" id="hsExp"><span><b>Exporter mes données</b><small>Une copie complète, dans un fichier</small></span><span aria-hidden="true">›</span></button>
      <label class="hs-row" for="hsImp"><span><b>Importer des données</b><small>Fichier exporté depuis une app ou un ancien artefact</small></span><span aria-hidden="true">›</span></label>
      <input type="file" id="hsImp" accept=".json,application/json" multiple hidden>` : ''}` : ''}
      <div id="hsApp"></div>
      <h2 class="hs-h">Application</h2>
      <button class="hs-row" id="hsInst"><span><b>${standalone() ? 'Application installée' : "Installer sur l'écran d'accueil"}</b></span><span aria-hidden="true">›</span></button>
      <p class="hs-muted small">${esc(NAME)}${VERSION ? ' · version ' + esc(VERSION) : ''}</p>
      <p class="hs-err" id="hsE" role="status" hidden></p>`, { label: 'Réglages', page: true });
    const msg = (m, good) => { const e = bg.querySelector('#hsE'); e.hidden = false; e.className = good ? 'hs-ok' : 'hs-err'; e.textContent = m; e.scrollIntoView({ block: 'nearest' }); };
    const $ = q => bg.querySelector(q);
    $('#hsClose').onclick = () => { close(); if (location.hash.startsWith('#/reglages')) history.back(); };
    bg.querySelectorAll('[data-th]').forEach(b => b.onclick = () => {
      lsSet('theme', b.dataset.th); applyTheme(b.dataset.th); bg.querySelectorAll('[data-th]').forEach(x => x.setAttribute('aria-pressed', x === b));
      if (auth.st.unlocked && OPT('data')) db.doc('_appareil/reglages').set({ ...(cache.get('_appareil/reglages') || {}), theme: b.dataset.th }).catch(() => {});
      dispatchEvent(new CustomEvent('hs-theme', { detail: b.dataset.th }));
    });
    $('#hsCF') && ($('#hsCF').onsubmit = async e => { e.preventDefault(); try { await auth.code($('#hsCC').value.trim()); sessionStorage.setItem(K('open'), '1'); lsSet('everUnlocked', true); dispatchEvent(new Event('hs-connected')); settings(); } catch (x) { msg(x.message); } });
    $('#hsLock') && ($('#hsLock').onclick = async e => {
      const on = !lsGet('lock', false), btn = e.currentTarget;
      if (on && !auth.st.passkeys) { try { await auth.addPasskey(); } catch (x) { return msg(x.message + ' Le verrou reste désactivé.'); } }
      lsSet('lock', on); sessionStorage.setItem(K('open'), '1');
      if (OPT('data')) db.doc('_appareil/reglages').set({ ...(cache.get('_appareil/reglages') || {}), lock: on }).catch(() => {});
      btn.setAttribute('aria-checked', on); msg(on ? "Verrou activé : empreinte demandée à l'ouverture." : 'Verrou désactivé.', true);
    });
    $('#hsAdd') && ($('#hsAdd').onclick = async () => { try { await auth.addPasskey(); msg('Empreinte enregistrée.', true); } catch (x) { msg(x.message); } });
    $('#hsOut') && ($('#hsOut').onclick = () => auth.logout());
    $('#hsInst').onclick = () => { if (standalone()) return msg('Tu utilises déjà l\'application installée.', true); close(); install(true); };
    $('#hsExp') && ($('#hsExp').onclick = () => {
      const blob = new Blob([JSON.stringify({ app: APP, exportedAt: new Date().toISOString(), docs: [...cache].map(([path, data]) => ({ path, data })) })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${APP}-donnees-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    });
    $('#hsImp') && ($('#hsImp').onchange = async e => {
      const files = [...e.target.files]; if (!files.length) return;
      try {
        let docs = 0, photos = 0;
        for (const f of files) {
          const j = JSON.parse(await f.text());
          if (j.app && j.app !== APP) throw err('x', `Ce fichier vient de ${j.app}, pas de ${NAME}.`);
          for (const d of (j.docs || [])) { cache.set(d.path, d.data); outbox.push({ op: 'set', path: d.path, data: d.data }); docs++; }
          persist(); msg(`Envoi des données… ${docs}`, true); await flush();
          for (const b of (j.blobs || [])) {
            const bin = Uint8Array.from(atob(b.b64), c => c.charCodeAt(0));
            const r = await fetch('/api/blob?id=' + encodeURIComponent(b.id), { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-mime': b.mime || 'image/jpeg' }, body: bin });
            if (!r.ok) throw err('x', 'Une photo n\'a pas pu être envoyée. Réessaie l\'import, rien ne sera dupliqué.');
            photos++; if (photos % 5 === 0) msg(`Envoi des photos… ${photos}`, true);
          }
        }
        notify(); msg(`Import terminé : ${docs} fiches et ${photos} photos.`, true);
      } catch (x) { msg(x.message || 'Import impossible.'); }
    });
    const host = $('#hsApp');
    for (const sec of sections) { const el = document.createElement('section'); el.innerHTML = `<h2 class="hs-h">${esc(sec.title)}</h2>`; const body = document.createElement('div'); el.appendChild(body); host.appendChild(el); try { sec.render(body, { close, msg }); } catch (e) { console.warn(e); } }
  }

  /* ---------- Bouton Réglages : engrenage en haut à droite (téléphone), ligne du menu latéral (PC) ---------- */
  const GEAR = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>';
  function chrome() {
    const head = document.querySelector('header.topbar, header.top, body > header, .app > header, header');
    if (head && !head.querySelector('.hs-gear')) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'hs-gear'; b.setAttribute('aria-label', 'Réglages'); b.innerHTML = GEAR; b.onclick = settings;
      const last = head.lastElementChild;
      if (last && head.children.length > 1 && last.querySelector('button, a')) { last.classList.add('hs-grp'); last.appendChild(b); }
      else { head.classList.add('hs-hdr'); head.appendChild(b); }
    }
    const nav = document.querySelector('nav.tabbar, nav.tabs, nav[aria-label="Navigation principale"]');
    if (nav) document.documentElement.classList.add('hs-has-side');
    if (nav && !nav.querySelector('.hs-side')) { const a = document.createElement('button'); a.type = 'button'; a.className = 'hs-side'; a.innerHTML = GEAR + '<span>Réglages</span>'; a.onclick = settings; nav.appendChild(a); }
    document.querySelectorAll('[data-hs-settings]').forEach(el => { if (!el._hs) { el._hs = 1; el.addEventListener('click', e => { e.preventDefault(); settings(); }); } });
  }
  addEventListener('DOMContentLoaded', () => { chrome(); new MutationObserver(chrome).observe(document.body, { childList: true, subtree: true }); });
  addEventListener('hashchange', () => { if (location.hash.startsWith('#/reglages')) settings(); });
  addEventListener('load', () => { if (location.hash.startsWith('#/reglages') || location.hash === '#/appareil') setTimeout(settings, 300); });
  window.hs = { openSettings: settings, addSection: s => sections.push(s), applyTheme, auth, connect: ensureConnected };

  /* ---------- Installation sur l'écran d'accueil ---------- */
  let ip = null;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); ip = e; setTimeout(() => install(false), 1500); });
  addEventListener('appinstalled', () => { lsSet('installed', true); document.getElementById('hsInstall')?.remove(); });
  function install(force) {
    if (standalone() || document.getElementById('hsInstall')) return;
    if (!force && (lsGet('installHidden', false) || lsGet('installed', false) || (!ip && !ios))) return;
    const box = document.createElement('div'); box.id = 'hsInstall'; box.className = 'hs-install'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Installer ' + NAME);
    box.innerHTML = `<img src="/icon-192.png" alt="" width="48" height="48"><div><b>Installer ${esc(NAME.replace(/\.$/, ''))}<em>.</em></b><span>${ip ? "Une icône sur ton écran d'accueil, l'app s'ouvre en plein écran." : ios ? "Touche Partager, puis « Sur l'écran d'accueil »." : "Menu ⋮ de Chrome, puis « Installer l'application »."}</span></div>
      <p>${ip ? '<button class="hs-btn primary" id="hsIGo">Installer</button>' : ''}<button class="hs-btn" id="hsINo">Plus tard</button></p>`;
    document.body.appendChild(box);
    box.querySelector('#hsIGo') && (box.querySelector('#hsIGo').onclick = async () => { ip.prompt(); const r = await ip.userChoice; ip = null; if (r.outcome === 'accepted') box.remove(); });
    box.querySelector('#hsINo').onclick = () => { lsSet('installHidden', true); box.remove(); };
  }
  if (ios) addEventListener('load', () => setTimeout(() => install(false), 2500));

  /* ---------- Hors ligne ---------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js');
})();
