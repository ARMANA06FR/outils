'use strict';

/* ---------- utilitaires ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const eur = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = ts => new Date(ts).toLocaleDateString('fr-FR');
const fmtDateTime = ts => new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const today = () => { const t = new Date(); return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtDay = s => String(s).split('-').reverse().join('/');
const fixUrl = u => { u = String(u || '').trim(); return u && !/^https?:\/\//i.test(u) ? 'https://' + u : u; };

/* ---------- remplissage automatique depuis un lien ---------- */
const relayUrl = () => (localStorage.getItem('relayOutils') || '').trim().replace(/\/+$/, '');
const firstLink = (...parts) => { const m = parts.filter(Boolean).join(' ').match(/https?:\/\/[^\s<>"']+/i); return m ? m[0].replace(/[).,;]+$/, '') : ''; };

// mots-clés (sans accents) -> nom de catégorie par défaut
const CAT_RULES = [
  ['Outillage électroportatif', ['perceuse', 'visseuse', 'meuleuse', 'ponceuse', 'scie sauteuse', 'scie circulaire', 'scie sabre', 'perforateur', 'defonceuse', 'rabot electrique', 'decapeur', 'pistolet a colle', 'sans fil', 'batterie', 'cloueur', 'agrafeuse electrique', 'aspirateur atelier']],
  ['Outillage à main', ['marteau', 'tournevis', 'pince', 'cle', 'cles', 'scie', 'egoine', 'ciseau', 'burin', 'maillet', 'lime', 'cutter', 'serre-joint', 'etau', 'rabot', 'cliquet', 'douille', 'tenaille', 'masse', 'pied de biche']],
  ['Jardin', ['tondeuse', 'taille-haie', 'secateur', 'souffleur', 'debroussailleuse', 'tronconneuse', 'arrosage', 'beche', 'rateau', 'pelle', 'brouette', 'jardin', 'cisaille', 'pulverisateur', 'serfouette']],
  ['Maçonnerie', ['truelle', 'taloche', 'betonniere', 'auge', 'mortier', 'fer a beton', 'platoir', 'berthelet', 'echafaudage', 'massette']],
  ['Plomberie', ['robinet', 'siphon', 'raccord', 'plomberie', 'debouche', 'ventouse', 'teflon', 'collier de serrage', 'multiprise', 'coupe-tube', 'tuyau', 'flexible']],
  ['Électricité', ['ampoule', 'cable', 'prise', 'interrupteur', 'disjoncteur', 'multimetre', 'testeur', 'gaine', 'domino', 'denudeur', 'rallonge', 'electricien', 'torche', 'lampe']],
  ['Peinture et droguerie', ['peinture', 'pinceau', 'rouleau', 'bache', 'enduit', 'couteau a enduire', 'ruban de masquage', 'lasure', 'vernis', 'colle', 'silicone', 'mastic', 'decapant', 'brosse a peinture']],
  ['Menuiserie et bois', ['tasseau', 'menuiserie', 'charniere', 'gond', 'chevillette', 'bois', 'panneau', 'lambris', 'poignee', 'serrure']],
  ['Carrelage et sol', ['carrelage', 'croisillon', 'coupe-carreau', 'parquet', 'plinthe', 'raclette', 'faience']],
  ['Quincaillerie et fixation', ['vis', 'boulon', 'cheville', 'clou', 'ecrou', 'rondelle', 'rivet', 'fixation', 'crochet', 'attache', 'collier', 'equerre']],
  ['Mesure et traçage', ['metre', 'laser', 'telemetre', 'niveau', 'regle', 'trusquin', 'cordeau', 'tracage', 'compas', 'fil a plomb', 'mesure']],
  ['Sécurité et protection', ['gant', 'lunettes', 'casque', 'masque', 'protection', 'genouillere', 'chaussure de securite', 'bouchon', 'antibruit', 'combinaison']],
  ['Rangement et atelier', ['etabli', 'servante', 'caisse a outils', 'coffret', 'rangement', 'etagere', 'mallette', 'organiseur', 'boite a outils', 'sacoche', 'trousse']],
  ['Nettoyage et entretien', ['nettoyeur', 'karcher', 'eponge', 'balai', 'serpilliere', 'nettoyage', 'degraissant', 'aspirateur', 'chiffon']],
];
function guessCat(name) {
  const n = ' ' + norm(name) + ' ';
  let best = null, bestScore = 0;
  for (const [label, words] of CAT_RULES) {
    let sc = 0;
    for (const w of words) if (new RegExp('[^a-z0-9]' + w.replace(/[-\s]/g, '[- ]') + 's?(?![a-z0-9])').test(n)) sc++;
    if (sc > bestScore) { best = label; bestScore = sc; }
  }
  if (!best) return '';
  const c = cats.find(x => norm(x.name) === norm(best));
  return c ? c.id : '';
}

async function relayGet(path, asBlob) {
  const base = relayUrl();
  if (!base) throw new Error('no-relay');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(base + '/' + path, { signal: ctrl.signal });
    if (asBlob) { if (!r.ok) throw new Error('no-image'); return await r.blob(); }
    return await r.json();
  } finally { clearTimeout(timer); }
}

/* ---------- sélecteur de photos (inventaire et liste de course) ---------- */
function photoPickerHtml(pre) {
  return `<div class="photos" id="${pre}-ph"></div>
      <p class="hint">Touchez une photo pour en faire la vignette (bordure colorée).</p>
      <div class="two pickrow">
        <label class="btn pick">Prendre une photo<input id="${pre}-cam" type="file" accept="image/*" capture="environment" hidden></label>
        <label class="btn pick">Choisir dans la galerie<input id="${pre}-files" type="file" accept="image/*" multiple hidden></label>
      </div>`;
}
function bindPhotoPicker(pre, d) {
  const phBox = $('#' + pre + '-ph', sheet);
  const draw = () => {
    phBox.innerHTML = d.photos.map((p, k) => `<div class="pt"><img src="${urlOf(p.thumb)}" data-k="${k}" alt="Photo ${k + 1}"><button type="button" data-rm="${k}" aria-label="Retirer la photo ${k + 1}">×</button></div>`).join('');
  };
  draw();
  phBox.onclick = e => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { d.photos.splice(+rm.dataset.rm, 1); draw(); return; }
    const im = e.target.closest('img');
    if (im) { const k = +im.dataset.k; d.photos.unshift(d.photos.splice(k, 1)[0]); draw(); }
  };
  const addFiles = async e => {
    const files = [...e.target.files];
    if (!files.length) return;
    toast('Traitement des photos…');
    for (const f of files) {
      try { d.photos.push(await makePhoto(f)); draw(); }
      catch (err) { toast('Une photo n’a pas pu être lue.'); }
    }
    e.target.value = '';
  };
  $('#' + pre + '-files', sheet).onchange = addFiles;
  $('#' + pre + '-cam', sheet).onchange = addFiles;
  return draw;
}

// Branche le bouton « Remplir automatiquement » d'un formulaire (pre = 'f' inventaire, 's' liste de course)
function bindAutofill(pre, sel, photos) {
  const g = id => $('#' + pre + '-' + id, sheet);
  const urlEl = g('url'), btn = g('auto'), msg = g('automsg');
  let busy = false;
  const setIf = (id, v) => { const el = g(id); if (el && v && !el.value.trim()) { el.value = v; return true; } return false; };
  const run = async () => {
    if (busy) return;
    const link = firstLink(urlEl.value);
    if (!link) { toast('Collez d’abord le lien de l’article.'); urlEl.focus(); return; }
    if (!relayUrl()) { msg.textContent = 'Le remplissage automatique n’est pas encore réglé : allez dans Réglages > Remplissage automatique.'; return; }
    busy = true; btn.disabled = true;
    msg.textContent = 'Lecture de la page en cours…';
    try {
      const p = await relayGet('?url=' + encodeURIComponent(link));
      if (!p || !p.ok) {
        msg.textContent = p && p.error === 'blocked' ? 'Ce site refuse la lecture automatique. Remplissez à la main : le lien est conservé.'
          : p && p.error === 'empty' ? 'Aucune information trouvée sur cette page. Remplissez à la main.'
          : 'La page n’a pas pu être lue. Remplissez à la main.';
        return;
      }
      urlEl.value = p.finalUrl || link;
      const got = [];
      const nameWasEmpty = !g('name').value.trim();
      if (setIf('name', p.name)) got.push('nom');
      if (p.price != null && setIf('price', p.price.toFixed(2).replace('.', ','))) got.push('prix');
      if (g('desc') && setIf('desc', p.description)) got.push('descriptif');
      if (setIf('notes', [p.brand && 'Marque : ' + p.brand, p.sku && 'Réf. : ' + p.sku].filter(Boolean).join(' – '))) got.push('référence');
      const st = g('store');
      if (p.store && st) {
        const cur = st.value.trim();
        if (!cur || (cur === DEFAULT_STORE && !norm(cur).startsWith(norm(p.store)))) { st.value = p.store; got.push('magasin'); }
      }
      if (nameWasEmpty && got.includes('nom')) {
        const gc = guessCat(p.name);
        if (gc) { sel.value = gc; sel.dispatchEvent(new Event('change')); got.push('catégorie'); }
      }
      let photoMsg = '';
      if (photos && p.image && photos.count() === 0) {
        try {
          const blob = await relayGet('?img=' + encodeURIComponent(p.image) + '&ref=' + encodeURIComponent(link), true);
          await photos.add(await makePhoto(blob));
          got.push('photo');
        } catch (e) { photoMsg = ' La photo n’a pas pu être récupérée.'; }
      }
      msg.textContent = (got.length ? 'Rempli : ' + got.join(', ') + '. Vérifiez puis enregistrez.' : 'Les champs étaient déjà remplis, rien n’a été changé.') + photoMsg;
    } catch (e) {
      msg.textContent = 'Le relais ne répond pas. Vérifiez la connexion et l’adresse dans Réglages > Remplissage automatique.';
    } finally { busy = false; btn.disabled = false; }
  };
  btn.onclick = run;
  urlEl.addEventListener('paste', () => setTimeout(() => { if (firstLink(urlEl.value)) run(); }, 80));
  return run;
}

const ICON = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>'
};

