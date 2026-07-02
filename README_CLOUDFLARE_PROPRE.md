# FRAI — version Cloudflare propre

Cette version est faite pour sortir du bricolage GitHub Pages + agent externe.

Objectif produit :

```text
1 besoin détecté
→ 1 direction claire
→ 3 étapes maximum
→ 1 action prioritaire
→ 1 ou 2 liens utiles maximum
```

## Déploiement recommandé : Cloudflare Pages

1. Crée un projet Cloudflare Pages depuis ce dossier.
2. Framework preset : `None`.
3. Build command : vide.
4. Output directory : `/` ou vide selon l’interface Cloudflare.
5. Le fichier `_worker.js` gère automatiquement :
   - `/health`
   - `/api/agent`
   - `/debug-intent`
   - `/debug-events`
   - les fichiers statiques du site.

Le front appelle maintenant `/api/agent` sur le même domaine. Il n’a donc plus besoin d’une URL Worker écrite en dur.

## Variables Cloudflare nécessaires

Dans Cloudflare → Settings → Variables :

```text
FRANCE_TRAVAIL_CLIENT_ID
FRANCE_TRAVAIL_CLIENT_SECRET
FRANCE_TRAVAIL_SCOPE
```

Optionnel mais conseillé :

```text
GEMINI_API_KEY
GEMINI_MODEL = gemini-2.5-flash-lite
OPENAI_API_KEY
OPENAI_MODEL = gpt-4.1-mini
```

Selon tes habilitations France Travail, tu peux aussi ajouter :

```text
FT_SCOPE_EVENTS
FT_SCOPE_OFFRES
FT_SCOPE_FORMATIONS
FT_EVENTS_URL
FT_OFFRES_URL
FT_FORMATIONS_URL
```

## Tests après déploiement

Teste dans le navigateur :

```text
https://ton-domaine/health
```

Puis :

```text
https://ton-domaine/debug-intent?message=Je%20cherche%20un%20événement%20à%20Issy-les-Moulineaux
```

Puis :

```text
https://ton-domaine/debug-events?ville=Issy-les-Moulineaux&mois=juillet
```

## Comportement corrigé

- Plus de section “Services pertinents” en pile de cartes.
- Plus de 8 boutons.
- Pas d’URL brute dans le texte.
- Les événements remontent en cartes avec un bouton “Voir l’événement”.
- Les offres remontent en cartes avec un bouton “Voir l’offre”.
- Les liens d’action sont limités à 2.
- Pour une recherche emploi : cartes d’offres + action conseillée La Bonne Boîte / événements emploi.
- Pour une recherche événement : cartes événements directement exploitables.

## Déploiement Worker seul

Si tu veux garder un Worker séparé, utilise `cloudflare-worker.js` comme fichier principal.
Dans ce cas, le front devra pointer vers l’URL du Worker, mais la version recommandée reste Cloudflare Pages avec `_worker.js`.

## Correctif 405

Cette archive contient aussi `functions/[[path]].js`. C'est le branchement standard Cloudflare Pages quand le site vient de GitHub. Il évite que `/api/agent` soit traité comme un fichier statique, ce qui provoque l'erreur 405.
