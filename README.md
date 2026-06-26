# Assistant France Travail - GitHub Pages

Version mono-fichier : toute l’application est dans `index.html`.

## Correctif de cette version

- Les demandes d’agenda sont maintenant prioritaires.
- Les fautes fréquentes sont prises en compte : `evennement`, `évènement`, `evenement`.
- La phrase `Que se passe-t-il en événement dans ma ville ?` déclenche bien la recherche d’événements.
- Si aucune ville par défaut n’est enregistrée, l’assistant demande la ville au lieu de proposer des ateliers au hasard.
- Si une ville est enregistrée, `ma ville` est remplacé par cette ville.
- Le moteur Gemini ne traite plus les demandes d’agenda : elles restent gérées par la recherche événementielle interne pour éviter les réponses incohérentes.
- Recherche possible dans : API configurée, source publique OpenAgenda quand accessible, puis fichier importé.

## Déploiement GitHub Pages

1. Ouvrir le dépôt GitHub `FRAI`.
2. Supprimer les anciens fichiers si besoin.
3. Ajouter uniquement `index.html` à la racine.
4. Settings > Pages > Deploy from a branch > main > /root.
5. Ouvrir : `https://xdsawyerlol.github.io/FRAI/`.

Le dépôt doit afficher :

```txt
index.html
```

et non :

```txt
assistant-france-travail-github-events-fixed/index.html
```

## Utilisation conseillée

Dans les paramètres, renseigner une ville par défaut, par exemple :

```txt
Boulogne-Billancourt
```

Ensuite poser :

```txt
Que se passe-t-il en événement dans ma ville ?
```

ou directement :

```txt
Événements emploi à Issy-les-Moulineaux
```

## Données événements

L’application n’invente aucun événement.

Pour une version vraiment robuste en agence, brancher l’API Mes Événements Emploi autorisée ou importer un CSV/JSON issu d’une source interne.
