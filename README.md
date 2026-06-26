# Assistant France Travail - version mono-fichier GitHub Pages

Cette version contient toute l’interface dans un seul fichier `index.html`.

## Correction du 404

Sur GitHub, le fichier `index.html` doit être placé directement à la racine du dépôt `FRAI`, pas dans un dossier.

Le dépôt doit afficher :

```
index.html
```

et non :

```
assistant-france-travail-github-root-fixed/index.html
```

## Déploiement

1. Ouvrir le dépôt GitHub `FRAI`.
2. Supprimer les anciens fichiers si besoin.
3. Ajouter uniquement `index.html` à la racine.
4. Settings > Pages > Deploy from a branch > main > /root.
5. Ouvrir : `https://xdsawyerlol.github.io/FRAI/`.

## Données événements

L’application n’invente aucun événement. Les événements se chargent via le bouton de mise à jour de l’agenda, par fichier CSV/JSON ou API autorisée.
