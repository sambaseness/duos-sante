# Duos Santé

Application web de la Commission Santé : le super admin crée des groupes, ajoute les membres et génère automatiquement des duos, puis exporte la liste en PDF ou CSV.

## Règles de l'algorithme

Chaque duo respecte :

1. **Départements différents**
2. **Au moins une personne non malade**
3. **Pas de duo mixte** si l'un des deux a coché « Refuse un duo mixte »

Si le nombre de membres est impair, la personne restante rejoint un duo compatible (trio). Si personne ne peut être apparié avec les contraintes, il apparaît dans « Non affectés ».

## Lancer en local

```bash
npm install
ADMIN_PASSWORD=monmotdepasse npm start
# → http://localhost:3000
```

Test de l'algorithme : `npm test`

## Déployer sur Render

1. Pousser ce dossier sur un dépôt GitHub.
2. Sur [render.com](https://render.com) : **New → Blueprint**, choisir le dépôt (le fichier `render.yaml` configure tout).
3. Saisir la variable **`ADMIN_PASSWORD`** demandée, puis **Apply**.

Ou manuellement : **New → Web Service**, Build `npm install`, Start `npm start`, et ajouter `ADMIN_PASSWORD` + `SESSION_SECRET` dans *Environment*.

### Persistance des données

Les données sont stockées dans `data/db.json`. Sur le plan gratuit de Render, le disque est réinitialisé à chaque redéploiement ou mise en veille prolongée. Pour garder les données : ajouter un **Disk** (plan payant) monté sur `/var/data` et définir `DATA_DIR=/var/data`. Pensez sinon à exporter le CSV après chaque répartition.

## Import en masse

Onglet Membres → « Importer une liste », une personne par ligne :

```
Nom;Département;Sexe;Non mixte;Malade
Awa Diop;Informatique;F;non;oui
Moussa Fall;Génie Civil;M;oui;non
```

Fonctionne aussi en copier-coller depuis Excel (tabulations).

## Stack

Node.js + Express, HTML/CSS/JS sans framework, PDFKit pour le PDF. Aucune base de données à configurer.
