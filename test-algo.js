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
if (total !== membres.length) ok = false;

// Par défaut les duos sont mixtes : 10 filles + 10 garçons, personne n'a coché « non mixte »
const mixables = Array.from({ length: 20 }, (_, i) => ({
  id: 'x' + i, nom: 'X' + i, departement: deps[i % deps.length],
  sexe: i % 2 ? 'F' : 'M', nonMixte: false, malade: false,
}));
const rm = repartir(mixables);
const nonMixtes = rm.equipes.filter(e => new Set(e.membres.map(m => m.sexe)).size < 2).length;
console.log(`Duos mixtes par défaut : ${rm.equipes.length - nonMixtes}/${rm.equipes.length}`);
if (nonMixtes > 0 || rm.nonAffectes.length) ok = false;

console.log(ok ? '✅ Toutes les contraintes sont respectées' : '❌ Problème');
process.exit(ok ? 0 : 1);
