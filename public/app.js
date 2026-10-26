const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = { groupes: [], courant: null, sexe: 'F', tab: 'membres' };

async function api(url, opts = {}) {
  const r = await fetch(url, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 401 && !url.endsWith('/login')) { showLogin(); throw new Error('Session expirée'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Erreur');
  return data;
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Auth ---------- */
function showLogin() { $('#login').classList.remove('hidden'); $('#app').classList.add('hidden'); $('#pwd').focus(); }
function showApp() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); }

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('#loginErr').textContent = '';
  try {
    await api('/api/login', { method: 'POST', body: { password: $('#pwd').value } });
    $('#pwd').value = ''; showApp(); await loadGroupes();
  } catch (err) { $('#loginErr').textContent = err.message; }
});
$('#logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); showLogin(); });

/* ---------- Groupes ---------- */
async function loadGroupes(selectId) {
  state.groupes = await api('/api/groupes');
  const id = selectId || state.courant?.id || localStorage.getItem('groupe') || state.groupes[0]?.id;
  renderGroupList();
  if (id && state.groupes.some(g => g.id === id)) await openGroupe(id);
  else { state.courant = null; renderGroupe(); }
}

function renderGroupList() {
  $('#groupList').innerHTML = state.groupes.map(g => `
    <button class="group-item ${state.courant?.id === g.id ? 'active' : ''}" data-id="${g.id}">
      <span>${esc(g.nom)}</span><span class="n">${g.nbMembres}</span>
    </button>`).join('') || '<p class="muted small" style="padding:0 6px">Aucun groupe</p>';
}
$('#groupList').addEventListener('click', e => {
  const b = e.target.closest('.group-item'); if (b) openGroupe(b.dataset.id);
});

$('#newGroup').addEventListener('submit', async e => {
  e.preventDefault();
  const nom = $('#newGroupName').value.trim(); if (!nom) return;
  const g = await api('/api/groupes', { method: 'POST', body: { nom } });
  $('#newGroupName').value = '';
  await loadGroupes(g.id); toast('Groupe créé');
});

async function openGroupe(id) {
  state.courant = await api('/api/groupes/' + id);
  try { localStorage.setItem('groupe', id); } catch {}
  renderGroupList(); renderGroupe();
}

function syncCount() {
  const g = state.courant, s = state.groupes.find(x => x.id === g.id);
  if (s) s.nbMembres = g.membres.length;
  renderGroupList();
}

$('#groupName').addEventListener('click', () => {
  const h = $('#groupName'); h.contentEditable = 'true'; h.focus();
  document.getSelection().selectAllChildren(h);
});
$('#groupName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
$('#groupName').addEventListener('blur', async () => {
  const h = $('#groupName'); h.contentEditable = 'false';
  const nom = h.textContent.trim();
  if (!nom || nom === state.courant.nom) { h.textContent = state.courant.nom; return; }
  await api('/api/groupes/' + state.courant.id, { method: 'PATCH', body: { nom } });
  state.courant.nom = nom; await loadGroupes(state.courant.id); toast('Groupe renommé');
});

$('#deleteGroup').addEventListener('click', async () => {
  if (!confirm(`Supprimer « ${state.courant.nom} » et tous ses membres ?`)) return;
  await api('/api/groupes/' + state.courant.id, { method: 'DELETE' });
  state.courant = null; try { localStorage.removeItem('groupe'); } catch {}
  await loadGroupes(); toast('Groupe supprimé');
});

/* ---------- Onglets ---------- */
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));
function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('#tab-membres').classList.toggle('hidden', tab !== 'membres');
  $('#tab-repartition').classList.toggle('hidden', tab !== 'repartition');
}

/* ---------- Rendu groupe ---------- */
function renderGroupe() {
  const g = state.courant;
  $('#empty').classList.toggle('hidden', !!g);
  $('#groupView').classList.toggle('hidden', !g);
  if (!g) return;
  $('#groupName').textContent = g.nom;
  renderMembres(); renderResultat();
}

function updateMemberImportExportLinks() {
  if (!state.courant) return;
  $('#importTemplateBtn').href = `/api/groupes/${state.courant.id}/import-template.csv`;
  $('#exportMembersBtn').href = `/api/groupes/${state.courant.id}/export.membres.csv`;
}

