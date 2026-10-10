# Issue tracker: GitHub

Les issues et les specs de ce dépôt sont des issues GitHub de `agbruneau/Fib`. Toutes les opérations passent par le CLI `gh`.

## Conventions

- **Créer une issue** : `gh issue create --title "..." --body "..."`. Utiliser un heredoc pour un corps sur plusieurs lignes.
- **Étiquette absente** : `gh issue create --label` échoue si l'étiquette n'existe pas. La créer d'abord avec `gh label create "<nom>"`.
- **Lire une issue** : `gh issue view <numéro> --comments`, en filtrant les commentaires avec `jq` et en récupérant aussi les étiquettes.
- **Lister les issues** : `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, avec les filtres `--label` et `--state` voulus.
- **Commenter une issue** : `gh issue comment <numéro> --body "..."`
- **Ajouter ou retirer une étiquette** : `gh issue edit <numéro> --add-label "..."` / `--remove-label "..."`
- **Fermer** : `gh issue close <numéro> --comment "..."`

`gh` déduit le dépôt de `git remote -v` quand il s'exécute dans un clone.

## Statut en cours

GitHub n'a que deux états, Open et Closed. Le statut « en cours » est l'étiquette `in-progress` :

- **Open** : sans `in-progress`. Le ticket attend qu'on le prenne.
- **In Progress** : `gh issue edit <numéro> --add-label in-progress`, posée au lancement du travail (agent ou humain), avant toute écriture.
- **Closed** : `gh issue edit <numéro> --remove-label in-progress`, puis `gh issue close <numéro> --comment "..."`.

Un ticket `in-progress` sort de la frontière : personne d'autre ne le prend.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Mettre `yes` si ce dépôt traite les PR externes comme des demandes de fonctionnalité; `/triage` lit ce drapeau.)_

À `yes`, les PR suivent les mêmes étiquettes et états que les issues, avec les équivalents `gh pr` :

- **Lire une PR** : `gh pr view <numéro> --comments`, et `gh pr diff <numéro>` pour le diff.
- **Lister les PR externes à trier** : `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`, puis ne garder que les `authorAssociation` `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` ou `NONE` (écarter `OWNER`, `MEMBER`, `COLLABORATOR`).
- **Commenter, étiqueter, fermer** : `gh pr comment`, `gh pr edit --add-label` / `--remove-label`, `gh pr close`.

GitHub partage une seule numérotation entre issues et PR : un `#42` nu peut désigner l'une ou l'autre. Trancher avec `gh pr view 42`, sinon `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Créer une issue GitHub.

## When a skill says "fetch the relevant ticket"

Lancer `gh issue view <numéro> --comments`.

## Wayfinding operations

Utilisées par `/wayfinder`. La **carte** est une seule issue; ses tickets sont des issues **enfants**.

- **Carte** : une issue étiquetée `wayfinder:map`, dont le corps porte Notes, Decisions-so-far et Fog. `gh issue create --label wayfinder:map`.
- **Ticket enfant** : une issue liée à la carte comme sous-issue GitHub (`gh api` sur l'endpoint des sous-issues). Si les sous-issues ne sont pas activées, ajouter l'enfant à une liste de tâches dans le corps de la carte et mettre `Part of #<carte>` en tête du corps de l'enfant. Étiquettes : `wayfinder:<type>` (`research`, `prototype`, `grilling`, `task`). Un ticket réclamé est assigné au développeur qui pilote la carte.
- **Blocage** : les **dépendances natives** de GitHub, la représentation canonique et visible dans l'interface. Ajouter une arête avec `gh api --method POST repos/<owner>/<repo>/issues/<enfant>/dependencies/blocked_by -F issue_id=<id-bloqueur>`, où `<id-bloqueur>` est l'**identifiant de base de données** numérique du bloqueur (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, ni le `#numéro` ni le `node_id`). GitHub expose `issue_dependencies_summary.blocked_by` (bloqueurs ouverts seulement : la barrière active). Si les dépendances ne sont pas disponibles, mettre une ligne `Blocked by: #<n>, #<n>` en tête du corps de l'enfant. Un ticket est débloqué quand tous ses bloqueurs sont fermés.
- **Requête de frontière** : lister les enfants ouverts de la carte (`gh issue list --state open`, limité aux sous-issues ou à la liste de tâches de la carte), écarter ceux qui ont un bloqueur ouvert (`issue_dependencies_summary.blocked_by > 0`, ou une issue ouverte dans la ligne `Blocked by`) ou un assigné; le premier dans l'ordre de la carte l'emporte.
- **Réclamer** : `gh issue edit <n> --add-assignee @me`, la première écriture de la session.
- **Résoudre** : `gh issue comment <n> --body "<réponse>"`, puis `gh issue close <n>`, puis ajouter un pointeur de contexte (résumé et lien) aux Decisions-so-far de la carte.