/* ---------- base de données locale (IndexedDB) ---------- */
let db;
const openDB = () => new Promise((res, rej) => {
  const r = indexedDB.open('outils-bricolage', 1);
  r.onupgradeneeded = () => {
    const d = r.result;
    d.createObjectStore('items', { keyPath: 'id' });
    d.createObjectStore('categories', { keyPath: 'id' });
    d.createObjectStore('shopping', { keyPath: 'id' });
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const store = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);
const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const getAll = n => wrap(store(n).getAll());
const put = (n, v) => wrap(store(n, 'readwrite').put(v));
const del = (n, id) => wrap(store(n, 'readwrite').delete(id));
const clearStore = n => wrap(store(n, 'readwrite').clear());

/* ---------- état ---------- */
const DEFAULT_STORE = 'Leroy Merlin Nice';
const state = { q: '', cat: 'all', tab: 'inv', sq: '' };
let items = [], cats = [], shop = [];
const view = $('#view');
const sheet = $('#sheet');
const hayCache = new Map();

async function loadAll() {
  [items, cats, shop] = await Promise.all([getAll('items'), getAll('categories'), getAll('shopping')]);
  cats.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'fr'));
  items.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  hayCache.clear();
}

const DEFAULT_CATS = ['Outillage à main', 'Outillage électroportatif', 'Jardin', 'Maçonnerie', 'Plomberie', 'Électricité', 'Peinture et droguerie', 'Menuiserie et bois', 'Carrelage et sol', 'Quincaillerie et fixation', 'Mesure et traçage', 'Sécurité et protection', 'Rangement et atelier', 'Nettoyage et entretien', 'Autres'];
async function seed() {
  if (localStorage.getItem('seededOutils') || cats.length || items.length) return;
  for (let i = 0; i < DEFAULT_CATS.length; i++) await put('categories', { id: uid(), name: DEFAULT_CATS[i], order: i });
  localStorage.setItem('seededOutils', '1');
  await loadAll();
}

