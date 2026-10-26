const express = require('express');
const crypto = require('crypto');
const path = require('path');
const PDFDocument = require('pdfkit');
const store = require('./store');
const { repartir } = require('./algo');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE = 'duos_session';
const DUREE = 1000 * 60 * 60 * 12; // 12 h

if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  ADMIN_PASSWORD non défini : mot de passe par défaut "admin".');
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

// ---------- Authentification (cookie signé, sans dépendance) ----------
function sign(exp) {
  return exp + '.' + crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex');
}
function verify(token) {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp).split('.')[1];
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const m = raw.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function auth(req, res, next) {
  if (verify(readCookie(req, COOKIE))) return next();
  res.status(401).json({ error: 'Non autorisé' });
}

app.post('/api/login', (req, res) => {
  const pwd = String(req.body?.password || '');
  const ok = pwd.length === ADMIN_PASSWORD.length &&
    crypto.timingSafeEqual(Buffer.from(pwd), Buffer.from(ADMIN_PASSWORD));
  if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${COOKIE}=${encodeURIComponent(sign(Date.now() + DUREE))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${DUREE / 1000}${secure}`);
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ ok: true });
});
app.get('/api/me', (req, res) => res.json({ connecte: verify(readCookie(req, COOKIE)) }));

// ---------- Helpers ----------
function cleanMembre(b) {
  const nom = String(b.nom || '').trim();
  const departement = String(b.departement || '').trim();
  const s = String(b.sexe || '').trim().toUpperCase();
  const sexe = ['F', 'FILLE', 'FEMME'].includes(s) ? 'F' : ['M', 'H', 'G', 'GARCON', 'GARÇON', 'HOMME'].includes(s) ? 'M' : null;
  if (!nom || !departement || !sexe) return null;
  return { nom, departement, sexe, nonMixte: !!b.nonMixte, malade: !!b.malade };
}
function getGroupe(req, res) {
  const g = store.groupe(req.params.id);
  if (!g) res.status(404).json({ error: 'Groupe introuvable' });
  return g;
}
const truthy = v => ['1', 'oui', 'o', 'yes', 'y', 'x', 'true', 'vrai'].includes(String(v || '').trim().toLowerCase());

// ---------- Groupes ----------
app.get('/api/groupes', auth, (req, res) => {
  res.json(store.groupes.map(g => ({
    id: g.id, nom: g.nom, creeLe: g.creeLe,
    nbMembres: g.membres.length, aResultat: !!g.resultat,
  })));
});
app.post('/api/groupes', auth, (req, res) => {
  const nom = String(req.body?.nom || '').trim();
  if (!nom) return res.status(400).json({ error: 'Nom requis' });
  const g = { id: store.id(), nom, creeLe: new Date().toISOString(), membres: [], resultat: null };
  store.groupes.push(g); store.save();
  res.json(g);
});
app.get('/api/groupes/:id', auth, (req, res) => {
  const g = getGroupe(req, res); if (g) res.json(g);
});
app.patch('/api/groupes/:id', auth, (req, res) => {
  const g = getGroupe(req, res); if (!g) return;
  const nom = String(req.body?.nom || '').trim();
  if (nom) g.nom = nom;
  store.save(); res.json(g);
});
app.delete('/api/groupes/:id', auth, (req, res) => {
  const i = store.groupes.findIndex(g => g.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Groupe introuvable' });
  store.groupes.splice(i, 1); store.save();
  res.json({ ok: true });
});

// ---------- Membres ----------
app.post('/api/groupes/:id/membres', auth, (req, res) => {
  const g = getGroupe(req, res); if (!g) return;
  const m = cleanMembre(req.body || {});
  if (!m) return res.status(400).json({ error: 'Nom, département et sexe sont requis' });
  m.id = store.id(); g.membres.push(m); store.save();
  res.json(m);
});
app.patch('/api/groupes/:id/membres/:mid', auth, (req, res) => {
  const g = getGroupe(req, res); if (!g) return;
  const m = g.membres.find(x => x.id === req.params.mid);
  if (!m) return res.status(404).json({ error: 'Membre introuvable' });
  const c = cleanMembre({ ...m, ...req.body });
  if (!c) return res.status(400).json({ error: 'Données invalides' });
  Object.assign(m, c); store.save();
  res.json(m);
});
app.delete('/api/groupes/:id/membres/:mid', auth, (req, res) => {
  const g = getGroupe(req, res); if (!g) return;
  g.membres = g.membres.filter(x => x.id !== req.params.mid); store.save();
  res.json({ ok: true });
});

// Import en masse : une ligne par personne → Nom ; Département ; Sexe ; Non mixte ; Malade
app.post('/api/groupes/:id/import', auth, (req, res) => {
  const g = getGroupe(req, res); if (!g) return;
  const lignes = String(req.body?.texte || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let ajoutes = 0; const erreurs = [];
  lignes.forEach((l, i) => {
    const sep = l.includes(';') ? ';' : l.includes('\t') ? '\t' : ',';
    const [nom, departement, sexe, nonMixte, malade] = l.split(sep).map(s => s.trim());
    if (i === 0 && /^nom$/i.test(nom)) return; // ligne d'en-tête
    const m = cleanMembre({ nom, departement, sexe, nonMixte: truthy(nonMixte), malade: truthy(malade) });
    if (!m) { erreurs.push(`Ligne ${i + 1} : « ${l} »`); return; }
    m.id = store.id(); g.membres.push(m); ajoutes++;
  });
  store.save();
  res.json({ ajoutes, erreurs });
});

// ---------- Algorithme ----------
app.post('/api/groupes/:id/repartir', auth, (req, res) => {
  const g = getGroupe(req, res); if (!g) return;
  if (g.membres.length < 2) return res.status(400).json({ error: 'Il faut au moins 2 membres' });
  g.resultat = repartir(g.membres); store.save();
  res.json(g.resultat);
});

// ---------- Exports ----------
function lignesExport(g, details) {
  const rows = [];
  for (const e of g.resultat.equipes) {
    for (const m of e.membres) rows.push({ equipe: `Équipe ${e.numero}`, ...m });
  }
  for (const m of g.resultat.nonAffectes) rows.push({ equipe: 'Non affecté', ...m });
  return rows.map(r => {
    const base = [r.equipe, r.nom, r.departement, r.sexe === 'F' ? 'Fille' : 'Garçon'];
    return details ? [...base, r.malade ? 'Malade' : 'Non malade', r.nonMixte ? 'Oui' : 'Non'] : base;
  });
}
function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'groupe';
}

app.get('/api/groupes/:id/export.csv', auth, (req, res) => {
  const g = getGroupe(req, res); if (!g) return;
  if (!g.resultat) return res.status(400).send('Lancez la répartition d\'abord');
  const details = req.query.details === '1';
  const head = ['Équipe', 'Nom', 'Département', 'Sexe', ...(details ? ['Santé', 'Refuse duo mixte'] : [])];
  const esc = v => /[";\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
  const csv = [head, ...lignesExport(g, details)].map(r => r.map(esc).join(';')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="duos-${slug(g.nom)}.csv"`);
  res.send('﻿' + csv); // BOM pour Excel
});

