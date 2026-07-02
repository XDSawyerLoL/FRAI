# FRAI front v7.7 — correction erreur 405

Cette version force le front à appeler le Worker Cloudflare directement en POST :

https://assistant-frai-api.vnhz.workers.dev/api/agent

Elle ne passe plus par `/api/agent` en relatif.
Elle supprime aussi les anciens réglages locaux `frai_worker_url`, `apiUrl`, etc.
Elle tente de désinscrire les anciens Service Workers et de vider les caches du navigateur.

## À mettre dans GitHub Pages

Mets à la racine du dépôt GitHub :

- index.html
- 404.html

Ne garde pas les anciens dossiers :

- functions/
- _worker.js
- assets/app.js si ton ancien index l'appelait

## Vérification visuelle

Dans l'app, le statut en haut doit afficher :

Prêt · v7.7

Si tu ne vois pas `v7.7`, tu regardes encore une ancienne version en cache ou le mauvais site.

## Test backend déjà validé

Le Worker v7.6 répond avec événements. Le front doit simplement appeler :

POST https://assistant-frai-api.vnhz.workers.dev/api/agent
