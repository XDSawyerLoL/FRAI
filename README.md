# Assistant France Travail — version GitHub + agent navigateur local

Cette version garde l’interface web publiable sur GitHub Pages, mais ajoute un **agent navigateur local** pour faire les recherches à la place de l’utilisateur sur les services France Travail.

## Pourquoi un agent local ?

Une page GitHub Pages seule ne peut pas :

- contrôler un autre site web ;
- remplir automatiquement des formulaires sur `francetravail.fr` ;
- accéder à une session SSO/intranet ;
- contourner CORS ou les protections navigateur.

Pour que l’assistant fasse réellement le travail, il faut lancer un petit agent local sur le PC. Cet agent ouvre un navigateur Chromium, renseigne les critères, déclenche la recherche et renvoie ce qu’il arrive à extraire à l’interface.

## Déploiement GitHub Pages

À la racine du dépôt GitHub, mettre :

```text
index.html
agent-local/
README.md
```

Dans GitHub :

```text
Settings → Pages → Deploy from a branch → main → /root
```

Ouvrir ensuite :

```text
https://votre-compte.github.io/votre-repo/
```

## Lancer le mode agent

Sur le PC France Travail ou le PC de test :

1. Installer Node.js LTS si nécessaire.
2. Aller dans :

```text
agent-local/
```

3. Double-cliquer :

```text
lancer-agent-local.bat
```

4. Laisser la fenêtre ouverte.

L’agent écoute sur :

```text
http://127.0.0.1:8798
```

Dans l’interface, paramètres → **Agent navigateur local** :

```text
http://127.0.0.1:8798
```

## Exemples à tester

```text
Ma ville est Boulogne-Billancourt
```

```text
Que se passe-t-il en événement dans ma ville ?
```

```text
Je suis agent administratif, je cherche une formation financée par la région ou France Travail
```

```text
Trouve une formation secrétaire administratif à Paris avec financement France Travail
```

## Limites assumées

L’agent ne stocke pas les identifiants. Si un service demande une connexion, l’utilisateur se connecte dans le navigateur ouvert par l’agent. Le profil navigateur est conservé dans `agent-local/.browser-profile` pour éviter de se reconnecter à chaque lancement.

Les pages France Travail peuvent changer. Si les noms de champs évoluent, il faudra ajuster `agent-local/server.js`.

Pour une version industrialisable, la meilleure voie reste l’API officielle France Travail quand elle est disponible et autorisée, puis l’agent navigateur seulement en secours.
