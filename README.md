# Assistant France Travail — GitHub Pages

Version statique prête à publier sur GitHub Pages.

## Publication

Placez `index.html` à la racine du dépôt GitHub, puis activez GitHub Pages :

- Source : Deploy from a branch
- Branch : main
- Folder : /root

## Évolutions intégrées

- En-tête avec France Travail et bloc République Française.
- Liens officiels intégrés pour les ateliers France Travail.
- Boutons d’accès direct aux fiches officielles et à l’espace personnel.
- Événements affichés sous forme de cartes avec bouton de consultation / inscription.
- Aucune donnée fictive générée : l’agenda doit venir d’un import CSV/JSON, d’OpenAgenda si accessible ou d’une API intranet autorisée.
- La Bonne Info reste alimentable par import ou API intranet.

## Données événements

Le format CSV/JSON peut contenir :

`titre,date,heure,ville,lieu,type,modalite,secteur,description,lien`

Si `lien` est renseigné, le bouton ouvre directement la fiche événement. Sinon le bouton renvoie vers Mes Événements Emploi.