app.get('/api/groupes/:id/export.pdf', auth, (req, res) => {
  const g = getGroupe(req, res); if (!g) return;
  if (!g.resultat) return res.status(400).send('Lancez la répartition d\'abord');
  const details = req.query.details === '1';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="duos-${slug(g.nom)}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.pipe(res);

  const W = doc.page.width - 96;
  const INK = '#111827', MUTED = '#6b7280', LINE = '#e5e7eb', ACCENT = '#0f766e';

  doc.fillColor(ACCENT).fontSize(9).font('Helvetica-Bold').text('COMMISSION SANTÉ', { characterSpacing: 1 });
  doc.moveDown(0.3);
  doc.fillColor(INK).fontSize(20).font('Helvetica-Bold').text(g.nom);
  doc.moveDown(0.2);
  const d = new Date(g.resultat.date);
  doc.fillColor(MUTED).fontSize(10).font('Helvetica')
    .text(`Répartition du ${d.toLocaleDateString('fr-FR')} · ${g.resultat.equipes.length} équipes · ${g.membres.length} membres`);
  doc.moveDown(1.2);

  const cols = details
    ? [{ t: 'Nom', w: 0.32 }, { t: 'Département', w: 0.26 }, { t: 'Sexe', w: 0.12 }, { t: 'Santé', w: 0.15 }, { t: 'Non mixte', w: 0.15 }]
    : [{ t: 'Nom', w: 0.45 }, { t: 'Département', w: 0.35 }, { t: 'Sexe', w: 0.2 }];

  function ensure(h) {
    if (doc.y + h > doc.page.height - 60) doc.addPage();
  }
  function row(cells, opts = {}) {
    const y = doc.y; let x = 48;
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 10).fillColor(opts.color || INK);
    cells.forEach((c, i) => {
      doc.text(String(c), x + 6, y, { width: cols[i].w * W - 12, lineBreak: false, ellipsis: true });
      x += cols[i].w * W;
    });
    doc.y = y + 20;
  }

  const bloc = (titre, membres) => {
    ensure(30 + membres.length * 20);
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(11).text(titre, 48, doc.y);
    doc.moveDown(0.3);
    const top = doc.y;
    doc.rect(48, top, W, 18).fill('#f3f4f6');
    doc.y = top + 4;
    row(cols.map(c => c.t), { bold: true, size: 8.5, color: MUTED });
    doc.y = top + 22;
    membres.forEach(m => {
      const cells = [m.nom, m.departement, m.sexe === 'F' ? 'Fille' : 'Garçon'];
      if (details) cells.push(m.malade ? 'Malade' : 'Non malade', m.nonMixte ? 'Oui' : 'Non');
      row(cells);
      doc.moveTo(48, doc.y - 4).lineTo(48 + W, doc.y - 4).lineWidth(0.5).strokeColor(LINE).stroke();
    });
    doc.moveDown(0.8);
  };

  g.resultat.equipes.forEach(e => bloc(`Équipe ${e.numero}`, e.membres));
  if (g.resultat.nonAffectes.length) bloc('Non affectés (aucun partenaire compatible)', g.resultat.nonAffectes);

  doc.end();
});

// ---------- Front ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

store.init()
  .then(() => app.listen(PORT, () => console.log(`✅ Duos Santé sur http://localhost:${PORT}`)))
  .catch(e => { console.error('❌ Impossible de charger les données :', e.message); process.exit(1); });
