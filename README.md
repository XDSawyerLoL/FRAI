# Assistant France Travail — GitHub Pages + agent local + OpenAI

Cette version fonctionne en deux blocs :

1. `index.html` : interface web à publier sur GitHub Pages.
2. `agent-local/` : agent PC qui ouvre un navigateur, remplit les critères sur les sites France Travail, récupère les résultats et appelle OpenAI si une clé API est fournie.

## Installation GitHub Pages

Dans le dépôt GitHub, place le fichier `index.html` à la racine :

```text
FRAI/
└── index.html
```

Dans GitHub :

```text
Settings → Pages → Deploy from a branch → main → /root
```

URL attendue :

```text
https://xdsawyerlol.github.io/FRAI/
```

## Installation de l’agent local sur PC

Ouvre le dossier :

```text
agent-local/
```

Puis lance une première fois :

```text
installer_agent.bat
```

Ensuite, pour utiliser l’assistant :

```text
lancer_agent.bat
```

L’agent local tourne ici :

```text
http://127.0.0.1:8798
```

Laisse la fenêtre ouverte pendant l’utilisation.

## Utilisation avec OpenAI / ChatGPT

Dans l’interface web :

1. Clique sur `Réglages`.
2. Renseigne la ville par défaut.
3. Vérifie l’adresse agent : `http://127.0.0.1:8798`.
4. Ajoute une clé API OpenAI.
5. Modèle conseillé : `gpt-4.1-mini`.
6. Clique sur `Tester l’agent`.

La clé API ne doit jamais être publiée dans GitHub. Elle reste dans le navigateur ou dans `.env` côté agent local.

## Ce que l’agent fait

### Événements

Demande possible :

```text
Que se passe-t-il en événement dans ma ville ?
```

L’agent ouvre :

```text
https://mesevenementsemploi.francetravail.fr/mes-evenements-emploi/evenements
```

Il tente de remplir les champs disponibles avec la ville et le besoin, lance la recherche, extrait les cartes visibles et renvoie les fiches dans le tchat.

### Formations

Demande possible :

```text
Je suis agent administratif, trouve une formation financée par la Région ou France Travail
```

L’agent ouvre :

```text
https://candidat.francetravail.fr/formations/recherche?filtreEstFormationEnCoursOuAVenir=formEnCours&filtreEstFormationTerminee=formEnCours&range=0-9&tri=0
```

Il tente de remplir le métier, la ville, les filtres de financement disponibles, puis renvoie les résultats visibles.

## Limites propres

- L’agent ne stocke pas les identifiants France Travail.
- Si une page demande une authentification ou une validation humaine, la fenêtre du navigateur reste ouverte pour reprise par l’utilisateur.
- Les financements formation doivent toujours être vérifiés sur la fiche officielle et, si nécessaire, avec le conseiller.
- Pour une version industrielle, il faudra brancher les API officielles France Travail plutôt que dépendre de l’automatisation navigateur.

## Dépannage

Si l’interface indique que l’agent n’est pas connecté :

1. Vérifie que `lancer_agent.bat` est ouvert.
2. Ouvre dans le navigateur : `http://127.0.0.1:8798/api/health`.
3. Si Windows bloque, autorise Node.js dans le pare-feu.
4. Recharge la page GitHub avec `Ctrl + F5`.

Si GitHub Pages ne trouve pas le fichier :

- vérifie que `index.html` est à la racine du dépôt ;
- pas dans un sous-dossier ;
- Pages doit pointer vers `main / root`.
