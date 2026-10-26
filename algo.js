// Algorithme de répartition en duos — Commission Santé
// Contraintes d'un duo :
//  1. Départements différents
//  2. Au moins une personne non malade
//  3. Si l'un des deux refuse la mixité, les deux doivent être du même sexe
// Préférence : par défaut les duos sont mixtes (fille + garçon) ; un duo du même sexe
// n'est formé que si l'un des deux a coché « non mixte » ou si les effectifs l'imposent.

function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase();
}

function compatible(a, b) {
  if (norm(a.departement) === norm(b.departement)) return false;
  if (a.malade && b.malade) return false;
  if ((a.nonMixte || b.nonMixte) && a.sexe !== b.sexe) return false;
  return true;
}

// Duo du même sexe alors que les deux acceptaient la mixité
function evitable(a, b) {
  return a.sexe === b.sexe && !a.nonMixte && !b.nonMixte;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Recherche en profondeur : on apparie d'abord la personne la plus contrainte.
// Renvoie la meilleure solution trouvée (nombre maximum de duos).
function search(people, budget) {
  let best = { pairs: [], left: people.slice() };
  let steps = 0;

  const target = Math.floor(people.length / 2);

  function rec(pool, pairs) {
    if (pairs.length > best.pairs.length) best = { pairs: pairs.slice(), left: [] };
    if (best.pairs.length >= target) return true; // solution parfaite
    if (++steps > budget) return true;            // budget épuisé : on garde le meilleur
    if (pool.length < 2) return false;
    if (pairs.length + Math.floor(pool.length / 2) <= best.pairs.length) return false;
    // Personne avec le moins de partenaires possibles
    let pick = -1, pickOpts = null;
    for (let i = 0; i < pool.length; i++) {
      const opts = [];
      for (let j = 0; j < pool.length; j++) if (i !== j && compatible(pool[i], pool[j])) opts.push(j);
      if (pickOpts === null || opts.length < pickOpts.length) { pick = i; pickOpts = opts; }
      if (opts.length === 0) break;
    }
    if (pickOpts.length === 0) {
      // Cette personne ne peut être appariée : on la met de côté
      return rec(pool.filter((_, k) => k !== pick), pairs);
    }
    const ordre = shuffle(pickOpts)
      .sort((x, y) => evitable(pool[pick], pool[x]) - evitable(pool[pick], pool[y]));
    for (const j of ordre) {
      const a = pool[pick], b = pool[j];
      const rest = pool.filter((_, k) => k !== pick && k !== j);
      pairs.push([a, b]);
      const done = rec(rest, pairs);
      pairs.pop();
      if (done) return true;
    }
    // Dernière option : laisser cette personne de côté
    return rec(pool.filter((_, k) => k !== pick), pairs);
  }

  rec(people, []);
  // Les "left" de best ne contiennent que le pool au moment de la sauvegarde ;
  // on recalcule proprement les non-appariés.
  const used = new Set(best.pairs.flat().map(p => p.id));
  best.left = people.filter(p => !used.has(p.id));
  return best;
}

function tentative(people) {
  const r = search(shuffle(people), 20000);
  const equipes = r.pairs.map(p => p.slice());
  const nonAffectes = [];
  // Personne(s) restante(s) : ajout en trio dans un duo compatible
  for (const p of r.left) {
    const cible = shuffle(equipes.map((e, i) => i))
      .find(i => equipes[i].length === 2 && equipes[i].every(m => compatible(m, p)));
    if (cible !== undefined) equipes[cible].push(p);
    else nonAffectes.push(p);
  }
  return { equipes, nonAffectes };
}

function nbEvitables(r) {
  return r.equipes.filter(e => e.length === 2 && evitable(e[0], e[1])).length;
}

function repartir(members) {
  // Plusieurs tentatives aléatoires : on garde celle qui laisse le moins de personnes sans équipe,
  // puis celle qui a le moins de duos du même sexe évitables.
  const mixables = members.filter(m => !m.nonMixte);
  const f = mixables.filter(m => m.sexe === 'F').length;
  const minEvitables = Math.floor(Math.abs(f - (mixables.length - f)) / 2);
  let best = null, bestEv = Infinity;
  for (let t = 0; t < 40; t++) {
    const r = tentative(members), ev = nbEvitables(r);
    if (!best || r.nonAffectes.length < best.nonAffectes.length ||
        (r.nonAffectes.length === best.nonAffectes.length && ev < bestEv)) { best = r; bestEv = ev; }
    if (best.nonAffectes.length === 0 && bestEv <= minEvitables) break;
  }
  const { equipes, nonAffectes } = best;

  return {
    date: new Date().toISOString(),
    equipes: equipes.map((membres, i) => ({ numero: i + 1, membres })),
    nonAffectes,
  };
}

module.exports = { repartir, compatible };
