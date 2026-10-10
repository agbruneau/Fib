# Fib

Une même CLI Fibonacci académique en Go, Rust, TypeScript et Python, qui sert de banc d'essai aux skills de Matt Pocock (plugin `mattpocock-skills`). Exigences, contrat de la CLI et démarche : `PRD.md`. La lisibilité prime sur la performance.

## Rôles

- **Orchestrateur** : la session principale, Opus 5.5 en `ultracode` (`.claude/settings.json`). Il conduit les skills de planification et de revue, délègue chaque ticket, intègre et vérifie. Le code d'implémentation revient à `fib-dev`.
- **`fib-dev`** : sous-agent Sonnet 5.5 (`.claude/agents/fib-dev.md`), un ticket et un langage par invocation, dans son propre worktree.

Ce dépôt demande la délégation : la règle globale « ne lance un sous-agent que si je le demande » est levée ici pour `fib-dev` et pour les sous-agents de `/code-review`.

## Boucle de livraison

1. Prendre la frontière : les tickets `ready-for-agent` dont tous les bloqueurs sont fusionnés dans `main`.
2. Lancer un `fib-dev` par ticket, en parallèle quand les langages diffèrent. Dans un workflow : `agent(prompt, { agentType: 'fib-dev', isolation: 'worktree' })`. Le prompt donne le numéro du ticket et le langage.
3. Au retour, fusionner la branche dans `main` (conflit : skill `resolving-merge-conflicts`), puis lancer `npm run check`.
4. `/code-review` depuis le commit d'avant la fusion. Un constat à corriger repart chez un `fib-dev` avec le rapport.
5. Fermer le ticket quand `npm run check` est vert sur `main`.
6. Ajouter à `docs/exploration.md` le constat sur chaque skill utilisée (format : PRD § 9).

## Vérification

`npm run check` à la racine couvre les quatre langages et le test de contrat; `npm run check:<go|rust|ts|py>` en couvre un seul. Les scripts vivent dans `package.json`, créé par le ticket « contrat » (PRD § 6).
