// Test rapide de l'algorithme : node test-algo.js
const { repartir, compatible } = require('./algo');

const deps = ['Informatique', 'Génie Civil', 'Génie Électrique', 'Gestion', 'Génie Chimique', 'Mécanique'];
const membres = Array.from({ length: 41 }, (_, i) => ({
  id: 'm' + i,
  nom: 'Personne ' + (i + 1),
  departement: deps[i % deps.length],
  sexe: Math.random() < 0.5 ? 'F' : 'M',
  nonMixte: Math.random() < 0.2,
  malade: Math.random() < 0.3,
}));

const r = repartir(membres);
let ok = true;
for (const e of r.equipes) {
  for (let i = 0; i < e.membres.length; i++)
    for (let j = i + 1; j < e.membres.length; j++)
      if (!compatible(e.membres[i], e.membres[j])) { ok = false; console.log('❌ Équipe invalide', e); }
}
const total = r.equipes.reduce((s, e) => s + e.membres.length, 0) + r.nonAffectes.length;
console.log(`${r.equipes.length} équipes, ${r.nonAffectes.length} non affecté(s), total ${total}/${membres.length}`);
console.log(ok && total === membres.length ? '✅ Toutes les contraintes sont respectées' : '❌ Problème');
process.exit(ok && total === membres.length ? 0 : 1);
