# Assistant Emploi IA — version GitHub Pages

Application statique compatible GitHub Pages. Elle fonctionne sans serveur, sous forme de tchat IA local.

## Ce que fait l'application

- Interface tchat mobile/PC.
- Réponses locales sur :
  - ateliers R01 à R07 ;
  - prestations AP3, GCO, VS2, UES, AGC, EMG, DES, AIN ;
  - PMSMP / immersion facilitée ;
  - POE ;
  - La Bonne Boîte ;
  - La Bonne Alternance ;
  - Mes Événements Emploi.
- Recherche d'événements dans :
  - `data/evenements.csv` ;
  - `data/evenements.json` ;
  - un fichier CSV/JSON importé dans le navigateur ;
  - une API intranet optionnelle si CORS/HTTPS sont autorisés.

## Limite importante

GitHub Pages est statique. Il ne peut pas interroger directement un intranet France Travail protégé par SSO si aucune API autorisée n'existe.

Pour les événements, la méthode propre est donc :

1. exporter ou constituer un fichier CSV/JSON ;
2. le déposer dans `data/evenements.csv` ;
3. ou utiliser le bouton **Importer** dans l'application ;
4. ou configurer une URL API intranet autorisée dans les réglages.

## Format CSV attendu

Séparateur `;` ou `,` accepté.

```csv
titre;date;heure;ville;lieu;type;modalite;secteur;lien;description
Atelier CV;2026-07-02;09:30;Boulogne-Billancourt;Agence;Atelier;Présentiel;Tous secteurs;https://...;Description
```

Colonnes reconnues :

- `titre` ou `title`
- `date`
- `heure` ou `time`
- `ville` ou `city`
- `lieu` ou `location`
- `type`
- `modalite` ou `mode`
- `secteur`
- `lien`, `url` ou `link`
- `description`, `resume` ou `summary`

## Déploiement simple sur GitHub Pages

1. Créer un nouveau dépôt GitHub.
2. Envoyer tous les fichiers de ce dossier à la racine du dépôt.
3. Aller dans **Settings** > **Pages**.
4. Choisir soit :
   - **Deploy from a branch** > `main` > `/root` ;
   - soit **GitHub Actions** avec le workflow fourni dans `.github/workflows/pages.yml`.
5. Attendre le déploiement, puis ouvrir l'URL GitHub Pages.

## Mode Gemini optionnel

Le mode Gemini existe dans les réglages pour test navigateur.

Ne jamais inscrire une clé API dans le code ou dans le dépôt GitHub. La clé entrée dans l'interface est stockée uniquement dans le navigateur de l'utilisateur.

Pour une vraie production, utiliser un proxy serveur ou une fonction serverless pour protéger les clés.

## Test local

```bash
python -m http.server 8080
```

Puis ouvrir :

```text
http://localhost:8080
```
