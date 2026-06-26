# Assistant parcours emploi — version GitHub Pages France Travail-like

Application web statique compatible GitHub Pages.

## Objectif

Créer un tchat d’orientation crédible pour un usage de démonstration : ateliers, prestations, événements emploi, PMSMP, POE, La Bonne Boîte, La Bonne Alternance et La Bonne Info.

## Changements de cette version

- Direction artistique plus proche d’une interface institutionnelle France Travail : fond clair, bleu principal, cartes sobres, boutons accessibles, repères colorés.
- Logo compatible intégré : il sert de visuel de prototype. Pour un usage officiel, remplace `assets/france-travail-logo-compatible.svg` par le logo officiel fourni par les canaux autorisés France Travail.
- Suppression de tous les faux événements de test.
- `data/evenements.csv` ne contient que l’en-tête : aucun événement inventé ne sera affiché.
- Les résultats événements sont affichés en cartes rassurantes : date, lieu, modalité, secteur, résumé et bouton “Voir la fiche / s’inscrire”.
- Module La Bonne Info prêt : import JSON/Markdown ou API intranet configurable.

## Limite importante

GitHub Pages est statique. Il ne peut pas aspirer un site intranet protégé par SSO. Pour Mes Événements Emploi ou La Bonne Info, il faut au moins une des solutions suivantes :

1. Un export CSV/JSON déposé dans `data/evenements.csv`, `data/evenements.json` ou `data/la-bonne-info.json`.
2. Un import manuel via les boutons de l’interface.
3. Une API intranet autorisée, en HTTPS, avec CORS, configurée dans les réglages.

## Format événements CSV

Séparateur `;` conseillé.

```csv
titre;date;heure;ville;lieu;type;modalite;secteur;lien;description
Atelier CV;2026-07-02;09:30;Boulogne-Billancourt;Agence France Travail;Atelier;Présentiel;Tous secteurs;https://...;Présentation utile pour l’usager.
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

## Format La Bonne Info JSON

```json
[
  {
    "titre": "Actualisation mensuelle",
    "categorie": "Droits et démarches",
    "contenu": "Texte de la fiche ou synthèse autorisée...",
    "motsCles": ["actualisation", "allocation", "espace personnel"],
    "lien": "https://..."
  }
]
```

Le fichier à alimenter est :

```text
data/la-bonne-info.json
```

Tu peux aussi importer un fichier `.json`, `.md` ou `.txt` depuis les réglages.

## Déploiement GitHub Pages

1. Créer un dépôt GitHub.
2. Envoyer tous les fichiers à la racine.
3. Aller dans `Settings > Pages`.
4. Choisir `GitHub Actions` ou `Deploy from branch`.
5. Ouvrir l’URL GitHub Pages générée.

## Test local

```bash
python -m http.server 8080
```

Puis ouvrir :

```text
http://localhost:8080
```

## Production

Ne pas publier de données internes France Travail dans un dépôt public.
Pour un usage réel en agence, utiliser un dépôt privé ou une API interne validée.
