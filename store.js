// Stockage simple dans un fichier JSON (aucune base de données à configurer).
// Sur Render, définir DATA_DIR vers un disque persistant pour garder les données entre les déploiements.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

let db = { groupes: [] };
try {
  db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch { /* premier démarrage */ }

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, FILE);
  }, 50);
}

const id = () => crypto.randomBytes(6).toString('hex');

module.exports = {
  id,
  save,
  get groupes() { return db.groupes; },
  groupe(gid) { return db.groupes.find(g => g.id === gid); },
};