function renderMembres() {
  const g = state.courant, q = $('#search').value.trim().toLowerCase();
  const list = g.membres.filter(m => !q || (m.nom + ' ' + m.departement + ' ' + (m.telephone || '')).toLowerCase().includes(q));
  $('#countBadge').textContent = g.membres.length;
  $('#noMembers').classList.toggle('hidden', g.membres.length > 0);

  const f = g.membres.filter(m => m.sexe === 'F').length;
  const deps = [...new Set(g.membres.map(m => m.departement))];
  const malades = g.membres.filter(m => m.malade).length;
  $('#stats').textContent = g.membres.length
    ? `${f} filles · ${g.membres.length - f} garçons · ${deps.length} départements · ${malades} malade(s)` : '';
  $('#depList').innerHTML = deps.map(d => `<option value="${esc(d)}">`).join('');

  $('#memberRows').innerHTML = list.map(m => `
    <tr data-id="${m.id}">
      <td><input class="edit" data-k="nom" value="${esc(m.nom)}" /></td>
      <td><input class="edit" data-k="departement" value="${esc(m.departement)}" list="depList" /></td>
      <td><input class="edit" data-k="telephone" value="${esc(m.telephone || '')}" placeholder="-" /></td>
      <td>
        <div class="seg small" data-k="sexe">
          <button type="button" data-v="F" class="${m.sexe === 'F' ? 'on' : ''}">F</button>
          <button type="button" data-v="M" class="${m.sexe === 'M' ? 'on' : ''}">M</button>
        </div>
      </td>
      <td class="c"><label class="check"><input type="checkbox" data-k="nonMixte" ${m.nonMixte ? 'checked' : ''}></label></td>
      <td class="c"><label class="check"><input type="checkbox" data-k="malade" ${m.malade ? 'checked' : ''}></label></td>
      <td class="c"><button class="btn ghost danger small del" title="Retirer">Retirer</button></td>
    </tr>`).join('');
  updateMemberImportExportLinks();
}
$('#search').addEventListener('input', renderMembres);

// Sexe (segmented control)
$('#fSexe').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.sexe = b.dataset.v;
  $('#fSexe').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
});

$('#addForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    nom: $('#fNom').value, departement: $('#fDep').value, sexe: state.sexe,
    nonMixte: $('#fNonMixte').checked, malade: $('#fMalade').checked,
    telephone: $('#fTel').value,
  };
  try {
    const m = await api(`/api/groupes/${state.courant.id}/membres`, { method: 'POST', body });
    state.courant.membres.push(m);
    $('#fNom').value = ''; $('#fTel').value = ''; $('#fNonMixte').checked = false; $('#fMalade').checked = false;
    $('#fNom').focus(); // on garde le département pour enchaîner les saisies
    renderMembres(); syncCount(); toast(`${m.nom} ajouté(e)`);
  } catch (err) { toast(err.message); }
});

$('#memberRows').addEventListener('change', async e => {
  const target = e.target;
  const tr = target.closest('tr'); if (!tr) return;
  const id = tr.dataset.id;
  if (target.matches('input[type=checkbox]') && target.dataset.k) {
    const k = target.dataset.k;
    try {
      const m = await api(`/api/groupes/${state.courant.id}/membres/${id}`, { method: 'PATCH', body: { [k]: target.checked } });
      Object.assign(state.courant.membres.find(x => x.id === id), m);
      renderMembres();
    } catch (err) { toast(err.message); renderMembres(); }
    return;
  }
  if (target.matches('input.edit') && target.dataset.k) {
    const k = target.dataset.k;
    try {
      const m = await api(`/api/groupes/${state.courant.id}/membres/${id}`, { method: 'PATCH', body: { [k]: target.value } });
      Object.assign(state.courant.membres.find(x => x.id === id), m);
      toast('Membre mis à jour');
      renderMembres();
    } catch (err) { toast(err.message); renderMembres(); }
  }
});

$('#memberRows').addEventListener('click', async e => {
  const seg = e.target.closest('.seg[data-k]');
  if (seg) {
    const btn = e.target.closest('button'); if (!btn) return;
    const tr = seg.closest('tr'); const id = tr.dataset.id;
    const k = seg.dataset.k; const v = btn.dataset.v;
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === btn));
    try {
      const m = await api(`/api/groupes/${state.courant.id}/membres/${id}`, { method: 'PATCH', body: { [k]: v } });
      Object.assign(state.courant.membres.find(x => x.id === id), m);
      toast('Membre mis à jour');
    } catch (err) { toast(err.message); renderMembres(); }
    return;
  }
