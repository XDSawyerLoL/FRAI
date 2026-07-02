# FRAI Cloudflare unifié v6.9

Cette archive remet les trois pièces dans le même langage :

1. `index.html` appelle directement `/api/agent` sur le même domaine Cloudflare Pages.
2. `functions/api/agent.js` intercepte le POST `/api/agent` et le transmet au Worker.
3. `cloudflare-worker.js` renvoie un JSON que le front sait afficher :
   - `reply`
   - `intent`
   - `events`
   - `offres`
   - `formations`
   - `officialLinks`
   - `services`

## Structure attendue à la racine GitHub

```txt
index.html
cloudflare-worker.js
functions/api/agent.js
functions/health.js
functions/[[path]].js
manifest.webmanifest
sw.js
404.html
```

Ne déploie pas depuis un sous-dossier. Le dossier `functions` doit être à la racine du projet Cloudflare Pages.

## Réglages Cloudflare Pages

- Framework preset : None
- Build command : vide
- Build output directory : `/` ou `.` selon l’interface Cloudflare

## Variables indispensables

Dans Cloudflare Pages → Settings → Environment variables :

```txt
FRANCE_TRAVAIL_CLIENT_ID
FRANCE_TRAVAIL_CLIENT_SECRET
FRANCE_TRAVAIL_SCOPE
GEMINI_API_KEY facultatif
OPENAI_API_KEY facultatif
```

## Variables optionnelles utiles

Le Worker fonctionne déjà pour :

```txt
FT_OFFRES_URL par défaut : offres emploi France Travail
FT_EVENTS_URL par défaut : Mes Événements Emploi
```

Les autres API sont volontairement optionnelles. Sans URL d’habilitation, elles seront ignorées proprement :

```txt
FT_FORMATIONS_URL
FT_MARCHE_TRAVAIL_URL
FT_BONNE_BOITE_URL
FT_ROME_METIERS_URL
FT_ROME_COMPETENCES_URL
FT_ROME_FICHES_URL
FT_ROME_CONTEXTES_URL
FT_AGENCES_URL
FT_CADRE_VIE_URL
FT_ACCES_EMPLOI_URL
FT_ROMEO_URL
```

## Tests après déploiement

```txt
https://ton-site.pages.dev/health
```

Réponse attendue : JSON avec `ok: true` et `status: online`.

```txt
https://ton-site.pages.dev/debug-intent?message=Je%20cherche%20un%20événement%20à%20Issy-les-Moulineaux
```

Puis teste dans l’interface :

```txt
Je cherche un événement à Issy-les-Moulineaux en juillet
```

## Si tu as encore une erreur 405

Cloudflare ne voit pas le dossier `functions`. Causes probables :

- Le dépôt GitHub n’a pas le dossier `functions` à la racine.
- Le projet Cloudflare Pages déploie un sous-dossier.
- Tu testes encore l’ancienne URL GitHub Pages au lieu de l’URL Cloudflare Pages.
- Le déploiement n’a pas été relancé après le push GitHub.

## Ce qui a été volontairement supprimé

- Appel Gemini depuis le navigateur.
- Réglage manuel `apiUrl` côté utilisateur.
- Pile de services affichée comme catalogue.
- Liens textuels dans la réponse IA.
- `_worker.js`, pour éviter le conflit entre Pages Functions et Pages Advanced Mode.
