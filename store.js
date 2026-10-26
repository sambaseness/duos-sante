// Stockage : PostgreSQL si DATABASE_URL est défini (ex. Neon, gratuit et persistant),
// sinon un simple fichier JSON local (data/db.json) pour le développement.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATABASE_URL = process.env.DATABASE_URL;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'db.json');

let db = { groupes: [] };
let pool = null;

async function init() {
  if (DATABASE_URL) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
    await pool.query('CREATE TABLE IF NOT EXISTS etat (id INT PRIMARY KEY, data JSONB NOT NULL)');
    const { rows } = await pool.query('SELECT data FROM etat WHERE id = 1');
    if (rows[0]) db = rows[0].data;
    console.log('🗄️  Données : PostgreSQL');
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    try {
      db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch { /* premier démarrage */ }
    console.log('🗄️  Données : ' + FILE);
  }
}

async function write() {
  if (pool) {
    await pool.query(
      'INSERT INTO etat (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
      [JSON.stringify(db)]);
  } else {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, FILE);
  }
}

// Écritures regroupées et sérialisées : une seule à la fois, la dernière version gagne.
let timer = null, enCours = Promise.resolve();
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    enCours = enCours.then(write).catch(e => console.error('❌ Sauvegarde échouée :', e.message));
  }, 50);
}

const id = () => crypto.randomBytes(6).toString('hex');

module.exports = {
  init,
  id,
  save,
  get groupes() { return db.groupes; },
  groupe(gid) { return db.groupes.find(g => g.id === gid); },
};