const catName = id => (cats.find(c => c.id === id) || {}).name || 'Sans catégorie';
const hayOf = i => {
  const k = i.id + ':' + (i.updated || 0) + ':' + i.cat;
  let h = hayCache.get(k);
  if (h === undefined) {
    h = norm([i.name, i.description, i.store, i.url, i.location, i.notes, catName(i.cat)].join(' '));
    hayCache.set(k, h);
  }
  return h;
};

/* ---------- photos ---------- */
const urls = new WeakMap();
const urlOf = b => { if (!b) return ''; let u = urls.get(b); if (!u) { u = URL.createObjectURL(b); urls.set(b, u); } return u; };

async function loadBitmap(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }
}
async function shrink(src, max, q) {
  const bmp = await loadBitmap(src);
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', q));
}
const makePhoto = async file => ({ full: await shrink(file, 1400, .82), thumb: await shrink(file, 360, .75) });
const blobToData = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });

/* ---------- interface commune ---------- */
function toast(msg) {
  const host = sheet.open ? sheet : document.body;
  const old = $('#toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 2400);
}

function openSheet(html) {
  sheet.innerHTML = html;
  if (!sheet.open) { sheet.showModal(); history.pushState({ sheet: 1 }, ''); }
  const body = sheet.querySelector('.sh-body');
  if (body) body.scrollTop = 0;
  sheet.onclick = e => { if (e.target.closest('[data-close]')) closeSheet(); };
}
function closeSheet() {
  if (history.state && history.state.sheet) history.back();
  else if (sheet.open) sheet.close();
}
addEventListener('popstate', () => { if (sheet.open) sheet.close(); });
sheet.addEventListener('cancel', e => { e.preventDefault(); closeSheet(); });
sheet.addEventListener('close', () => { sheet.innerHTML = ''; refreshCurrent(); });

function lightbox(src) {
  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.innerHTML = `<img src="${esc(src)}" alt="Photo en grand">`;
  lb.onclick = () => lb.remove();
  (sheet.open ? sheet : document.body).appendChild(lb);
}

const chip = (id, label, n, on) => `<button class="chip${on ? ' on' : ''}" data-cat="${esc(id)}">${esc(label)} <span>${n}</span></button>`;
const thumbHtml = i => {
  const p = (i.photos || [])[0];
  return p ? `<img class="thumb" src="${urlOf(p.thumb)}" alt="" loading="lazy">` : `<span class="ph" aria-hidden="true">${esc((i.name || '?').trim().charAt(0).toUpperCase())}</span>`;
};

/* ---------- navigation ---------- */
const TITLES = { inv: 'Mes outils et accessoires', shop: 'Liste de course', set: 'Réglages et sauvegarde' };
function setTab(t) {
  state.tab = t;
  document.querySelectorAll('.tabs button').forEach(b => { if (b.dataset.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  $('#title').textContent = TITLES[t];
  if (t === 'inv') renderInventory();
  else if (t === 'shop') renderShopping();
  else renderSettings();
  view.scrollTop = 0;
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
function refreshCurrent() {
  if (state.tab === 'inv') { if ($('#list')) { refreshChips(); refreshList(); } else renderInventory(); }
  else if (state.tab === 'shop') renderShopping();
  else renderSettings();
}

/* ---------- inventaire : liste et recherche ---------- */
function visible() {
  const terms = norm(state.q).split(/\s+/).filter(Boolean);
  return items.filter(i => {
    const okCat = state.cat === 'all' || (state.cat === 'none' ? !cats.some(c => c.id === i.cat) : i.cat === state.cat);
    return okCat && terms.every(t => hayOf(i).includes(t));
  });
}

function renderInventory() {
  view.innerHTML = `
    <div class="searchbar"><input id="q" type="search" enterkeyhint="search" autocomplete="off" aria-label="Rechercher" placeholder="Rechercher un outil, une marque, un rayon…" value="${esc(state.q)}"></div>
    <div class="chips" id="chips"></div>
    <p class="summary" id="sum"></p>
    <ul class="list" id="list"></ul>
    <button class="fab" id="add">${ICON.plus}<span>Ajouter</span></button>`;
  $('#q').addEventListener('input', e => { state.q = e.target.value; refreshList(); });
  $('#add').onclick = () => openForm();
  $('#chips').onclick = e => {
    if (e.target.closest('[data-manage]')) return openCats();
    const b = e.target.closest('[data-cat]');
    if (b) { state.cat = b.dataset.cat; refreshChips(); refreshList(); }
  };
  $('#list').onclick = e => { const b = e.target.closest('[data-id]'); if (b) openDetail(b.dataset.id); };
  refreshChips(); refreshList();
}

function refreshChips() {
  const n = id => items.filter(i => i.cat === id).length;
  let h = chip('all', 'Toutes', items.length, state.cat === 'all');
  for (const c of cats) h += chip(c.id, c.name, n(c.id), state.cat === c.id);
  const orphan = items.filter(i => !cats.some(c => c.id === i.cat)).length;
  if (orphan) h += chip('none', 'Sans catégorie', orphan, state.cat === 'none');
  else if (state.cat === 'none') state.cat = 'all';
  if (state.cat !== 'all' && state.cat !== 'none' && !cats.some(c => c.id === state.cat)) state.cat = 'all';
  h += '<button class="chip ghost" data-manage>Gérer les catégories</button>';
  $('#chips').innerHTML = h;
}

function refreshList() {
  const list = visible();
  const pieces = list.reduce((s, i) => s + (i.qty || 1), 0);
  const total = list.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
  $('#sum').textContent = items.length ? `${list.length} article${list.length > 1 ? 's' : ''}, ${pieces} pièce${pieces > 1 ? 's' : ''}, valeur d’achat ${eur(total)}` : '';
  if (!items.length) { $('#list').innerHTML = '<li class="empty">Aucun outil pour l’instant.<br>Touchez « Ajouter » pour enregistrer le premier.</li>'; return; }
  if (!list.length) { $('#list').innerHTML = `<li class="empty">Aucun résultat${state.q ? ' pour « ' + esc(state.q) + ' »' : ''}.</li>`; return; }
  $('#list').innerHTML = list.map(i => `
    <li><button class="card" data-id="${i.id}">${thumbHtml(i)}
      <span class="body"><strong>${esc(i.name)}</strong><span class="meta">${esc(catName(i.cat))}${i.location ? ', ' + esc(i.location) : ''}</span></span>
      <span class="right"><span class="qty">× ${i.qty || 1}</span><span class="price">${i.price != null ? eur(i.price) : ''}</span></span>
    </button></li>`).join('');
}

/* ---------- fiche article ---------- */
function openDetail(id) {
  const i = items.find(x => x.id === id);
  if (!i) return;
  const ph = i.photos || [];
  const row = (k, v) => v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '';
  openSheet(`
    <header class="sh-head"><button class="icon" data-close aria-label="Fermer">${ICON.back}</button><h2>${esc(i.name)}</h2></header>
    <div class="sh-body">
      ${ph.length ? `<div class="gallery${ph.length > 1 ? ' multi' : ''}">${ph.map((p, k) => `<img src="${urlOf(p.full)}" data-k="${k}" alt="Photo ${k + 1} de ${esc(i.name)}">`).join('')}</div>` : ''}
      <dl class="facts">
        ${row('Catégorie', catName(i.cat))}
        ${row('Quantité', String(i.qty || 1))}
        ${i.price != null ? row('Prix d’achat (unité)', eur(i.price)) + row('Total', eur(i.price * (i.qty || 1))) : ''}
        ${row('Date d’achat', i.date ? fmtDay(i.date) : '')}
        ${row('Lieu d’achat', i.store)}
        ${row('Emplacement', i.location)}
      </dl>
      ${i.description ? `<h3>Descriptif du commerçant</h3><p class="prose">${esc(i.description)}</p>` : ''}
      ${i.notes ? `<h3>Notes</h3><p class="prose">${esc(i.notes)}</p>` : ''}
      ${i.url ? `<a class="btn primary wide" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">Ouvrir la fiche en ligne</a>` : ''}
    </div>
    <footer class="sh-foot"><button class="btn" id="dup">Dupliquer</button><button class="btn" id="edit">Modifier</button><button class="btn danger" id="rm">Supprimer</button></footer>`);
  $('#edit', sheet).onclick = () => openForm(i);
  $('#dup', sheet).onclick = () => openForm(i, true);
  $('#rm', sheet).onclick = async () => {
    if (!confirm(`Supprimer « ${i.name} » ?`)) return;
    await del('items', i.id); await loadAll(); closeSheet(); setTimeout(() => toast('Article supprimé.'), 200);
  };
  const g = $('.gallery', sheet);
  if (g) g.onclick = e => { const im = e.target.closest('img'); if (im) lightbox(im.src); };
}

/* ---------- formulaire article ---------- */
function openForm(item, asCopy = false, opts = {}) {
  const isNew = !item || asCopy || !!opts.fresh;
  const d = item
    ? { ...item, photos: [...(item.photos || [])] }
    : { id: uid(), name: '', cat: (state.cat !== 'all' && state.cat !== 'none') ? state.cat : (cats[0] && cats[0].id) || '', qty: 1, price: null, date: today(), store: DEFAULT_STORE, url: opts.link || '', description: '', location: '', notes: '', photos: [] };
  if (asCopy) { d.id = uid(); d.name = d.name + ' (copie)'; delete d.created; }

  openSheet(`
    <header class="sh-head"><button class="icon" data-close aria-label="Annuler">${ICON.back}</button><h2>${isNew ? 'Nouvel article' : 'Modifier l’article'}</h2></header>
    <div class="sh-body form">
      ${photoPickerHtml('f')}
      <label>Nom de l’outil ou de l’accessoire<input id="f-name" class="field" autocomplete="off" value="${esc(d.name)}"></label>
      <label>Catégorie<select id="f-cat"></select></label>
      <div class="two">
        <label>Quantité<input id="f-qty" class="field" type="number" min="1" inputmode="numeric" value="${d.qty || 1}"></label>
        <label>Prix d’achat par unité (€)<input id="f-price" class="field" inputmode="decimal" value="${d.price != null ? String(d.price).replace('.', ',') : ''}"></label>
      </div>
      <label>Date d’achat<input id="f-date" class="field" type="date" value="${esc(d.date || '')}"></label>
      <label>Lieu d’achat<input id="f-store" class="field" placeholder="Leroy Merlin Nice, Castorama, Brico Dépôt…" value="${esc(d.store)}"></label>
      <label>Lien vers l’article<input id="f-url" class="field" inputmode="url" autocapitalize="off" placeholder="https://" value="${esc(d.url)}"></label>
      <button type="button" class="btn wide" id="f-auto">Remplir automatiquement depuis ce lien</button>
      <p class="hint" id="f-automsg" role="status" aria-live="polite"></p>
      <label>Emplacement de rangement<input id="f-loc" class="field" placeholder="Garage, atelier, cabanon…" value="${esc(d.location)}"></label>
      <label>Descriptif du commerçant<textarea id="f-desc" rows="5">${esc(d.description)}</textarea></label>
      <label>Notes personnelles (référence, dimensions, couleur)<textarea id="f-notes" rows="3">${esc(d.notes)}</textarea></label>
    </div>
    <footer class="sh-foot"><button class="btn" data-close>Annuler</button><button class="btn primary" id="f-save">Enregistrer</button></footer>`);

  const sel = $('#f-cat', sheet);
  const drawCats = value => {
    sel.innerHTML = cats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('') + '<option value="__new">+ Nouvelle catégorie…</option>';
    sel.value = cats.some(c => c.id === value) ? value : (cats[0] ? cats[0].id : '__new');
  };
  drawCats(d.cat);
  let lastCat = sel.value;
  sel.onchange = async () => {
    if (sel.value !== '__new') { lastCat = sel.value; return; }
    const name = (prompt('Nom de la nouvelle catégorie') || '').trim();
    if (!name) { sel.value = lastCat; return; }
    const c = { id: uid(), name, order: cats.length };
    await put('categories', c); await loadAll();
    drawCats(c.id); lastCat = c.id;
  };

  const drawPhotos = bindPhotoPicker('f', d);
  const runAuto = bindAutofill('f', sel, { count: () => d.photos.length, add: async p => { d.photos.push(p); drawPhotos(); } });
  if (opts.auto && d.url) runAuto();

  $('#f-save', sheet).onclick = async () => {
    const name = $('#f-name', sheet).value.trim();
    if (!name) { toast('Indiquez le nom de l’article.'); $('#f-name', sheet).focus(); return; }
    const pr = parseFloat(String($('#f-price', sheet).value).replace(/\s/g, '').replace(',', '.'));
    d.name = name;
    d.cat = sel.value === '__new' ? '' : sel.value;
    d.qty = Math.max(1, parseInt($('#f-qty', sheet).value, 10) || 1);
    d.price = isNaN(pr) ? null : pr;
    d.date = $('#f-date', sheet).value;
    d.store = $('#f-store', sheet).value.trim();
    d.url = fixUrl($('#f-url', sheet).value);
    d.location = $('#f-loc', sheet).value.trim();
    d.description = $('#f-desc', sheet).value.trim();
    d.notes = $('#f-notes', sheet).value.trim();
    d.updated = Date.now();
    if (isNew) d.created = Date.now();
    try { await put('items', d); }
    catch (err) { toast('Enregistrement impossible : espace de stockage plein ?'); return; }
    if (opts.fromShop) await del('shopping', opts.fromShop);
    await loadAll();
    refreshCurrent();
    openDetail(d.id);
    toast(opts.fromShop ? 'Ajouté à l’inventaire.' : 'Article enregistré.');
  };
}

/* ---------- catégories ---------- */
function openCats() {
  const draw = () => {
    $('#cat-list', sheet).innerHTML = cats.map(c => {
      const n = items.filter(i => i.cat === c.id).length;
      return `<div class="catrow"><span class="body"><strong>${esc(c.name)}</strong><span class="meta">${n} article${n > 1 ? 's' : ''}</span></span>
        <button class="icon" data-ren="${c.id}" aria-label="Renommer ${esc(c.name)}">${ICON.edit}</button>
        <button class="icon" data-del="${c.id}" aria-label="Supprimer ${esc(c.name)}">${ICON.trash}</button></div>`;
    }).join('') || '<p class="empty">Aucune catégorie.</p>';
  };
  openSheet(`
    <header class="sh-head"><button class="icon" data-close aria-label="Fermer">${ICON.back}</button><h2>Catégories</h2></header>
    <div class="sh-body">
      <div class="addcat"><input id="nc" class="field" placeholder="Nouvelle catégorie (ex. Jardin, Jeux)" autocomplete="off"><button class="btn primary" id="nc-add">Ajouter</button></div>
      <div id="cat-list"></div>
    </div>`);
  draw();
  const add = async () => {
    const name = $('#nc', sheet).value.trim();
    if (!name) return;
    await put('categories', { id: uid(), name, order: cats.length });
    await loadAll(); $('#nc', sheet).value = ''; draw();
  };
  $('#nc-add', sheet).onclick = add;
  $('#nc', sheet).onkeydown = e => { if (e.key === 'Enter') add(); };
  $('#cat-list', sheet).onclick = async e => {
    const r = e.target.closest('[data-ren]'), x = e.target.closest('[data-del]');
    if (r) {
      const c = cats.find(c => c.id === r.dataset.ren);
      const name = (prompt('Nouveau nom de la catégorie', c.name) || '').trim();
      if (name) { await put('categories', { ...c, name }); await loadAll(); draw(); }
    } else if (x) {
      const c = cats.find(c => c.id === x.dataset.del);
      const n = items.filter(i => i.cat === c.id).length;
      if (!confirm(n ? `Supprimer « ${c.name} » ? Ses ${n} article(s) passeront en « Sans catégorie ».` : `Supprimer « ${c.name} » ?`)) return;
      for (const i of items.filter(i => i.cat === c.id)) await put('items', { ...i, cat: '', updated: Date.now() });
      for (const sh of shop.filter(x => x.cat === c.id)) await put('shopping', { ...sh, cat: '' });
      await del('categories', c.id); await loadAll(); draw();
    }
  };
}

/* ---------- liste de course ---------- */
function bindCatSelect(sel, value) {
  const draw = v => {
    sel.innerHTML = cats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('') + '<option value="__new">+ Nouvelle catégorie…</option>';
    sel.value = cats.some(c => c.id === v) ? v : (cats[0] ? cats[0].id : '__new');
  };
  draw(value);
  let last = sel.value;
  sel.onchange = async () => {
    if (sel.value !== '__new') { last = sel.value; return; }
    const name = (prompt('Nom de la nouvelle catégorie') || '').trim();
    if (!name) { sel.value = last; return; }
    const c = { id: uid(), name, order: cats.length };
    await put('categories', c); await loadAll();
    draw(c.id); last = c.id;
  };
}

const catRank = id => { const k = cats.findIndex(c => c.id === id); return k < 0 ? 999 : k; };
const shopSorted = () => [...shop].sort((a, b) => catRank(a.cat) - catRank(b.cat) || a.name.localeCompare(b.name, 'fr'));
const shopTotal = list => list.reduce((s, x) => s + (x.price || 0) * (x.qty || 1), 0);

const shopRow = s => `<li class="srow${s.done ? ' done' : ''}" data-id="${s.id}">
  <button class="tick" data-tick aria-pressed="${!!s.done}" aria-label="${s.done ? 'Remettre à acheter' : 'Marquer comme acheté'} : ${esc(s.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg></button>
  ${(s.photos || [])[0] ? `<img class="thumb" src="${urlOf(s.photos[0].thumb)}" alt="" loading="lazy">` : ''}
  <button class="body sbody" data-open><strong>${esc(s.name)}</strong><span class="meta">${esc([s.store, s.notes].filter(Boolean).join(', '))}</span></button>
  <span class="right"><span class="qty">× ${s.qty || 1}</span><span class="price">${s.price != null ? eur(s.price * (s.qty || 1)) : ''}</span></span>
  ${s.done ? '<button class="btn small" data-inv>À l’inventaire</button>' : ''}</li>`;

function renderShopping() {
  view.innerHTML = `
    <div class="searchbar"><input id="sq" type="search" enterkeyhint="search" autocomplete="off" aria-label="Rechercher dans la liste" placeholder="Rechercher dans la liste…" value="${esc(state.sq)}"></div>
    <p class="summary" id="ssum"></p>
    <div class="shopbar"><button class="btn" id="scopy">Copier la liste</button>${navigator.share ? '<button class="btn" id="sshare">Partager</button>' : ''}</div>
    <ul class="list" id="slist"></ul>
    <button class="fab" id="sadd">${ICON.plus}<span>Ajouter</span></button>`;
  $('#sq').addEventListener('input', e => { state.sq = e.target.value; refreshShop(); });
  $('#sadd').onclick = () => openShopForm();
  $('#scopy').onclick = async () => {
    if (!shop.some(s => !s.done)) return toast('Rien à acheter pour l’instant.');
    try { await navigator.clipboard.writeText(shopText()); toast('Liste copiée.'); } catch (e) { toast('Copie impossible sur cet appareil.'); }
  };
  const sh = $('#sshare');
  if (sh) sh.onclick = () => { if (!shop.some(s => !s.done)) return toast('Rien à acheter pour l’instant.'); navigator.share({ title: 'Liste de course', text: shopText() }).catch(() => {}); };
  $('#slist').onclick = async e => {
    const li = e.target.closest('[data-id]');
    if (!li) return;
    const s = shop.find(x => x.id === li.dataset.id);
    if (!s) return;
    if (e.target.closest('[data-tick]')) {
      s.done = !s.done;
      await put('shopping', s); await loadAll(); refreshShop();
    } else if (e.target.closest('[data-inv]')) toInventory(s);
    else openShopForm(s);
  };
  refreshShop();
}

function refreshShop() {
  const t = norm(state.sq).split(/\s+/).filter(Boolean);
  const all = shopSorted().filter(s => { const h = norm([s.name, s.notes, s.store, s.url, catName(s.cat)].join(' ')); return t.every(x => h.includes(x)); });
  const todo = all.filter(s => !s.done), bought = all.filter(s => s.done);
  $('#ssum').textContent = shop.length ? `${todo.length} à acheter, estimation ${eur(shopTotal(todo))}${bought.length ? `, ${bought.length} déjà acheté${bought.length > 1 ? 's' : ''}` : ''}` : '';
  if (!shop.length) { $('#slist').innerHTML = '<li class="empty">Votre liste est vide.<br>Touchez « Ajouter » pour noter un outil ou un accessoire à acheter.</li>'; return; }
  if (!all.length) { $('#slist').innerHTML = `<li class="empty">Aucun résultat pour « ${esc(state.sq)} ».</li>`; return; }
  let h = '', last = null;
  for (const s of todo) {
    const cn = catName(s.cat);
    if (cn !== last) { h += `<li class="grp">${esc(cn)}</li>`; last = cn; }
    h += shopRow(s);
  }
  if (bought.length) h += '<li class="grp">Déjà achetés</li>' + bought.map(shopRow).join('');
  $('#slist').innerHTML = h;
}

function shopText() {
  const todo = shopSorted().filter(s => !s.done);
  const lines = [`Liste de course du ${fmtDate(Date.now())}`];
  let last = null;
  for (const s of todo) {
    const cn = catName(s.cat);
    if (cn !== last) { lines.push('', cn.toUpperCase()); last = cn; }
    lines.push(`- ${s.name} × ${s.qty || 1}${s.price != null ? ' (environ ' + eur(s.price * (s.qty || 1)) + ')' : ''}${s.store ? ', ' + s.store : ''}${s.url ? ', ' + s.url : ''}`);
  }
  lines.push('', `Total estimé : ${eur(shopTotal(todo))}`);
  return lines.join('\n');
}

function toInventory(s) {
  openForm({ id: uid(), name: s.name, cat: s.cat, qty: s.qty || 1, price: s.price, date: today(), store: s.store, url: s.url, description: '', location: '', notes: s.notes || '', photos: [...(s.photos || [])] }, false, { fromShop: s.id, fresh: true });
}

function openShopForm(s, opts = {}) {
  const isNew = !s;
  const d = s ? { ...s, photos: [...(s.photos || [])] } : { id: uid(), name: '', cat: cats[0] ? cats[0].id : '', qty: 1, price: null, store: DEFAULT_STORE, url: opts.link || '', notes: '', done: false, photos: [] };
  openSheet(`
    <header class="sh-head"><button class="icon" data-close aria-label="Annuler">${ICON.back}</button><h2>${isNew ? 'Nouvel article à acheter' : 'Modifier'}</h2></header>
    <div class="sh-body form">
      ${photoPickerHtml('s')}
      <label>Outil ou accessoire<input id="s-name" class="field" autocomplete="off" value="${esc(d.name)}"></label>
      <label>Catégorie<select id="s-cat"></select></label>
      <div class="two">
        <label>Quantité<input id="s-qty" class="field" type="number" min="1" inputmode="numeric" value="${d.qty || 1}"></label>
        <label>Prix estimé par unité (€)<input id="s-price" class="field" inputmode="decimal" value="${d.price != null ? String(d.price).replace('.', ',') : ''}"></label>
      </div>
      <label>Où l’acheter<input id="s-store" class="field" value="${esc(d.store)}"></label>
      <label>Lien vers l’article<input id="s-url" class="field" inputmode="url" autocapitalize="off" placeholder="https://" value="${esc(d.url)}"></label>
      <button type="button" class="btn wide" id="s-auto">Remplir automatiquement depuis ce lien</button>
      <p class="hint" id="s-automsg" role="status" aria-live="polite"></p>
      <label>Notes (référence, dimensions, pourquoi)<textarea id="s-notes" rows="3">${esc(d.notes)}</textarea></label>
      ${d.url ? `<a class="btn wide" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">Ouvrir la fiche en ligne</a>` : ''}
      ${isNew ? '' : '<button class="btn wide" id="s-inv">Acheté : l’ajouter à l’inventaire</button><button class="btn wide danger" id="s-del">Supprimer de la liste</button>'}
    </div>
    <footer class="sh-foot"><button class="btn" data-close>Annuler</button><button class="btn primary" id="s-save">Enregistrer</button></footer>`);
  const sel = $('#s-cat', sheet);
  bindCatSelect(sel, d.cat);
  const drawShopPhotos = bindPhotoPicker('s', d);
  const runAutoS = bindAutofill('s', sel, { count: () => d.photos.length, add: async p => { d.photos.push(p); drawShopPhotos(); } });
  if (opts.auto && d.url) runAutoS();
  $('#s-save', sheet).onclick = async () => {
    const name = $('#s-name', sheet).value.trim();
    if (!name) { toast('Indiquez le nom de l’article.'); $('#s-name', sheet).focus(); return; }
    const pr = parseFloat(String($('#s-price', sheet).value).replace(/\s/g, '').replace(',', '.'));
    d.name = name;
    d.cat = sel.value === '__new' ? '' : sel.value;
    d.qty = Math.max(1, parseInt($('#s-qty', sheet).value, 10) || 1);
    d.price = isNaN(pr) ? null : pr;
    d.store = $('#s-store', sheet).value.trim();
    d.url = fixUrl($('#s-url', sheet).value);
    d.notes = $('#s-notes', sheet).value.trim();
    d.updated = Date.now();
    if (isNew) d.created = Date.now();
    await put('shopping', d); await loadAll();
    closeSheet();
    setTimeout(() => toast('Ajouté à la liste.'), 200);
  };
  const inv = $('#s-inv', sheet);
  if (inv) inv.onclick = () => toInventory(d);
  const rm = $('#s-del', sheet);
  if (rm) rm.onclick = async () => {
    if (!confirm(`Supprimer « ${d.name} » de la liste ?`)) return;
    await del('shopping', d.id); await loadAll(); closeSheet();
  };
}

/* ---------- réglages, sauvegarde ---------- */
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (state.tab === 'set' && !sheet.open) renderSettings(); });
addEventListener('appinstalled', () => { installEvt = null; toast('Application installée.'); if (state.tab === 'set' && !sheet.open) renderSettings(); });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function showInstallHelp() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  openSheet(`
    <header class="sh-head"><button class="icon" data-close aria-label="Fermer">${ICON.back}</button><h2>Installer l’application</h2></header>
    <div class="sh-body">
      ${ios ? `<ol>
        <li>Ouvrez cette page dans <strong>Safari</strong>.</li>
        <li>Touchez le bouton <strong>Partager</strong> (carré avec une flèche).</li>
        <li>Choisissez <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.</li>
      </ol>` : `<ol>
        <li>Ouvrez cette page dans <strong>Chrome</strong> (pas dans une fenêtre intégrée à une autre application).</li>
        <li>Touchez le menu <strong>⋮</strong> en haut à droite.</li>
        <li>Choisissez <strong>Installer l’application</strong> (ou <strong>Ajouter à l’écran d’accueil</strong>), puis confirmez.</li>
      </ol>
      <p class="muted">Si l’option n’apparaît pas : attendez quelques secondes sur la page, rechargez-la une fois, puis rouvrez le menu. L’adresse doit commencer par https://.</p>`}
    </div>`);
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function exportJSON() {
  toast('Préparation de la sauvegarde…');
  const out = { app: 'inventaire-outils', version: 1, exported: new Date().toISOString(), categories: cats, shopping: [], items: [] };
  for (const x of shop) out.shopping.push({ ...x, photos: await Promise.all((x.photos || []).map(p => blobToData(p.full))) });
  for (const i of items) out.items.push({ ...i, photos: await Promise.all((i.photos || []).map(p => blobToData(p.full))) });
  download(new Blob([JSON.stringify(out)], { type: 'application/json' }), `outils-${today()}.json`);
  localStorage.setItem('lastBackupOutils', String(Date.now()));
  renderSettings();
}

function exportCSV() {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
  const head = ['Catégorie', 'Nom', 'Quantité', 'Prix unitaire', 'Total', 'Date d’achat', 'Lieu d’achat', 'Emplacement', 'Lien', 'Descriptif', 'Notes'];
  const rows = items.map(i => [catName(i.cat), i.name, i.qty || 1, i.price != null ? String(i.price).replace('.', ',') : '', i.price != null ? String(i.price * (i.qty || 1)).replace('.', ',') : '', i.date ? fmtDay(i.date) : '', i.store, i.location, i.url, i.description, i.notes].map(q).join(';'));
  download(new Blob(['\ufeff' + [head.map(q).join(';'), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' }), `outils-${today()}.csv`);
}

async function importJSON(file, replace) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'inventaire-outils') throw new Error('format');
    if (replace) for (const n of ['items', 'categories', 'shopping']) await clearStore(n);
    for (const c of data.categories || []) await put('categories', c);
    for (const c of data.shopping || []) {
      const photos = [];
      for (const dUrl of c.photos || []) {
        if (typeof dUrl !== 'string') continue;
        const blob = await (await fetch(dUrl)).blob();
        photos.push({ full: blob, thumb: await shrink(blob, 360, .75) });
      }
      await put('shopping', { ...c, photos });
    }
    toast('Import en cours…');
    for (const i of data.items || []) {
      const photos = [];
      for (const dUrl of i.photos || []) {
        const blob = await (await fetch(dUrl)).blob();
        photos.push({ full: blob, thumb: await shrink(blob, 360, .75) });
      }
      await put('items', { ...i, photos });
    }
    await loadAll();
    toast(`${(data.items || []).length} article(s) importé(s).`);
    renderSettings();
  } catch (e) {
    toast('Fichier non reconnu : choisissez une sauvegarde de cette application.');
  }
}

async function renderSettings() {
  const nPhotos = [...items, ...shop].reduce((n, i) => n + (i.photos || []).length, 0);
  let usage = '';
  try {
    const est = await navigator.storage.estimate();
    usage = `${(est.usage / 1048576).toFixed(1)} Mo utilisés sur l’appareil`;
  } catch (e) { /* indisponible */ }
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  const last = localStorage.getItem('lastBackupOutils');
  if (state.tab !== 'set') return;
  view.innerHTML = `<section class="pad">
    <h2>Vos données</h2>
    <p class="muted">${items.length} article${items.length > 1 ? 's' : ''}, ${nPhotos} photo${nPhotos > 1 ? 's' : ''}, ${shop.length} dans la liste de course${usage ? ', ' + usage : ''}.<br>
    Elles sont enregistrées sur cet appareil, pas sur GitHub. Faites une sauvegarde régulière.</p>
    <p class="muted">${last ? 'Dernière sauvegarde : ' + fmtDateTime(+last) : 'Aucune sauvegarde faite depuis ce téléphone.'}</p>
    <button class="btn primary wide" id="exp">Sauvegarder (fichier avec photos)</button>
    <label class="btn wide">Restaurer en ajoutant à l’existant<input id="imp1" type="file" accept="application/json,.json" hidden></label>
    <label class="btn wide danger">Restaurer en remplaçant tout<input id="imp2" type="file" accept="application/json,.json" hidden></label>
    <button class="btn wide" id="csv">Exporter en tableur (CSV, sans photos)</button>
    <h3>Remplissage automatique</h3>
    <p class="muted">Adresse du relais Cloudflare qui lit les pages des magasins (voir le guide).</p>
    <input id="relay" class="field" inputmode="url" autocapitalize="off" placeholder="https://mes-outils-relais.xxx.workers.dev" value="${esc(relayUrl())}">
    <button class="btn wide" id="relay-save">Enregistrer et tester</button>
    <p class="muted" id="relay-msg" role="status" aria-live="polite"></p>
    <h3>Application</h3>
    ${isStandalone() ? '<p class="muted">Application déjà installée sur cet appareil.</p>' : '<button class="btn wide" id="inst">Installer sur l’écran d’accueil</button>'}
    ${persisted ? '<p class="muted">Stockage protégé contre le nettoyage automatique.</p>' : '<button class="btn wide" id="pers">Protéger les données contre le nettoyage automatique</button>'}
  </section>`;
  $('#exp').onclick = exportJSON;
  $('#relay-save').onclick = async () => {
    const v = fixUrl($('#relay').value).replace(/\/+$/, '');
    const out = $('#relay-msg');
    if (!v) { localStorage.removeItem('relayOutils'); out.textContent = 'Adresse effacée.'; return; }
    localStorage.setItem('relayOutils', v);
    out.textContent = 'Test en cours…';
    try { const r = await relayGet('?ping=1'); out.textContent = r && r.pong ? 'Le relais répond : tout est prêt.' : 'Cette adresse ne ressemble pas au relais.'; }
    catch (e) { out.textContent = 'Le relais ne répond pas. Vérifiez l’adresse.'; }
  };
  $('#csv').onclick = exportCSV;
  $('#imp1').onchange = e => { const f = e.target.files[0]; if (f) importJSON(f, false); e.target.value = ''; };
  $('#imp2').onchange = e => { const f = e.target.files[0]; if (f && confirm('Remplacer tout l’inventaire actuel par cette sauvegarde ?')) importJSON(f, true); e.target.value = ''; };
  const inst = $('#inst');
  if (inst) inst.onclick = async () => {
    if (!installEvt) return showInstallHelp();
    try {
      installEvt.prompt();
      await installEvt.userChoice;
    } catch (e) { installEvt = null; return showInstallHelp(); }
    installEvt = null;
    renderSettings();
  };
  const pers = $('#pers');
  if (pers) pers.onclick = async () => { const ok = await navigator.storage.persist(); toast(ok ? 'Stockage protégé.' : 'Le navigateur a refusé : installez d’abord l’application.'); renderSettings(); };
}

/* ---------- démarrage ---------- */

/* ---------- lien reçu par le menu « Partager » du téléphone ---------- */
function handleShare() {
  const q = new URLSearchParams(location.search);
  if (!q.has('url') && !q.has('text') && !q.has('title')) return;
  const link = firstLink(q.get('url'), q.get('text'), q.get('title'));
  history.replaceState(null, '', location.pathname);
  if (!link) { toast('Aucun lien trouvé dans ce partage.'); return; }
  openSheet(`
    <header class="sh-head"><button class="icon" data-close aria-label="Annuler">${ICON.back}</button><h2>Ajouter cet article</h2></header>
    <div class="sh-body form">
      <p class="muted" style="overflow-wrap:anywhere">${esc(link)}</p>
      <button class="btn primary wide" id="sh-inv">Je l’ai déjà : l’ajouter à l’inventaire</button>
      <button class="btn wide" id="sh-shop">Je veux l’acheter : liste de course</button>
    </div>`);
  $('#sh-inv', sheet).onclick = () => openForm(null, false, { link, auto: true });
  $('#sh-shop', sheet).onclick = () => openShopForm(null, { link, auto: true });
}

(async function init() {
  try {
    db = await openDB();
    await loadAll();
    await seed();
  } catch (e) {
    view.innerHTML = '<p class="empty">Le stockage local est indisponible (navigation privée ?). Ouvrez l’application dans une fenêtre normale.</p>';
    return;
  }
  history.replaceState(null, '');
  setTab('inv');
  handleShare();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
