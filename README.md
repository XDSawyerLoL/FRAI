# Assistant France Travail — interface corrigée + agent local + OpenAI

Cette version remet l’interface en mode tchat plein écran et déplace les éléments secondaires dans les **Réglages**.

## Corrections incluses

- Logo Marianne conservé avec le SVG fourni.
- Logo France Travail remis en vrai logo image, plus de logo simulé en pastilles.
- Suppression du panneau latéral.
- Accès rapides, liens officiels, ville, agent local et clé OpenAI déplacés dans `⚙️ Réglages`.
- Interface plus proche d’un tchat classique.
- Agent local conservé pour chercher dans :
  - Mes Événements Emploi ;
  - Se former France Travail.
- OpenAI/ChatGPT conservé via clé API dans les réglages.

## Déploiement GitHub Pages

À la racine du dépôt :

```text
FRAI/
├── index.html
└── agent-local/
```

Dans GitHub :

```text
Settings → Pages → Deploy from a branch → main → /root
```

## Installation de l’agent local

Sur le PC :

```text
agent-local/installer_agent.bat
```

Puis pour lancer l’agent :

```text
agent-local/lancer_agent.bat
```

L’agent local écoute ici :

```text
http://127.0.0.1:8798
```

Dans l’interface, ouvre `⚙️ Réglages`, renseigne :

```text
Ville par défaut
Adresse agent local
Clé API OpenAI
Modèle OpenAI
```

Puis clique sur `Tester l’agent`.

## Demandes de test

```text
Que se passe-t-il en événement dans ma ville ?
```

```text
Je suis agent administratif à Boulogne-Billancourt, trouve une formation financée par la Région ou France Travail
```

## Important

Ne mets jamais ta clé OpenAI dans GitHub. Elle doit rester dans ton navigateur ou dans l’agent local.
