# Correction Erreur 405 — Cloudflare Pages

L'erreur 405 sur `/api/agent` signifie presque toujours que Cloudflare sert le site comme un fichier statique et que le Worker n'intercepte pas la requête POST.

Cette version ajoute le dossier :

```txt
functions/[[path]].js
```

Il force Cloudflare Pages à envoyer ces routes vers le Worker :

- `/health`
- `/api/agent`
- `/debug-intent`
- `/debug-events`
- toutes les routes `/api/...`

## Déploiement conseillé

1. Envoie tout le contenu de ce ZIP à la racine du dépôt GitHub.
2. Vérifie que le dossier `functions` est bien à la racine.
3. Dans Cloudflare Pages :
   - Build command : vide
   - Build output directory : `/`
4. Redéploie.

## Tests

Après déploiement :

```txt
https://ton-domaine/health
```

Puis :

```txt
https://ton-domaine/debug-intent?message=Je%20cherche%20un%20événement%20à%20Issy-les-Moulineaux
```

Puis depuis l'application, envoie :

```txt
Je cherche un événement à Issy-les-Moulineaux
```

Si `/health` affiche du JSON avec `ok: true`, le Worker est bien branché.
Si `/health` renvoie encore 405 ou 404, Cloudflare ne déploie pas le dossier `functions` ou le projet n'est pas sur la bonne racine.
