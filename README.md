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

Si `DATABASE_URL` est défini, les données sont stockées dans PostgreSQL (table `etat`, créée automatiquement). Sinon, elles vont dans `data/db.json`, qui est effacé à chaque redéploiement sur le plan gratuit de Render.

Base gratuite recommandée : [Neon](https://neon.tech) → créer un projet, copier la *connection string* (`postgresql://...`) et la coller dans la variable `DATABASE_URL` sur Render.

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
