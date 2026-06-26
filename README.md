# Assistant France Travail — GitHub Pages

Application web statique prête à publier sur GitHub Pages pour orienter les usagers sur :

- les événements emploi ;
- les ateliers conseil ;
- les prestations ;
- la PMSMP / immersion professionnelle ;
- la POE ;
- La Bonne Boîte ;
- La Bonne Alternance ;
- La Bonne Info via import ou API interne.

## Mise en service rapide

1. Créer un dépôt GitHub privé ou interne.
2. Envoyer tous les fichiers à la racine du dépôt.
3. Activer GitHub Pages : `Settings > Pages`.
4. Choisir le déploiement par branche `main / root` ou GitHub Actions.
5. Ouvrir l’URL générée.

## Données événements

L’assistant n’invente aucun événement. Il affiche uniquement les événements fournis par :

- `data/evenements.csv` ;
- `data/evenements.json` ;
- un fichier CSV/JSON importé depuis le bouton **Mettre à jour l’agenda** ;
- une API interne configurée dans les paramètres.

Colonnes CSV recommandées :

```csv
titre;date;heure;ville;lieu;type;modalite;secteur;description;lien
```

Exemple de format attendu, à remplacer par vos vraies données :

```csv
titre;date;heure;ville;lieu;type;modalite;secteur;description;lien
Forum emploi territorial;2026-07-08;14:00;Paris;Agence France Travail;Forum;Présentiel;Commerce;Rencontre avec des recruteurs du territoire;https://mesevenementsemploi.francetravail.fr/mes-evenements-emploi/
```

Ne pas publier de données confidentielles dans un dépôt public.

## Données La Bonne Info

Format JSON attendu dans `data/la-bonne-info.json` :

```json
[
  {
    "titre": "Actualisation mensuelle",
    "categorie": "Droits et démarches",
    "contenu": "Texte de la fiche ou synthèse validée...",
    "motsCles": ["actualisation", "allocation", "espace personnel"],
    "lien": "https://la-bonne-info.francetravail.net/..."
  }
]
```

L’intégration complète de La Bonne Info nécessite un export autorisé ou une API interne accessible depuis l’environnement de publication.

## API interne optionnelle

Dans les paramètres, les URL peuvent utiliser ces variables :

- `{city}` : ville ou territoire recherché ;
- `{keyword}` : mot-clé métier ou besoin ;
- `{keyword}` pour La Bonne Info.

Exemple :

```text
https://intranet/api/evenements?ville={city}&q={keyword}
```

L’API doit accepter HTTPS, CORS et l’authentification adaptée à l’environnement.

## Sécurité

- Ne pas mettre de clé API dans le code.
- Ne pas publier de données usagers.
- Ne pas publier d’export interne dans un dépôt public.
- Préférer un dépôt privé ou un hébergement intranet pour un usage métier.