$('#memberRows').addEventListener('click', async e => {
  if (!e.target.closest('.del')) return;
  const tr = e.target.closest('tr');
  const id = tr.dataset.id;
  const nom = tr.querySelector('input.edit[data-k="nom"]')?.value || '';
  if (!confirm(`Retirer « ${nom || 'ce membre'} » du groupe ?`)) return;
  try {
    await api(`/api/groupes/${state.courant.id}/membres/${id}`, { method: 'DELETE' });
    state.courant.membres = state.courant.membres.filter(x => x.id !== id);
    renderMembres(); syncCount();
  } catch (err) { toast(err.message); }
});

$('#importBtn').addEventListener('click', async () => {
  const texte = $('#importText').value; if (!texte.trim()) return;
  const r = await api(`/api/groupes/${state.courant.id}/import`, { method: 'POST', body: { texte } });
  $('#importMsg').textContent = `${r.ajoutes} ajouté(s)` + (r.erreurs.length ? ` · ${r.erreurs.length} ligne(s) ignorée(s) : ${r.erreurs.slice(0, 3).join(', ')}` : '');
  if (!r.erreurs.length) $('#importText').value = '';
  await openGroupe(state.courant.id); syncCount();
});

/* ---------- Répartition ---------- */
$('#runBtn').addEventListener('click', async () => {
  const b = $('#runBtn'); b.disabled = true; b.textContent = 'Calcul…';
  try {
    state.courant.resultat = await api(`/api/groupes/${state.courant.id}/repartir`, { method: 'POST' });
    renderResultat(); toast('Répartition effectuée');
  } catch (err) { toast(err.message); }
  b.disabled = false; b.textContent = 'Relancer la répartition';
});

function memberHtml(m) {
  return `<div class="member">
    <div><div class="nm">${esc(m.nom)}</div><div class="dp">${esc(m.departement)}</div></div>
    <div class="tags">
      <span class="tag">${m.sexe === 'F' ? 'F' : 'G'}</span>
      ${m.malade ? '<span class="tag sick">Malade</span>' : ''}
      ${m.nonMixte ? '<span class="tag">Non mixte</span>' : ''}
    </div></div>`;
}

function renderResultat() {
  const r = state.courant.resultat;
  $('#result').classList.toggle('hidden', !r);
  $('#runBtn').textContent = r ? 'Relancer la répartition' : 'Lancer la répartition';
  if (!r) return;
  const trios = r.equipes.filter(e => e.membres.length === 3).length;
  $('#resultTitle').textContent = `${r.equipes.length} équipes` + (trios ? ` (dont ${trios} trio)` : '');
  $('#resultDate').textContent = 'Générée le ' + new Date(r.date).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

  const warn = $('#warn');
  if (r.nonAffectes.length) {
    warn.classList.remove('hidden');
    warn.textContent = `${r.nonAffectes.length} personne(s) n'ont pas pu être appariées avec les contraintes actuelles (même département, malades ou refus de mixité). Ajoutez des membres compatibles ou ajustez les critères.`;
  } else warn.classList.add('hidden');

  $('#teams').innerHTML =
    r.equipes.map(e => `<div class="team"><div class="team-n">Équipe ${e.numero}</div>${e.membres.map(memberHtml).join('')}</div>`).join('') +
    (r.nonAffectes.length ? `<div class="team bad"><div class="team-n">Non affectés</div>${r.nonAffectes.map(memberHtml).join('')}</div>` : '');
  updateExportLinks();
}

function updateExportLinks() {
  if (!state.courant) return;
  const q = $('#details').checked ? '?details=1' : '';
  $('#pdfBtn').href = `/api/groupes/${state.courant.id}/export.pdf${q}`;
  $('#csvBtn').href = `/api/groupes/${state.courant.id}/export.csv${q}`;
}
$('#details').addEventListener('change', updateExportLinks);

/* ---------- Démarrage ---------- */
(async () => {
  const { connecte } = await api('/api/me');
  if (connecte) { showApp(); await loadGroupes(); } else showLogin();
})();
